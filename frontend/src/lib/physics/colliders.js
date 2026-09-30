// Collider shapes for the driving simulation's physics world, built from the
// measured data in data/physicsProfile.js (docs/revisions/post-defense-plan.md,
// section 4.6). Everything here is plain geometry: boxes as
// { center, half } in their body's frame, scene units. lib/physics/world.js
// turns them into Rapier colliders.
import { RACK_LEVELS, RACK_MODEL_SCALE } from '../../data/rackProfile.js'
import { CHASSIS_Y, FORK_COLLIDERS, PARKED_VEHICLE_HEIGHT, RACK_RAW, TINE_HEEL_Z, TINE_REST_Y, WALL } from '../../data/physicsProfile.js'

const boxBetween = ([x0, x1], [y0, y1], [z0, z1]) => ({
  center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  half: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2],
})

// The truck's body over its footprint (the vehicle profile's half-extents),
// from `bottom` up.
export function chassisCollider({ halfWidth, halfLength }, bottom = CHASSIS_Y[0]) {
  return boxBetween([-halfWidth, halfWidth], [bottom, CHASSIS_Y[1]], [-halfLength, halfLength])
}

// Where a truck stands: its two front wheels' contact patches and the rear
// axle's pivot, in its own frame. `geometry` is the rig's.
export function truckFeet({ frontAxleZ, rearAxleZ, frontTrackHalf }) {
  return [
    [frontTrackHalf, 0, frontAxleZ],
    [-frontTrackHalf, 0, frontAxleZ],
    [0, 0, rearAxleZ],
  ]
}

// The two tines and the load backrest in the carriage body's frame, which is
// forkPose()'s: its origin is the mast foot, raised by the fork height.
// `mastFoot` is the rig's. Each is tagged with its part.
export function forkColliders(mastFoot) {
  const [, footY, footZ] = mastFoot
  return FORK_COLLIDERS.map(({ center, half }, index) => ({
    part: index < 2 ? 'tine' : 'backrest',
    center: [center[0], TINE_REST_Y + center[1] - footY, TINE_HEEL_Z + center[2] - footZ],
    half,
  }))
}

// pallet-racking.glb as boxes in the rack's own frame, at the scale the
// viewer draws it (data/rackProfile.js): the four posts of the two end
// frames, and per level a front and a back beam and the decking a pallet
// rests on. There are no uprights between the three bays.
export function rackColliders([scaleX, scaleY, scaleZ] = RACK_MODEL_SCALE) {
  const { uprightX, uprightPostZ, height, levelPitch, beam, decking } = RACK_RAW
  const scaled = (box) => ({
    center: [box.center[0] * scaleX, box.center[1] * scaleY, box.center[2] * scaleZ],
    half: [box.half[0] * scaleX, box.half[1] * scaleY, box.half[2] * scaleZ],
  })
  const mirrored = ([a, b]) => [[a, b], [-b, -a]]
  const boxes = []

  for (const x of mirrored(uprightX)) {
    for (const z of mirrored(uprightPostZ)) boxes.push({ part: 'upright', ...scaled(boxBetween(x, [0, height], z)) })
  }
  RACK_LEVELS.forEach((level, index) => {
    const lift = index * levelPitch
    const y = (range) => [range[0] + lift, range[1] + lift]
    for (const z of mirrored(beam.z)) {
      boxes.push({ part: 'beam', level, ...scaled(boxBetween([-beam.halfLength, beam.halfLength], y(beam.y), z)) })
    }
    boxes.push({
      part: 'deck',
      level,
      ...scaled(boxBetween([-decking.halfLength, decking.halfLength], y(decking.y), [-decking.halfDepth, decking.halfDepth])),
    })
  })
  return boxes
}

// A course wall (thickness x height x length, along its own Z), and a parked
// truck's body.
export function wallCollider(length) {
  return boxBetween([-WALL.thickness / 2, WALL.thickness / 2], [0, WALL.height], [-length / 2, length / 2])
}

export function parkedVehicleCollider({ halfWidth, halfLength }) {
  return boxBetween([-halfWidth, halfWidth], [0, PARKED_VEHICLE_HEIGHT], [-halfLength, halfLength])
}

export const boxVolume = ({ half }) => 8 * half[0] * half[1] * half[2]
