import { clamp } from '../math.js'
import { neutralControls } from './controls.js'
import {
  KEYBOARD_STEER_RATE,
  KEYBOARD_STEER_RETURN_RATE,
  KEYBOARD_YAW_FULL_SPEED,
  KEYBOARD_YAW_MIN_SCALE,
  KEYBOARD_YAW_RATE,
  MAX_STEER_ANGLE,
  STOP_SPEED_EPSILON,
} from './constants.js'
import { wheelbase } from './rigGeometry.js'
import { SIM_DT } from './simLoop.js'

// The keyboard as a control source (docs/revisions/post-defense-plan.md,
// section 3.4). Pure: hooks/useDrivingInput.js feeds it window key events,
// and tests feed it directly.
//
// It keeps the keyboard's original feel: W is throttle with the direction
// lever automatically in F; S brakes while the truck is moving forward, then
// reverses with R once it has (nearly) stopped. With neither held the lever
// reads N. That automatic direction depends on the truck's speed, which is
// why read() takes the sim state. Once the learner has moved the dashboard's
// direction lever, the lever says which way the truck goes and S is only the
// brake, as on a real truck.
//
// A and D turn a virtual steering wheel rather than snapping the rear wheels
// to full lock: see keyboardSteerLimit() and the KEYBOARD_* constants.
//
// Keys that are not held controls raise edge-triggered commands instead,
// drained by the viewer: E the key switch, the camera keys, the inset, and
// the cab switches (see VIEW_COMMAND_BY_KEY).

export const DRIVING_KEYS = ['w', 'a', 's', 'd', 'e', 'r', 'f', 't', 'g']

// One press, one command. C switches first-person / chase and the arrow keys
// do what a wheel's D-pad does (cameraModes.js). Keys are lower-cased
// KeyboardEvent.key values.
export const VIEW_COMMAND_BY_KEY = {
  c: 'cameraToggle',
  arrowleft: 'cameraLeft',
  arrowright: 'cameraRight',
  arrowup: 'cameraUp',
  arrowdown: 'cameraDown',
  v: 'toggleInset',
  h: 'horn',
  b: 'seatbeltToggle',
  ' ': 'parkingBrakeToggle',
}

const HELD_BY_KEY = {
  w: 'forward',
  s: 'back',
  a: 'left',
  d: 'right',
  r: 'raise',
  f: 'lower',
  t: 'tiltBack',
  g: 'tiltForward',
}

// How far (a fraction of full lock) the keyboard's virtual wheel may turn at
// `speed`: whatever gives the yaw rate the keyboard had before the bicycle
// model (KEYBOARD_YAW_RATE, scaled by speed as it was), so A and D feel the
// same at speed. Near a standstill that allows full lock.
export function keyboardSteerLimit(speed) {
  const v = Math.abs(speed)
  const yawRate = KEYBOARD_YAW_RATE * clamp(v / KEYBOARD_YAW_FULL_SPEED, KEYBOARD_YAW_MIN_SCALE, 1)
  if (v < 1e-6) return 1
  return Math.min(Math.atan((yawRate * wheelbase()) / v) / MAX_STEER_ANGLE, 1)
}

export function createKeyboardSource() {
  const held = {
    forward: false,
    back: false,
    left: false,
    right: false,
    raise: false,
    lower: false,
    tiltBack: false,
    tiltForward: false,
  }
  let commands = []
  let tapped = new Set()
  // The virtual steering wheel's position, -1..1 of full lock.
  let wheel = 0

  return {
    held,

    // Returns true when the key is one the simulation uses, so the caller
    // can preventDefault it.
    keyDown(rawKey, repeat = false) {
      const key = rawKey.toLowerCase()
      if (VIEW_COMMAND_BY_KEY[key]) {
        if (!repeat) commands.push(VIEW_COMMAND_BY_KEY[key])
        return true
      }
      if (!DRIVING_KEYS.includes(key)) return false
      if (key === 'e') {
        if (!repeat) commands.push('engineToggle')
        return true
      }
      held[HELD_BY_KEY[key]] = true
      tapped.add(key)
      return true
    },

    keyUp(rawKey) {
      const key = rawKey.toLowerCase()
      if (!HELD_BY_KEY[key]) return
      held[HELD_BY_KEY[key]] = false
    },

    // Letters currently held or pressed since the last call, for the
    // keysUsed tracker.
    drainLetters() {
      const letters = new Set(tapped)
      for (const [key, name] of Object.entries(HELD_BY_KEY)) {
        if (held[name]) letters.add(key)
      }
      tapped = new Set()
      return [...letters]
    },

    // Edge-triggered commands since the last call.
    drainCommands() {
      const drained = commands
      commands = []
      return drained
    },

    // Held keys -> operator controls, given the truck's current speed. Kept
    // as the old stepDrive branches read the keys: W wins over S, raise over
    // lower, tilt-back over tilt-forward. With `leverEngaged` the direction is
    // left to the lever (the dashboard's or a shifter), so W is the
    // accelerator and S the brake pedal. Called once per sim step of `dt`,
    // since it also turns the virtual steering wheel.
    read(state, { leverEngaged = false, dt = SIM_DT } = {}) {
      const controls = neutralControls()
      if (leverEngaged) {
        if (held.forward) controls.throttle = 1
        else if (held.back) controls.brake = 1
      } else if (held.forward) {
        controls.throttle = 1
        controls.direction = 'F'
      } else if (held.back) {
        if (state.truck.speed > STOP_SPEED_EPSILON) {
          controls.brake = 1
          controls.direction = 'F'
        } else {
          controls.throttle = 1
          controls.direction = 'R'
        }
      }
      const steerKey = (held.left ? 1 : 0) - (held.right ? 1 : 0)
      const limit = keyboardSteerLimit(state.truck.speed)
      if (steerKey) {
        wheel = clamp(wheel + steerKey * KEYBOARD_STEER_RATE * dt, -limit, limit)
      } else {
        wheel = wheel > 0 ? Math.max(wheel - KEYBOARD_STEER_RETURN_RATE * dt, 0) : Math.min(wheel + KEYBOARD_STEER_RETURN_RATE * dt, 0)
      }
      // A speed-up past the limit brings the wheel back within it.
      wheel = clamp(wheel, -limit, limit)
      controls.steer = wheel
      controls.lift = held.raise ? 1 : held.lower ? -1 : 0
      controls.tilt = held.tiltBack ? -1 : held.tiltForward ? 1 : 0
      return controls
    },
  }
}
