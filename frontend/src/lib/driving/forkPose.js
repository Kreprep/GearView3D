import { Matrix4 } from 'three'
import { FORKLIFT_RIG_GEOMETRY } from './rigGeometry.js'

// The carriage's world transform, computed from SimState alone rather than
// read off the rendered Lift_Carriage node's matrixWorld, so the sim runs
// without a scene (docs/revisions/post-defense-plan.md, section 3.2).
//
// It reproduces the chain DrivingScene renders and buildVehicleRig builds:
//   truck group   translate(x, y, z) * rotateY(heading)
//   tip pivot     about (0, TIP_PIVOT_Y, TIP_PIVOT_Z), rotateX(tip angle)
//   tilt pivot    translate(mastFoot) * rotateX(mast tilt)
//   carriage lift translate(0, forkHeight, 0)
// The carriage's local +Y runs up the tilted mast and +Z out along the tines.
//
// three.js is used for its matrix maths only; it runs fine under Node.

const scratch = new Matrix4()

export function forkPose(state, geometry = FORKLIFT_RIG_GEOMETRY, target = new Matrix4()) {
  const { truck, forks, tip } = state
  const [, pivotY, pivotZ] = geometry.tipPivot
  const [footX, footY, footZ] = geometry.mastFoot

  target.makeTranslation(truck.x, truck.y, truck.z)
  target.multiply(scratch.makeRotationY(truck.heading))
  target.multiply(scratch.makeTranslation(0, pivotY, pivotZ))
  target.multiply(scratch.makeRotationX(tip.angle))
  target.multiply(scratch.makeTranslation(0, -pivotY, -pivotZ))
  target.multiply(scratch.makeTranslation(footX, footY, footZ))
  target.multiply(scratch.makeRotationX(forks.tilt))
  target.multiply(scratch.makeTranslation(0, forks.height, 0))
  return target
}
