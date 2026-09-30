import { Matrix4, Vector3 } from 'three'
import { TINE, TINE_HEEL_Z, TINE_REST_Y } from '../../data/physicsProfile.js'
import { FORKLIFT_RIG_GEOMETRY } from './rigGeometry.js'

// The truck's and the carriage's world transforms, computed from SimState
// alone rather than read off the rendered nodes, so the sim runs without a
// scene (docs/revisions/post-defense-plan.md, section 3.2).
//
// They reproduce the chain DrivingScene renders and buildVehicleRig builds:
//   truck group   translate(x, y, z) * rotateY(heading)
//   tip           the tip-over, about the front axle or a side of the
//                 stability triangle (tipMatrix below)
//   tilt pivot    translate(mastFoot) * rotateX(mast tilt)
//   carriage lift translate(0, forkHeight, 0)
// The carriage's local +Y runs up the tilted mast and +Z out along the tines.
//
// three.js is used for its matrix maths only; it runs fine under Node.

const scratch = new Matrix4()
const tipScratch = new Matrix4()
const axis = new Vector3()

// The tip-over as a transform in the truck's own frame.
// - 'forward' pitches the truck about its front axle, until the forks meet
//   the ground.
// - 'left' / 'right' rolls it about that side of the stability triangle: the
//   line from the front wheel's contact patch to the rear axle's pivot.
export function tipMatrix(tip, geometry = FORKLIFT_RIG_GEOMETRY, target = new Matrix4()) {
  if (!tip.angle) return target.identity()
  if (tip.axis === 'left' || tip.axis === 'right') {
    const side = tip.axis === 'left' ? 1 : -1
    // Along that edge, pointing so that a positive angle lays the truck over
    // onto that side: back down the left edge, forward up the right one.
    axis.set(-geometry.frontTrackHalf, 0, side * (geometry.rearAxleZ - geometry.frontAxleZ)).normalize()
    return target
      .makeTranslation(0, 0, geometry.rearAxleZ)
      .multiply(tipScratch.makeRotationAxis(axis, tip.angle))
      .multiply(tipScratch.makeTranslation(0, 0, -geometry.rearAxleZ))
  }
  const [, pivotY, pivotZ] = geometry.tipPivot
  return target
    .makeTranslation(0, pivotY, pivotZ)
    .multiply(tipScratch.makeRotationX(tip.angle))
    .multiply(tipScratch.makeTranslation(0, -pivotY, -pivotZ))
}

// The truck body's world transform.
export function chassisPose(state, geometry = FORKLIFT_RIG_GEOMETRY, target = new Matrix4()) {
  const { truck, tip } = state
  target.makeTranslation(truck.x, truck.y, truck.z)
  target.multiply(scratch.makeRotationY(truck.heading))
  return target.multiply(tipMatrix(tip, geometry, scratch))
}

export function forkPose(state, geometry = FORKLIFT_RIG_GEOMETRY, target = new Matrix4()) {
  const { forks } = state
  const [footX, footY, footZ] = geometry.mastFoot

  chassisPose(state, geometry, target)
  target.multiply(scratch.makeTranslation(footX, footY, footZ))
  target.multiply(scratch.makeRotationX(forks.tilt))
  target.multiply(scratch.makeTranslation(0, forks.height, 0))
  return target
}

// The height above the floor of the lowest point of the tines' underside,
// with the truck wherever its tip-over has put it: a truck pitching forward
// comes down on its fork tips.
const tinePoint = new Vector3()
const tineMatrix = new Matrix4()
export function tineGroundClearance(state, geometry = FORKLIFT_RIG_GEOMETRY) {
  const [, footY, footZ] = geometry.mastFoot
  forkPose(state, geometry, tineMatrix)
  const heightOf = (z) => tinePoint.set(0, TINE_REST_Y - footY, z - footZ).applyMatrix4(tineMatrix).y
  return Math.min(heightOf(TINE_HEEL_Z), heightOf(TINE_HEEL_Z + TINE.length))
}

// How far the lowest point of the tines' underside is above the floor, for a
// truck standing level: the tips with the mast tilted forward, the heels with
// it tilted back. Negative would be through the floor, which stepForks does
// not allow.
export function tineClearance(height, tilt, geometry = FORKLIFT_RIG_GEOMETRY) {
  const [, footY, footZ] = geometry.mastFoot
  const y = TINE_REST_Y + height - footY
  const along = (z) => footY + y * Math.cos(tilt) - (z - footZ) * Math.sin(tilt)
  return Math.min(along(TINE_HEEL_Z), along(TINE_HEEL_Z + TINE.length))
}
