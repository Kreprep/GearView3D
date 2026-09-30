import { Quaternion, Vector3 } from 'three'
import { REAR_WHEEL_KEYS } from '../vehicleRig.js'
import { LEVER_DAMP, LEVER_THROW, MAST_LIFT_RATIO, MAX_STEER_ANGLE, STEERING_WHEEL_LOCK } from './constants.js'

// The only code that writes simulation state onto three.js objects
// (docs/revisions/post-defense-plan.md, section 3.2). The sim steps own
// SimState; once per rendered frame this copies it onto the truck group, the
// rig nodes (wheels, steering, mast, carriage, the cab's steering wheel and
// hydraulic levers), the pallet groups and the cones. The pallets' and cones'
// poses in the state are their physics bodies', read back each step
// (stepPhysics.js), and so is the truck's own once it has tipped over.
//
// The sim runs at a fixed step (simLoop.js) while the display may refresh
// faster, so the moving poses are interpolated between the previous step and
// the current one by `alpha`. capturePose() records "previous" just before
// each step.

export function createPoseBuffer() {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    forkHeight: 0,
    tilt: 0,
    steer: 0,
    wheelTravel: 0,
    // The fallen truck's body, once there is one.
    fallen: null,
    pallets: [],
    cones: [],
  }
}

const captureBody = (buffer, index, body) => {
  if (!buffer[index]) buffer[index] = { position: new Vector3(), quaternion: new Quaternion() }
  buffer[index].position.copy(body.position)
  buffer[index].quaternion.copy(body.quaternion)
}

export function capturePose(state, pose) {
  const { truck, forks } = state
  pose.x = truck.x
  pose.y = truck.y
  pose.z = truck.z
  pose.heading = truck.heading
  pose.forkHeight = forks.height
  pose.tilt = forks.tilt
  pose.steer = truck.steer
  pose.wheelTravel = truck.wheelTravel
  if (state.tip.pose) {
    pose.fallen ||= { position: new Vector3(), quaternion: new Quaternion() }
    pose.fallen.position.copy(state.tip.pose.position)
    pose.fallen.quaternion.copy(state.tip.pose.quaternion)
  }
  state.pallets.forEach((pallet, index) => captureBody(pose.pallets, index, pallet))
  state.cones.forEach((cone, index) => captureBody(pose.cones, index, cone))
  return pose
}

const lerp = (from, to, alpha) => from + (to - from) * alpha

// A physics body's pose onto its scene object, between the last two steps.
const syncBody = (object, from, body, alpha) => {
  if (!object) return
  if (!from) {
    object.position.copy(body.position)
    object.quaternion.copy(body.quaternion)
    return
  }
  object.position.lerpVectors(from.position, body.position, alpha)
  object.quaternion.slerpQuaternions(from.quaternion, body.quaternion, alpha)
}

// How far each hydraulic lever leans for the operator's input: pulled back
// (toward the seat, a negative angle about +X) to raise and to tilt back.
const LEVER_TARGETS = {
  lift: (controls) => -controls.lift * LEVER_THROW,
  tilt: (controls) => controls.tilt * LEVER_THROW,
}

// `view`: { truckGroup, rig, palletObjects[], coneObjects[] } -
// any of them may be missing (not mounted yet) and is then skipped. `dt` is
// the render delta, which eases the levers toward the input.
// Returns the rendered truck pose, for the camera.
export function syncView(view, state, prev, alpha, world, dt = 0) {
  const { truck, forks } = state
  const x = lerp(prev.x, truck.x, alpha)
  const y = lerp(prev.y, truck.y, alpha)
  const z = lerp(prev.z, truck.z, alpha)
  const heading = lerp(prev.heading, truck.heading, alpha)
  const forkHeight = lerp(prev.forkHeight, forks.height, alpha)
  const tilt = lerp(prev.tilt, forks.tilt, alpha)

  // A truck that has tipped over is a physics body: the group takes its pose
  // whole, whatever way up it is.
  if (state.tip.pose) syncBody(view.truckGroup, prev.fallen, state.tip.pose, alpha)
  else if (view.truckGroup) {
    view.truckGroup.position.set(x, y, z)
    view.truckGroup.rotation.set(0, heading, 0)
  }

  const rig = view.rig
  if (rig) {
    const travel = lerp(prev.wheelTravel, truck.wheelTravel, alpha)
    const steer = lerp(prev.steer, truck.steer, alpha)
    for (const [key, wheel] of Object.entries(rig.wheels)) {
      wheel.spin.rotation.x = travel / wheel.radius
      if (REAR_WHEEL_KEYS.includes(key) && wheel.steer) wheel.steer.rotation.y = steer
    }
    if (rig.carriageLift) rig.carriageLift.position.y = forkHeight
    if (rig.mastLift) rig.mastLift.position.y = forkHeight * MAST_LIFT_RATIO
    if (rig.tiltPivot) rig.tiltPivot.rotation.x = tilt
    // A physical steering wheel shows its own rotation. Otherwise full
    // rear-wheel lock (steer is negative for a left turn) turns the wheel
    // STEERING_WHEEL_LOCK anticlockwise, as the operator sees it. Before the
    // first step there are no controls yet.
    const controls = state.frame.controls
    if (rig.steeringWheel) {
      const wheelAngle = controls?.steeringWheelAngle ?? (-steer / MAX_STEER_ANGLE) * STEERING_WHEEL_LOCK
      rig.steeringWheel.pivot.quaternion.setFromAxisAngle(rig.steeringWheel.axis, wheelAngle)
    }
    // The levers follow the operator's hands, not the hydraulics, so they
    // move with the engine off too.
    for (const [input, lever] of Object.entries(rig.levers || {})) {
      const target = controls ? LEVER_TARGETS[input](controls) : 0
      lever.angle += (target - lever.angle) * Math.min(LEVER_DAMP * dt, 1)
      lever.pivot.quaternion.setFromAxisAngle(lever.axis, lever.angle)
    }
  }

  state.pallets.forEach((pallet, index) => syncBody(view.palletObjects?.[index], prev.pallets[index], pallet, alpha))
  // A cone nothing has touched stands where the course put it.
  state.cones.forEach((cone, index) => {
    if (cone.hit) syncBody(view.coneObjects?.[index], prev.cones[index], cone, alpha)
  })

  return { x, y, z, heading, forwardX: Math.sin(heading), forwardZ: Math.cos(heading) }
}
