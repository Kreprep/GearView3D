import { neutralControls } from './controls.js'
import { STOP_SPEED_EPSILON } from './constants.js'

// The keyboard as a control source (docs/revisions/post-defense-plan.md,
// section 3.4). Pure: hooks/useDrivingInput.js feeds it window key events,
// and tests feed it directly.
//
// It keeps the keyboard's original feel: W is throttle with the direction
// lever automatically in F; S brakes while the truck is moving forward, then
// reverses with R once it has (nearly) stopped. With neither held the lever
// reads N. That automatic direction depends on the truck's speed, which is
// why read() takes the sim state.

export const DRIVING_KEYS = ['w', 'a', 's', 'd', 'e', 'r', 'f', 't', 'g']

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

  return {
    held,

    // Returns true when the key is one the simulation uses, so the caller
    // can preventDefault it.
    keyDown(rawKey, repeat = false) {
      const key = rawKey.toLowerCase()
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
    // exactly as the old stepDrive branches read the keys: W wins over S,
    // raise over lower, tilt-back over tilt-forward.
    read(state) {
      const controls = neutralControls()
      if (held.forward) {
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
      controls.steer = (held.left ? 1 : 0) - (held.right ? 1 : 0)
      controls.lift = held.raise ? 1 : held.lower ? -1 : 0
      controls.tilt = held.tiltBack ? -1 : held.tiltForward ? 1 : 0
      return controls
    },
  }
}
