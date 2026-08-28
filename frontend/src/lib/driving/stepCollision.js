import { PALLET_FALLBACK_FOOTPRINT } from '../../data/palletProfile'
import { RACK_STRIKE_SPEED } from '../../data/rackProfile'
import { evaluateForkEngagement } from '../loadPhysics'
import { distanceToOrientedRect, orientedRectOverlap, pointInOrientedRect } from '../simCollision'
import { decorationType } from '../courseEdit'
import { triggerFail } from './stepFail'
import {
  CONE_FALL_ANGLE,
  CONE_FALL_SPEED,
  CONE_MIN_HIT_SPEED,
  CONE_RADIUS,
  FORK_ENGAGE_HEIGHT,
  FORK_REACH_FALLBACK,
  FORK_TIP_OFFSET_FALLBACK,
  PALLET_NUDGE_MAX,
  PALLET_SOLID_MAX_Y,
  RACK_HIT_MARGIN,
  WALL_HALF_THICKNESS,
  WALL_HIT_MARGIN,
} from './constants'

// Solid objects stop the truck rather than let it drive through. Racking also
// fails the attempt - it is structure, and only the forks belong inside a
// bay. A pallet does not fail, because driving into one is how the forks go
// in: it lets the tines through when the approach is square and low, blocks
// once they have bottomed out against the carriage, and gets shoved aside
// when the truck hits it off-square.
//
// Resolves stepDrive's intended nextX/nextZ against rack and pallet-as-
// obstacle collision, commits the result to posRef, and syncs the visible
// forklift group. Must run before stepForks/stepFail/stepPallet, which read
// the committed position.
export function stepCollisionBody(ctx) {
  const {
    bodyRectRef, headingRef, halfWidth, halfLength, posRef, rackColliders, speedRef,
    pallets, rigRef, palletRefs, palletSimRef, palletFootprintsRef, palletRectRef,
    profile, forkHeightRef, forkliftGroupRef, frame,
  } = ctx
  const { nextX, nextZ } = frame

  const body = bodyRectRef.current
  body.x = nextX
  body.z = nextZ
  body.rotation = headingRef.current
  body.halfX = halfWidth
  body.halfZ = halfLength

  // Only a move that pushes *deeper* into an object is rejected. Testing raw
  // overlap instead would trap the truck the moment it ended up inside
  // something - most easily right after setting a pallet down, where it is
  // standing on top of the load it just released and still has to reverse
  // clear of it.
  const worsensOverlap = (rect, margin = 0) => {
    const next = orientedRectOverlap(body, rect, margin)
    if (!next) return null
    body.x = posRef.current.x
    body.z = posRef.current.z
    const now = orientedRectOverlap(body, rect, margin)
    body.x = nextX
    body.z = nextZ
    return !now || next.depth > now.depth + 1e-4 ? next : null
  }

  let blocked = false

  for (const rack of rackColliders) {
    if (!worsensOverlap(rack, RACK_HIT_MARGIN)) continue
    blocked = true
    // Placing a load on a shelf puts the truck's nose at the rack's face on
    // purpose, so touching it while creeping only stops the truck. Above
    // RACK_STRIKE_SPEED it is a strike, and racking is structure.
    if (Math.abs(speedRef.current) > RACK_STRIKE_SPEED) triggerFail(ctx, 'rack')
    break
  }

  if (!blocked && pallets.length) {
    const tipOffset = rigRef.current?.forkTipOffset || FORK_TIP_OFFSET_FALLBACK
    const tipReach = rigRef.current?.forkReach || FORK_REACH_FALLBACK
    for (let i = 0; i < pallets.length; i += 1) {
      const pallet = palletRefs.current[i]
      if (!pallet || palletSimRef.current?.[i]?.state === 'carried') continue
      // A pallet up on a shelf, or still in the air, is not in the way.
      if (pallet.position.y > PALLET_SOLID_MAX_Y) continue

      const palletHalf = palletFootprintsRef.current[i] || PALLET_FALLBACK_FOOTPRINT
      const rect = palletRectRef.current
      rect.x = pallet.position.x
      rect.z = pallet.position.z
      rect.rotation = pallet.rotation.y
      rect.halfX = palletHalf.halfWidth
      rect.halfZ = palletHalf.halfDepth

      const hit = worsensOverlap(rect)
      if (!hit) continue

      const engagement = evaluateForkEngagement({
        palletX: rect.x,
        palletZ: rect.z,
        palletRot: rect.rotation,
        palletHalf,
        vehicleX: nextX,
        vehicleZ: nextZ,
        heading: headingRef.current,
        forkTipOffset: tipOffset,
        forkReach: tipReach,
      })
      const forksEntering =
        profile.hasForks && engagement.canEnter && forkHeightRef.current <= FORK_ENGAGE_HEIGHT

      if (forksEntering && engagement.insertDepth < engagement.seatedDepth) continue

      blocked = true
      if (!forksEntering) {
        const push = Math.min(hit.depth, PALLET_NUDGE_MAX)
        pallet.position.x -= hit.axisX * push
        pallet.position.z -= hit.axisZ * push
      }
      break
    }
  }

  if (blocked) {
    speedRef.current = 0
  } else {
    posRef.current.x = nextX
    posRef.current.z = nextZ
  }

  if (forkliftGroupRef.current) {
    forkliftGroupRef.current.position.set(posRef.current.x, posRef.current.y, posRef.current.z)
    forkliftGroupRef.current.rotation.y = headingRef.current
  }
}

