import { clamp } from '../math'
import { ACCEL, BRAKE_DECEL, DRAG, MAX_REVERSE_SPEED, MAX_SPEED, REVERSE_ACCEL, STOP_SPEED_EPSILON, TURN_RATE } from './constants'

// Reads the held keys and integrates speed/heading/intended-next-position for
// this frame. Writes ctx.frame.{keys, controlsLocked, turnInput, prevSpeed,
// forwardX, forwardZ, nextX, nextZ} for the steps that follow (stepCollision
// resolves nextX/nextZ against obstacles before it reaches posRef).
export function stepDrive(ctx, dt) {
  const { keysRef, failedRef, prevSpeedRef, speedRef, engineOnRef, headingRef, posRef, groundHalfWidth, courseMinZ, courseMaxZ, frame } = ctx

  const keys = keysRef.current
  const controlsLocked = failedRef.current
  const turnInput = controlsLocked ? 0 : (keys.left ? 1 : 0) - (keys.right ? 1 : 0)
  const prevSpeed = prevSpeedRef.current

  if (controlsLocked) {
    if (speedRef.current > 0) {
      speedRef.current = Math.max(speedRef.current - BRAKE_DECEL * dt, 0)
    } else if (speedRef.current < 0) {
      speedRef.current = Math.min(speedRef.current + BRAKE_DECEL * dt, 0)
    }
  } else if (engineOnRef.current) {
    if (keys.forward) {
      speedRef.current = Math.min(speedRef.current + ACCEL * dt, MAX_SPEED)
    } else if (keys.back) {
      speedRef.current = speedRef.current > STOP_SPEED_EPSILON
        ? Math.max(speedRef.current - BRAKE_DECEL * dt, 0)
        : Math.max(speedRef.current - REVERSE_ACCEL * dt, -MAX_REVERSE_SPEED)
    } else if (speedRef.current > 0) {
      speedRef.current = Math.max(speedRef.current - DRAG * dt, 0)
    } else if (speedRef.current < 0) {
      speedRef.current = Math.min(speedRef.current + DRAG * dt, 0)
    }

    if (Math.abs(speedRef.current) > STOP_SPEED_EPSILON) {
      const turnScale = clamp(Math.abs(speedRef.current) / MAX_SPEED, 0.35, 1) * Math.sign(speedRef.current)
      headingRef.current += turnInput * TURN_RATE * dt * turnScale
    }
  } else if (speedRef.current > 0) {
    speedRef.current = Math.max(speedRef.current - DRAG * dt, 0)
  } else if (speedRef.current < 0) {
    speedRef.current = Math.min(speedRef.current + DRAG * dt, 0)
  }

  const forwardX = Math.sin(headingRef.current)
  const forwardZ = Math.cos(headingRef.current)
  const nextX = clamp(posRef.current.x + forwardX * speedRef.current * dt, -groundHalfWidth, groundHalfWidth)
  const nextZ = clamp(posRef.current.z + forwardZ * speedRef.current * dt, courseMinZ, courseMaxZ)

  frame.keys = keys
  frame.controlsLocked = controlsLocked
  frame.turnInput = turnInput
  frame.prevSpeed = prevSpeed
  frame.forwardX = forwardX
  frame.forwardZ = forwardZ
  frame.nextX = nextX
  frame.nextZ = nextZ
}
