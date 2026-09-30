import { FORK_MAX_HEIGHT, LIFT_SPEED, LOWER_SPEED, TILT_BACK_MAX, TILT_FORWARD_MAX, TILT_SPEED } from './constants.js'

// Wheel roll, fork lift and mast tilt, as state. syncView copies them onto
// the rig nodes. (The rear-wheel steer angle is stepDrive's, since the
// bicycle model turns the truck by it.) Must run before stepPallet, which
// builds the carriage pose (forkPose.js) from the fork height and tilt this
// writes.
export function stepForks(state, dt) {
  const { truck, forks, frame } = state
  const { controls, controlsLocked } = frame

  truck.wheelTravel += truck.speed * dt

  if (truck.engineOn && !controlsLocked) {
    if (controls.lift > 0) {
      forks.height = Math.min(forks.height + LIFT_SPEED * controls.lift * dt, FORK_MAX_HEIGHT)
    } else if (controls.lift < 0) {
      forks.height = Math.max(forks.height + LOWER_SPEED * controls.lift * dt, 0)
    }
    if (controls.tilt < 0) {
      forks.tilt = Math.max(forks.tilt + TILT_SPEED * controls.tilt * dt, -TILT_BACK_MAX)
    } else if (controls.tilt > 0) {
      forks.tilt = Math.min(forks.tilt + TILT_SPEED * controls.tilt * dt, TILT_FORWARD_MAX)
    }
  }
}
