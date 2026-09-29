import { clamp } from '../math.js'
import { ACCEL, BRAKE_DECEL, DRAG, MAX_REVERSE_SPEED, MAX_SPEED, REVERSE_ACCEL, STOP_SPEED_EPSILON, TURN_RATE } from './constants.js'

// Integrates speed and heading from the operator controls and works out the
// intended next position. Writes state.frame.{controls, controlsLocked,
// turnInput, prevSpeed, forwardX, forwardZ, nextX, nextZ} for the steps that
// follow (stepCollisionBody resolves nextX/nextZ against obstacles before it
// reaches the truck's position).
//
// Throttle, brake and the direction lever are read the way the keyboard used
// to drive them (lib/driving/keyboardSource.js): throttle in F accelerates
// toward full forward speed, brake slows a moving truck, throttle in R
// reverses. At full input these are the original digital rates exactly.
export function stepDrive(state, world, controls, dt) {
  const { truck, frame } = state
  const { groundHalfWidth, courseMinZ, courseMaxZ } = world

  const controlsLocked = state.failed
  const turnInput = controlsLocked ? 0 : controls.steer
  const prevSpeed = truck.prevSpeed

  if (controlsLocked) {
    if (truck.speed > 0) {
      truck.speed = Math.max(truck.speed - BRAKE_DECEL * dt, 0)
    } else if (truck.speed < 0) {
      truck.speed = Math.min(truck.speed + BRAKE_DECEL * dt, 0)
    }
  } else if (truck.engineOn) {
    if (controls.direction === 'F' && controls.throttle > 0) {
      truck.speed = Math.min(truck.speed + ACCEL * controls.throttle * dt, MAX_SPEED)
    } else if (controls.brake > 0 && Math.abs(truck.speed) > STOP_SPEED_EPSILON) {
      truck.speed = truck.speed > 0
        ? Math.max(truck.speed - BRAKE_DECEL * controls.brake * dt, 0)
        : Math.min(truck.speed + BRAKE_DECEL * controls.brake * dt, 0)
    } else if (controls.direction === 'R' && controls.throttle > 0) {
      truck.speed = Math.max(truck.speed - REVERSE_ACCEL * controls.throttle * dt, -MAX_REVERSE_SPEED)
    } else if (truck.speed > 0) {
      truck.speed = Math.max(truck.speed - DRAG * dt, 0)
    } else if (truck.speed < 0) {
      truck.speed = Math.min(truck.speed + DRAG * dt, 0)
    }

    if (Math.abs(truck.speed) > STOP_SPEED_EPSILON) {
      const turnScale = clamp(Math.abs(truck.speed) / MAX_SPEED, 0.35, 1) * Math.sign(truck.speed)
      truck.heading += turnInput * TURN_RATE * dt * turnScale
    }
  } else if (truck.speed > 0) {
    truck.speed = Math.max(truck.speed - DRAG * dt, 0)
  } else if (truck.speed < 0) {
    truck.speed = Math.min(truck.speed + DRAG * dt, 0)
  }

  const forwardX = Math.sin(truck.heading)
  const forwardZ = Math.cos(truck.heading)

  frame.controls = controls
  frame.controlsLocked = controlsLocked
  frame.turnInput = turnInput
  frame.prevSpeed = prevSpeed
  frame.forwardX = forwardX
  frame.forwardZ = forwardZ
  frame.nextX = clamp(truck.x + forwardX * truck.speed * dt, -groundHalfWidth, groundHalfWidth)
  frame.nextZ = clamp(truck.z + forwardZ * truck.speed * dt, courseMinZ, courseMaxZ)
}
