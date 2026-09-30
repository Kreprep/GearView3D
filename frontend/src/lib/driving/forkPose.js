import { Matrix4, Vector3 } from 'three'
import { TINE, TINE_HEEL_Z, TINE_REST_Y } from '../../data/physicsProfile.js'
import { FORKLIFT_RIG_GEOMETRY } from './rigGeometry.js'

// The truck's and the carriage's world transforms, computed from SimState
// alone rather than read off the rendered nodes, so the sim runs without a
// scene (docs/revisions/post-defense-plan.md, section 3.2).
//
// They reproduce the chain DrivingScene renders and buildVehicleRig builds:
//   truck group   translate(x, y, z) * rotateY(heading)
//   tilt pivot    translate(mastFoot) * rotateX(mast tilt)
//   carriage lift translate(0, forkHeight, 0)
// The carriage's local +Y runs up the tilted mast and +Z out along the tines.
//
// A truck that has tipped over is a physics body (lib/physics/world.js,
// releaseTruck), and `state.tip.pose` is where that body is: the truck group's
// transform is then the body's, whatever way up it has ended.
//
// three.js is used for its matrix maths only; it runs fine under Node.

const scratch = new Matrix4()
const ONE = new Vector3(1, 1, 1)

// The truck body's world transform.
export function chassisPose(state, target = new Matrix4()) {
  const { truck, tip } = state
  if (tip.pose) return target.compose(tip.pose.position, tip.pose.quaternion, ONE)
  target.makeTranslation(truck.x, truck.y, truck.z)
  return target.multiply(scratch.makeRotationY(truck.heading))
}

// The carriage in the truck's own frame: at the mast foot, tilted with the
// mast, raised by the fork height.
export function carriageInTruck(forks, geometry = FORKLIFT_RIG_GEOMETRY, target = new Matrix4()) {
  const [footX, footY, footZ] = geometry.mastFoot
  target.makeTranslation(footX, footY, footZ)
  target.multiply(scratch.makeRotationX(forks.tilt))
  return target.multiply(scratch.makeTranslation(0, forks.height, 0))
}

const carriage = new Matrix4()

export function forkPose(state, geometry = FORKLIFT_RIG_GEOMETRY, target = new Matrix4()) {
  carriageInTruck(state.forks, geometry, carriage)
  return chassisPose(state, target).multiply(carriage)
}

// The height above the floor of the lowest point of the tines' underside,
// wherever the truck is: standing, or gone over onto its fork tips.
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
