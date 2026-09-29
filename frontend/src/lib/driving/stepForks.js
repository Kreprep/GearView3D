import { FORK_MAX_HEIGHT, FORK_SPEED, MAX_STEER_ANGLE, STEER_DAMP, STEER_SIGN, TILT_MAX_ANGLE, TILT_SPEED } from './constants.js'

// Wheel roll, rear-wheel steering, fork lift and mast tilt, as state. syncView
// copies them onto the rig nodes. Must run before stepPallet, which builds the
// carriage pose (forkPose.js) from the fork height and tilt this writes.
export function stepForks(state, dt) {
  const { truck, forks, frame } = state
  const { controls, controlsLocked, turnInput } = frame

  truck.wheelTravel += truck.speed * dt

  const steerTarget = truck.engineOn && !controlsLocked ? turnInput * MAX_STEER_ANGLE * STEER_SIGN : 0
  truck.steer += (steerTarget - truck.steer) * Math.min(STEER_DAMP * dt, 1)

  if (truck.engineOn && !controlsLocked) {
    if (controls.lift > 0) {
      forks.height = Math.min(forks.height + FORK_SPEED * controls.lift * dt, FORK_MAX_HEIGHT)
    } else if (controls.lift < 0) {
      forks.height = Math.max(forks.height + FORK_SPEED * controls.lift * dt, 0)
    }
    if (controls.tilt < 0) {
      forks.tilt = Math.max(forks.tilt + TILT_SPEED * controls.tilt * dt, -TILT_MAX_ANGLE)
    } else if (controls.tilt > 0) {
      forks.tilt = Math.min(forks.tilt + TILT_SPEED * controls.tilt * dt, TILT_MAX_ANGLE)
    }
  }
}
