import {
  FORK_MAX_HEIGHT,
  LIFT_RAMP_SECONDS,
  LIFT_SPEED,
  LOWER_SPEED,
  TILT_BACK_MAX,
  TILT_FORWARD_MAX,
  TILT_SPEED,
} from './constants.js'
import { tineClearance } from './forkPose.js'

// Move `value` toward `target` by at most `step`.
const approach = (value, target, step) => (value < target ? Math.min(value + step, target) : Math.max(value - step, target))

// Wheel roll, fork lift and mast tilt, as state. syncView copies them onto
// the rig nodes, and stepPhysics moves the fork colliders to match. (The
// rear-wheel steer angle is stepDrive's, since the bicycle model turns the
// truck by it.) Must run before stepPhysics and stepPallet, which build the
// carriage pose (forkPose.js) from the fork height and tilt this writes.
//
// The forks are solid. They stop at the floor: the carriage will not lower,
// and the mast will not tilt forward, past the point where the tines touch
// it. And they stop against racking and walls (state.limits, which
// stepPhysics read off the contacts of the step before).
//
// A leaking lift cylinder (the liftDrift control fault, controlFaults.js)
// lets raised forks sink while the lift lever is released, engine running or
// not, down to where the tines meet the floor or something under them.
export function stepForks(state, world, dt) {
  const { truck, forks, frame, limits, faults } = state
  const { controls, controlsLocked } = frame
  const { geometry } = world

  truck.wheelTravel += truck.speed * dt

  const live = truck.engineOn && !controlsLocked
  const lift = live ? controls.lift : 0
  const tilt = live ? controls.tilt : 0

  // The lift valve opens and closes over LIFT_RAMP_SECONDS.
  const targetRate = lift > 0 ? LIFT_SPEED * lift : LOWER_SPEED * lift
  forks.liftRate = approach(forks.liftRate, targetRate, (LIFT_SPEED / LIFT_RAMP_SECONDS) * dt)
  if ((forks.liftRate > 0 && limits.lift) || (forks.liftRate < 0 && limits.lower)) forks.liftRate = 0

  if (forks.liftRate !== 0) {
    const height = Math.min(Math.max(forks.height + forks.liftRate * dt, 0), FORK_MAX_HEIGHT)
    // Lowering stops where the tines meet the floor (their heels, with the
    // mast tilted back; their tips, tilted forward).
    if (forks.liftRate > 0 || tineClearance(height, forks.tilt, geometry) >= 0) forks.height = height
    if (forks.height !== height || height === 0 || height === FORK_MAX_HEIGHT) forks.liftRate = 0
  }

  if (faults.liftDrift > 0 && lift === 0 && forks.liftRate === 0 && forks.height > 0 && !limits.lower) {
    const height = Math.max(forks.height - faults.liftDrift * dt, 0)
    if (tineClearance(height, forks.tilt, geometry) >= 0) forks.height = height
  }

  if (tilt < 0) {
    forks.tilt = Math.max(forks.tilt + TILT_SPEED * tilt * dt, -TILT_BACK_MAX)
  } else if (tilt > 0) {
    const next = Math.min(forks.tilt + TILT_SPEED * tilt * dt, TILT_FORWARD_MAX)
    // Tilting forward lowers the tips: it stops where they meet the floor.
    if (tineClearance(forks.height, next, geometry) >= 0) forks.tilt = next
  }
}
