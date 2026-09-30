import { PALLET_IMPACT_SPEED } from '../../data/physicsProfile.js'
import { RACK_STRIKE_SPEED } from '../../data/rackProfile.js'
import { orientedRectOverlap, pointInOrientedRect } from '../simCollision.js'
import { decorationType } from '../courseEdit.js'
import { triggerFail } from './stepFail.js'
import { CONE_MIN_HIT_SPEED, RACK_HIT_MARGIN, WALL_HALF_THICKNESS, WALL_HIT_MARGIN } from './constants.js'

// What the truck may not drive through, and what happens when it tries.
//
// The truck is kinematic: its drive model decides where it goes, so nothing
// in the physics world can stop it. Two things here do.
// - Its body against racking is the 2D test it always was (lib/simCollision.js,
//   shared with the backend's course validator): the move is refused, and
//   above RACK_STRIKE_SPEED it is a strike.
// - Its forks, and a load on them, against racking, walls and parked
//   vehicles come from the physics world's contacts (state.limits, read by
//   stepPhysics after the step before): a move further into one is refused.
//
// Pallets and cones are not here. They are dynamic bodies: the truck pushes
// them, and what that does is stepCollisionHazards' to judge.
//
// Resolves stepDrive's intended pose (nextX/nextZ/nextHeading) and commits the
// result to the truck. A blocked move keeps the old pose entirely, heading
// included: with rear-wheel steer the tail swings as the truck turns, so
// turning is movement too. Must run before stepForks/stepPhysics/stepPallet,
// which read the committed pose.
export function stepCollisionBody(state, world) {
  const { truck, frame, limits } = state
  const { halfWidth, halfLength, rackColliders, scratch } = world
  const { nextX, nextZ, nextHeading } = frame

  const body = scratch.bodyRect
  body.x = nextX
  body.z = nextZ
  body.rotation = nextHeading
  body.halfX = halfWidth
  body.halfZ = halfLength

  // Only a move that pushes *deeper* into an object is rejected. Testing raw
  // overlap instead would trap the truck the moment it ended up inside
  // something.
  const worsensOverlap = (rect, margin = 0) => {
    const next = orientedRectOverlap(body, rect, margin)
    if (!next) return null
    body.x = truck.x
    body.z = truck.z
    body.rotation = truck.heading
    const now = orientedRectOverlap(body, rect, margin)
    body.x = nextX
    body.z = nextZ
    body.rotation = nextHeading
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

  // The forks, or the load on them, are against something that does not
  // move. Travelling further into it is refused; backing off is not.
  if (!blocked) {
    const moveX = nextX - truck.x
    const moveZ = nextZ - truck.z
    for (const limit of limits.travel) {
      if (moveX * limit.nx + moveZ * limit.nz <= 1e-9) continue
      blocked = true
      const strikeSpeed = limit.kind === 'rack' ? RACK_STRIKE_SPEED : CONE_MIN_HIT_SPEED
      if (Math.abs(truck.speed) > strikeSpeed) triggerFail(state, limit.kind)
      break
    }
  }

  if (blocked) {
    truck.speed = 0
    frame.forwardX = Math.sin(truck.heading)
    frame.forwardZ = Math.cos(truck.heading)
    frame.lateralAccel = 0
    frame.yawRate = 0
  } else {
    truck.x = nextX
    truck.z = nextZ
    truck.heading = nextHeading
  }
}

// A wall's or parked vehicle's rect (world.liveWalls entry), written into
// `rect`: a wall is thickness x length, and a parked vehicle has the truck's
// own footprint, since it is the same model.
export function wallRectInto(rect, wall, world) {
  const isVehicle = decorationType(wall) === 'vehicle'
  rect.x = wall.position[0]
  rect.z = wall.position[2]
  rect.rotation = wall.rotation || 0
  rect.halfX = isVehicle ? world.halfWidth : WALL_HALF_THICKNESS
  rect.halfZ = isVehicle ? world.halfLength : (wall.length || 3) / 2
  return rect
}

// What the truck hit this step, checked after the physics has stepped.
// - A cone the truck, its forks or the load on them touched: always a fail.
//   A cone is a hazard however the course authored it. (stepPhysics marks
//   it; the cone itself is knocked about by the physics.)
// - A pallet the truck's body or forks struck faster than
//   PALLET_IMPACT_SPEED along the line of contact. Sliding the tines into
//   the pockets touches nothing, and meeting the pallet's face with the
//   carriage at walking pace is how a load is seated.
// - A wall or a parked vehicle under the truck's body: the same 2D test as
//   before.
export function stepCollisionHazards(state, world) {
  const { truck, frame } = state
  const { liveWalls, bodySampleOffsets, scratch } = world
  const { forwardX, forwardZ } = frame

  for (const impact of frame.impacts || []) {
    if (impact.what === 'cone' && impact.byTruck) triggerFail(state, 'cone')
    else if (impact.what === 'pallet' && impact.byTruck && impact.speed > PALLET_IMPACT_SPEED) triggerFail(state, 'pallet-impact')
  }

  // Wall/vehicle collision: sample the same body points against every
  // decoration's oriented rectangle (thickness x length, or a parked
  // vehicle's footprint). Immovable, so a hit just fails the attempt.
  if (liveWalls.length && !state.failed && Math.abs(truck.speed) > CONE_MIN_HIT_SPEED) {
    const wallRect = scratch.otherRect
    wallLoop: for (const wall of liveWalls) {
      const isVehicle = decorationType(wall) === 'vehicle'
      wallRectInto(wallRect, wall, world)
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
