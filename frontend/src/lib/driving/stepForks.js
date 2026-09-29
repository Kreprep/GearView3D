import { REAR_WHEEL_KEYS } from '../vehicleRig'
import { FORK_MAX_HEIGHT, FORK_SPEED, MAST_LIFT_RATIO, MAX_STEER_ANGLE, STEER_DAMP, STEER_SIGN, TILT_MAX_ANGLE, TILT_SPEED } from './constants'

// Procedural part animation: wheel roll, rear-wheel steering, fork lift, mast
// tilt. Must run before stepPallet, which reads the carriage/tilt-pivot world
// transform this writes (forkHeightRef/tiltAngleRef feed captureGrip/applyGrip
// there).
export function stepForks(ctx, dt) {
  const { rigRef, speedRef, engineOnRef, steerAngleRef, forkHeightRef, tiltAngleRef, frame } = ctx
  const { keys, controlsLocked, turnInput } = frame

  const rig = rigRef.current
  if (!rig) return

  Object.values(rig.wheels).forEach((wheel) => {
    wheel.spin.rotation.x += (speedRef.current / wheel.radius) * dt
  })

  const steerTarget = engineOnRef.current && !controlsLocked ? turnInput * MAX_STEER_ANGLE * STEER_SIGN : 0
  steerAngleRef.current += (steerTarget - steerAngleRef.current) * Math.min(STEER_DAMP * dt, 1)
  REAR_WHEEL_KEYS.forEach((key) => {
    if (rig.wheels[key]?.steer) rig.wheels[key].steer.rotation.y = steerAngleRef.current
  })

  if (engineOnRef.current && !controlsLocked) {
    if (keys.raise) {
      forkHeightRef.current = Math.min(forkHeightRef.current + FORK_SPEED * dt, FORK_MAX_HEIGHT)
    } else if (keys.lower) {
      forkHeightRef.current = Math.max(forkHeightRef.current - FORK_SPEED * dt, 0)
    }
    if (rig.tiltPivot) {
      if (keys.tiltBack) {
        tiltAngleRef.current = Math.max(tiltAngleRef.current - TILT_SPEED * dt, -TILT_MAX_ANGLE)
      } else if (keys.tiltForward) {
        tiltAngleRef.current = Math.min(tiltAngleRef.current + TILT_SPEED * dt, TILT_MAX_ANGLE)
      }
    }
  }
  if (rig.carriageLift) rig.carriageLift.position.y = forkHeightRef.current
  if (rig.mastLift) rig.mastLift.position.y = forkHeightRef.current * MAST_LIFT_RATIO
  if (rig.tiltPivot) rig.tiltPivot.rotation.x = tiltAngleRef.current
}
