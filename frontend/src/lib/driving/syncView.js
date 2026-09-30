import { Quaternion, Vector3 } from 'three'
import { REAR_WHEEL_KEYS } from '../vehicleRig.js'
import { LEVER_DAMP, LEVER_THROW, MAST_LIFT_RATIO, MAX_STEER_ANGLE, STEERING_WHEEL_LOCK } from './constants.js'

// The only code that writes simulation state onto three.js objects
// (docs/revisions/post-defense-plan.md, section 3.2). The sim steps own
// SimState; once per rendered frame this copies it onto the truck group, the
// tip pivot, the rig nodes (wheels, steering, mast, carriage, the cab's
// steering wheel and hydraulic levers), the pallet groups and the cones.
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
    tipAngle: 0,
    wheelTravel: 0,
    pallets: [],
  }
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
  pose.tipAngle = state.tip.angle
  pose.wheelTravel = truck.wheelTravel
  state.pallets.forEach((pallet, index) => {
    if (!pose.pallets[index]) pose.pallets[index] = { position: new Vector3(), quaternion: new Quaternion() }
    pose.pallets[index].position.copy(pallet.position)
    pose.pallets[index].quaternion.setFromEuler(pallet.rotation)
  })
  return pose
}

const lerp = (from, to, alpha) => from + (to - from) * alpha
const palletQuat = new Quaternion()
const coneAxis = new Vector3()
const coneQuat = new Quaternion()

// How far each hydraulic lever leans for the operator's input: pulled back
// (toward the seat, a negative angle about +X) to raise and to tilt back.
const LEVER_TARGETS = {
  lift: (controls) => -controls.lift * LEVER_THROW,
  tilt: (controls) => controls.tilt * LEVER_THROW,
}

// `view`: { truckGroup, tipPivot, rig, palletObjects[], coneObjects[] } -
// any of them may be missing (not mounted yet) and is then skipped.
// `world.liveCones` gives each cone's authored position. `dt` is the render
// delta, which eases the levers toward the input.
// Returns the rendered truck pose, for the camera.
export function syncView(view, state, prev, alpha, world, dt = 0) {
  const { truck, forks } = state
  const x = lerp(prev.x, truck.x, alpha)
  const y = lerp(prev.y, truck.y, alpha)
  const z = lerp(prev.z, truck.z, alpha)
  const heading = lerp(prev.heading, truck.heading, alpha)
  const forkHeight = lerp(prev.forkHeight, forks.height, alpha)
  const tilt = lerp(prev.tilt, forks.tilt, alpha)

  if (view.truckGroup) {
    view.truckGroup.position.set(x, y, z)
    view.truckGroup.rotation.y = heading
  }
  if (view.tipPivot) view.tipPivot.rotation.x = lerp(prev.tipAngle, state.tip.angle, alpha)

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

  state.pallets.forEach((pallet, index) => {
    const object = view.palletObjects?.[index]
    const from = prev.pallets[index]
    if (!object) return
    if (!from) {
      object.position.copy(pallet.position)
      object.rotation.copy(pallet.rotation)
      return
    }
    object.position.lerpVectors(from.position, pallet.position, alpha)
    object.quaternion.slerpQuaternions(from.quaternion, palletQuat.setFromEuler(pallet.rotation), alpha)
  })

  // A knocked cone tips about its base edge, away from the truck.
  state.cones.forEach((cone, index) => {
    const object = view.coneObjects?.[index]
    if (!object || !cone.hit) return
    const [coneX, , coneZ] = world.liveCones[index].position
    coneAxis.set(cone.dirZ, 0, -cone.dirX)
    object.quaternion.copy(coneQuat.setFromAxisAngle(coneAxis, cone.angle))
    object.position.x = coneX + cone.dirX * cone.angle * 0.12
    object.position.z = coneZ + cone.dirZ * cone.angle * 0.12
  })

  return { x, y, z, heading, forwardX: Math.sin(heading), forwardZ: Math.cos(heading) }
}
