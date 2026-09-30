import { clamp } from '../math.js'
import {
  BRAKE_DECEL,
  COAST_DECEL,
  DRIVE_ACCEL,
  INCHING_BRAKE_START,
  MAX_REVERSE_SPEED,
  MAX_SPEED,
  MAX_STEER_ANGLE,
  STEER_DAMP,
  STEER_SIGN,
} from './constants.js'
import { wheelbase } from './rigGeometry.js'

// Move `speed` toward `target` by at most `step`.
const approach = (speed, target, step) => (speed < target ? Math.min(speed + step, target) : Math.max(speed - step, target))

// The drive train, as the operator's controls work it on an IC counterbalance
// truck (docs/revisions/post-defense-plan.md, section 4.3):
// - The direction lever picks F or R. In N the throttle only revs the engine.
// - Throttle sets a target speed in the lever's direction, which the truck
//   accelerates toward at DRIVE_ACCEL times the pedal (less pedal, less
//   torque, so part throttle both pulls gently and tops out lower). Opposite
//   the way the truck is rolling,
//   that decelerates it first (shuttling the lever while moving is allowed; the
//   direction-change-moving safety rule logs it).
// - The service brake decelerates at up to BRAKE_DECEL at full pedal.
// - The inching pedal takes the drive away over its first travel and brakes
//   over the rest, so the forks can be worked at full revs while creeping.
// - The parking brake holds the truck: no drive, full braking.
// Returns the speed after one step.
export function driveSpeed(speed, controls, { engineOn, locked }, dt) {
  if (locked) return approach(speed, 0, BRAKE_DECEL * dt)

  const inching = clamp(controls.inching || 0, 0, 1)
  const inchingBrake = inching > INCHING_BRAKE_START ? (inching - INCHING_BRAKE_START) / (1 - INCHING_BRAKE_START) : 0
  const brake = controls.parkingBrake ? 1 : Math.max(controls.brake, inchingBrake)
  const drive = engineOn && !controls.parkingBrake ? controls.throttle * (1 - Math.min(inching / INCHING_BRAKE_START, 1)) : 0

  let next = speed
  if (drive > 0 && controls.direction !== 'N') {
    const target = controls.direction === 'F' ? drive * MAX_SPEED : -drive * MAX_REVERSE_SPEED
    // Past the target at part throttle the truck coasts back down to it.
    const pushing = controls.direction === 'F' ? next < target : next > target
    next = approach(next, target, (pushing ? DRIVE_ACCEL * drive : COAST_DECEL) * dt)
  } else {
    next = approach(next, 0, COAST_DECEL * dt)
  }
  if (brake > 0) next = approach(next, 0, BRAKE_DECEL * brake * dt)
  return next
}

// Integrates the rear-wheel steer angle, speed and the truck's motion from the
// operator controls, and works out the intended next pose. Writes
// state.frame.{controls, controlsLocked, turnInput, prevSpeed, lateralAccel,
// forwardX, forwardZ, nextX, nextZ, nextHeading} for the steps that follow
// (stepCollisionBody resolves the intended pose against obstacles before it
// commits it to the truck).
//
// Steering is a rear-wheel-steer bicycle model: the front axle rolls without
// slipping along the truck's heading at `speed`, and the truck yaws at
// v * tan(steer) / wheelbase about a point on the front axle line. So the
// truck origin (between the axles) swings sideways in a turn and the
// counterweight swings out, as a real forklift's tail does.
export function stepDrive(state, world, controls, dt) {
  const { truck, frame } = state
  const { groundHalfWidth, courseMinZ, courseMaxZ, geometry } = world

  const controlsLocked = state.failed
  const turnInput = controlsLocked ? 0 : controls.steer
  const prevSpeed = truck.prevSpeed

  // The rear wheels follow the steering (hydraulic, so only with the engine
  // running) with a short lag.
  const steerTarget = truck.engineOn && !controlsLocked ? turnInput * MAX_STEER_ANGLE * STEER_SIGN : 0
  truck.steer += (steerTarget - truck.steer) * Math.min(STEER_DAMP * dt, 1)

  truck.speed = driveSpeed(truck.speed, controls, { engineOn: truck.engineOn, locked: controlsLocked }, dt)

  // Positive yaw turns left (toward +X going forward); the rear wheels point
  // the other way (STEER_SIGN), hence the sign flip.
  const yawRate = (truck.speed * Math.tan(truck.steer * STEER_SIGN)) / wheelbase(geometry)
  const nextHeading = truck.heading + yawRate * dt
  const midHeading = truck.heading + (yawRate * dt) / 2

  // Advance the front axle's midpoint along the heading, then place the
  // origin behind it on the new heading.
  const axle = geometry.frontAxleZ
  const frontX = truck.x + Math.sin(truck.heading) * axle + Math.sin(midHeading) * truck.speed * dt
  const frontZ = truck.z + Math.cos(truck.heading) * axle + Math.cos(midHeading) * truck.speed * dt
  const forwardX = Math.sin(nextHeading)
  const forwardZ = Math.cos(nextHeading)

  frame.controls = controls
  frame.controlsLocked = controlsLocked
  frame.turnInput = turnInput
  frame.prevSpeed = prevSpeed
  // Sideways acceleration of the truck (v * yaw rate), which the load feels
  // in a turn (stepPallet's sharp-turn slip).
  frame.lateralAccel = truck.speed * yawRate
  frame.forwardX = forwardX
  frame.forwardZ = forwardZ
  frame.nextHeading = nextHeading
  frame.nextX = clamp(frontX - forwardX * axle, -groundHalfWidth, groundHalfWidth)
  frame.nextZ = clamp(frontZ - forwardZ * axle, courseMinZ, courseMaxZ)
}