// Cone and wall/vehicle hits, checked against the truck's committed position.
// Cones are exact point-vs-oriented-rectangle (cone position against the
// truck's own footprint) - the same technique the wall check uses, rather
// than approximating the body as fixed-radius circles along the centreline,
// which overshot right at each sample point but left gaps between them.
// Always on - a cone is a hazard however the course authored it.
export function stepCollisionHazards(ctx, dt) {
  const {
    liveCones, failedRef, speedRef, posRef, bodyRectRef, coneSimRef, coneRefs, coneAxisRef, coneQuatRef,
    liveWalls, palletRectRef, halfWidth, halfLength, bodySampleOffsets, frame,
  } = ctx
  const { forwardX, forwardZ } = frame
  const body = bodyRectRef.current

  if (liveCones.length && !failedRef.current && Math.abs(speedRef.current) > CONE_MIN_HIT_SPEED) {
    if (!coneSimRef.current) coneSimRef.current = liveCones.map(() => ({ hit: false, angle: 0, dirX: 0, dirZ: 1 }))
    const coneSims = coneSimRef.current
    body.x = posRef.current.x
    body.z = posRef.current.z
    for (let i = 0; i < liveCones.length && !failedRef.current; i += 1) {
      const cone = liveCones[i]
      if (coneSims[i].hit) continue
      const dx = cone.position[0] - posRef.current.x
      const dz = cone.position[2] - posRef.current.z
      if (distanceToOrientedRect(cone.position[0], cone.position[2], body) <= CONE_RADIUS) {
        const len = Math.hypot(dx, dz) || 1
        coneSims[i] = { hit: true, angle: 0, dirX: dx / len, dirZ: dz / len }
        triggerFail(ctx, 'cone')
      }
    }
  }

  // Animate knocked-over cones (keeps running after the fail freeze).
  if (coneSimRef.current && liveCones.length) {
    coneSimRef.current.forEach((sim, i) => {
      if (!sim.hit || sim.angle >= CONE_FALL_ANGLE) return
      sim.angle = Math.min(sim.angle + CONE_FALL_SPEED * dt * Math.max(0.15, 1 - sim.angle / CONE_FALL_ANGLE), CONE_FALL_ANGLE)
      const group = coneRefs.current[i]
      if (!group) return
      coneAxisRef.current.set(sim.dirZ, 0, -sim.dirX)
      coneQuatRef.current.setFromAxisAngle(coneAxisRef.current, sim.angle)
      group.quaternion.copy(coneQuatRef.current)
      group.position.x = liveCones[i].position[0] + sim.dirX * sim.angle * 0.12
      group.position.z = liveCones[i].position[2] + sim.dirZ * sim.angle * 0.12
    })
  }

  // Wall/vehicle collision: sample the same body points against every
  // decoration's oriented rectangle (thickness x length, or a parked
  // vehicle's footprint). Immovable, so a hit just fails the attempt.
  if (liveWalls.length && !failedRef.current && Math.abs(speedRef.current) > CONE_MIN_HIT_SPEED) {
    const wallRect = palletRectRef.current
    wallLoop: for (const wall of liveWalls) {
      const isVehicle = decorationType(wall) === 'vehicle'
      wallRect.x = wall.position[0]
      wallRect.z = wall.position[2]
      wallRect.rotation = wall.rotation || 0
      wallRect.halfX = isVehicle ? halfWidth : WALL_HALF_THICKNESS
      wallRect.halfZ = isVehicle ? halfLength : (wall.length || 3) / 2
      for (const offset of bodySampleOffsets) {
        const sampleX = posRef.current.x + forwardX * offset
        const sampleZ = posRef.current.z + forwardZ * offset
        if (pointInOrientedRect(sampleX, sampleZ, wallRect, WALL_HIT_MARGIN)) {
          triggerFail(ctx, isVehicle ? 'vehicle' : 'wall')
          break wallLoop
        }
      }
    }
  }
}
