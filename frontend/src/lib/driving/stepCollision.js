import { RACK_STRIKE_SPEED } from '../../data/rackProfile.js'
import { evaluateForkEngagement } from '../loadPhysics.js'
import { distanceToOrientedRect, orientedRectOverlap, pointInOrientedRect } from '../simCollision.js'
import { decorationType } from '../courseEdit.js'
import { triggerFail } from './stepFail.js'
import {
  CONE_FALL_ANGLE,
  CONE_FALL_SPEED,
  CONE_MIN_HIT_SPEED,
  CONE_RADIUS,
  FORK_ENGAGE_HEIGHT,
  PALLET_NUDGE_MAX,
  PALLET_SOLID_MAX_Y,
  RACK_HIT_MARGIN,
  WALL_HALF_THICKNESS,
  WALL_HIT_MARGIN,
} from './constants.js'

// Solid objects stop the truck rather than let it drive through. Racking also
// fails the attempt - it is structure, and only the forks belong inside a
// bay. A pallet does not fail, because driving into one is how the forks go
// in: it lets the tines through when the approach is square and low, blocks
// once they have bottomed out against the carriage, and gets shoved aside
// when the truck hits it off-square.
//
// Resolves stepDrive's intended nextX/nextZ against rack and pallet-as-
// obstacle collision and commits the result to the truck's position. Must run
// before stepForks/stepFail/stepPallet, which read the committed position.
export function stepCollisionBody(state, world) {
  const { truck, forks, pallets, frame } = state
  const { halfWidth, halfLength, rackColliders, geometry, scratch } = world
  const { nextX, nextZ } = frame

  const body = scratch.bodyRect
  body.x = nextX
  body.z = nextZ
  body.rotation = truck.heading
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
    body.x = truck.x
    body.z = truck.z
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
    if (Math.abs(truck.speed) > RACK_STRIKE_SPEED) triggerFail(state, 'rack')
    break
  }

  if (!blocked) {
    for (const pallet of pallets) {
      if (pallet.state === 'carried') continue
      // A pallet up on a shelf, or still in the air, is not in the way.
      if (pallet.position.y > PALLET_SOLID_MAX_Y) continue

      const palletHalf = pallet.footprint
      const rect = scratch.otherRect
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
        heading: truck.heading,
        forkTipOffset: geometry.forkTipOffset,
        forkReach: geometry.forkReach,
      })
      const forksEntering = engagement.canEnter && forks.height <= FORK_ENGAGE_HEIGHT

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
    truck.speed = 0
  } else {
    truck.x = nextX
    truck.z = nextZ
  }
}

// Cone and wall/vehicle hits, checked against the truck's committed position.
// Cones are exact point-vs-oriented-rectangle (cone position against the
// truck's own footprint) - the same technique the wall check uses, rather
// than approximating the body as fixed-radius circles along the centreline,
// which overshot right at each sample point but left gaps between them.
// Always on - a cone is a hazard however the course authored it.
export function stepCollisionHazards(state, world, dt) {
  const { truck, cones, frame } = state
  const { liveCones, liveWalls, halfWidth, halfLength, bodySampleOffsets, scratch } = world
  const { forwardX, forwardZ } = frame
  const body = scratch.bodyRect

  if (liveCones.length && !state.failed && Math.abs(truck.speed) > CONE_MIN_HIT_SPEED) {
    body.x = truck.x
    body.z = truck.z
    for (let i = 0; i < liveCones.length && !state.failed; i += 1) {
      const cone = liveCones[i]
      if (cones[i].hit) continue
      const dx = cone.position[0] - truck.x
      const dz = cone.position[2] - truck.z
      if (distanceToOrientedRect(cone.position[0], cone.position[2], body) <= CONE_RADIUS) {
        const len = Math.hypot(dx, dz) || 1
        cones[i] = { hit: true, angle: 0, dirX: dx / len, dirZ: dz / len }
        triggerFail(state, 'cone')
      }
    }
  }

  // Knocked-over cones keep falling after the fail freeze. syncView turns
  // the angle and direction into the cone's pose.
  cones.forEach((sim) => {
    if (!sim.hit || sim.angle >= CONE_FALL_ANGLE) return
    sim.angle = Math.min(sim.angle + CONE_FALL_SPEED * dt * Math.max(0.15, 1 - sim.angle / CONE_FALL_ANGLE), CONE_FALL_ANGLE)
  })

  // Wall/vehicle collision: sample the same body points against every
  // decoration's oriented rectangle (thickness x length, or a parked
  // vehicle's footprint). Immovable, so a hit just fails the attempt.
  if (liveWalls.length && !state.failed && Math.abs(truck.speed) > CONE_MIN_HIT_SPEED) {
    const wallRect = scratch.otherRect
    wallLoop: for (const wall of liveWalls) {
      const isVehicle = decorationType(wall) === 'vehicle'
      wallRect.x = wall.position[0]
      wallRect.z = wall.position[2]
      wallRect.rotation = wall.rotation || 0
      wallRect.halfX = isVehicle ? halfWidth : WALL_HALF_THICKNESS
      wallRect.halfZ = isVehicle ? halfLength : (wall.length || 3) / 2
      for (const offset of bodySampleOffsets) {
        const sampleX = truck.x + forwardX * offset
        const sampleZ = truck.z + forwardZ * offset
        if (pointInOrientedRect(sampleX, sampleZ, wallRect, WALL_HIT_MARGIN)) {
          triggerFail(state, isVehicle ? 'vehicle' : 'wall')
          break wallLoop
        }
      }
    }
  }
}
