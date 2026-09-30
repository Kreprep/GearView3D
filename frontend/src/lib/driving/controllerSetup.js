import { AXIS_ACTIONS, defaultControllerConfig, PEDAL_ACTIONS, STEER_ACTION, T300_KEY, TH8A_KEY } from './gamepad.js'

// The edits Controller Setup (components/driving/ControllerSetup.jsx) makes
// to a controller config, as pure functions that return a new config: bind a
// captured input, clear an action, calibrate the steering and pedals, set the
// wheel rotation and steering lock. Pure, so the modal stays a view.

const KNOWN_DEVICES = {
  [T300_KEY]: 'T300 RS',
  [TH8A_KEY]: 'TH8A',
}

// A short name for a pad key. Thrustmaster's own ids are long and the TH8A
// calls itself "T500 RS Gear Shift", so the two known devices get their
// product names; anything else is its id without the vendor/product suffix.
export function deviceLabel(key, pads = []) {
  if (KNOWN_DEVICES[key]) return KNOWN_DEVICES[key]
  const pad = pads.find((candidate) => candidate.key === key)
  const name = pad?.name || key
  return name.replace(/\s*\(.*?Vendor:.*\)\s*$/i, '').replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '') || key
}

const withBindings = (config, action, inputs) => ({ ...config, bindings: { ...config.bindings, [action]: inputs } })

// An input captured by detectInput(), as the binding for `action`. An axis
// captured for a pedal takes where it started as released and where it went
// as pressed; for the steering, a symmetric -1..1 until calibrated. Button
// and hat inputs are bound as they are. Returns null if the input kind can't
// drive the action (a button for the steering, an axis for the horn).
export function inputForAction(action, captured) {
  const isAxisAction = AXIS_ACTIONS.includes(action)
  if (isAxisAction !== (captured.kind === 'axis')) return null
  const { device, kind, index } = captured
  if (kind === 'button') return { device, kind, index }
  if (kind === 'hat') return { device, kind, index, direction: captured.direction }
  if (action === STEER_ACTION) return { device, kind, index, min: -1, center: 0, max: 1, deadzone: 0.005 }
  return { device, kind, index, released: captured.from, pressed: captured.to, deadzone: 0.02 }
}

// Bind `captured` to `action`, replacing what was bound (or adding to it with
// `append`, for the several gears that all mean F).
export function bindCaptured(config, action, captured, { append = false } = {}) {
  const input = inputForAction(action, captured)
  if (!input) return config
  const current = config.bindings[action] || []
  const same = (other) => other.device === input.device && other.kind === input.kind && other.index === input.index && other.direction === input.direction
  return withBindings(config, action, append ? [...current.filter((other) => !same(other)), input] : [input])
}

export const clearAction = (config, action) => withBindings(config, action, [])

export function resetAction(config, action) {
  return withBindings(config, action, defaultControllerConfig().bindings[action] || [])
}

// The steering axis's calibration from the extremes seen while the learner
// turned lock to lock, and the reading once they let it return to centre.
export function calibrateSteering(config, { min, max, center }) {
  const [input] = config.bindings[STEER_ACTION] || []
  if (!input || input.kind !== 'axis' || !(min < center && center < max)) return config
  return withBindings(config, STEER_ACTION, [{ ...input, min, center, max }])
}

// A pedal's calibration from the extremes seen while it was pressed fully
// and released: released is where it came to rest, pressed the extreme
// furthest from that.
export function calibratePedal(config, action, { min, max, rest }) {
  const [input] = config.bindings[action] || []
  if (!PEDAL_ACTIONS.includes(action) || !input || input.kind !== 'axis') return config
  const pressed = Math.abs(min - rest) > Math.abs(max - rest) ? min : max
  if (Math.abs(pressed - rest) < 0.2) return config
  return withBindings(config, action, [{ ...input, released: rest, pressed }])
}

export function setRotation(config, device, rotationDeg) {
  if (!(rotationDeg >= 90 && rotationDeg <= 3600)) return config
  return { ...config, devices: { ...config.devices, [device]: { ...config.devices[device], rotationDeg } } }
}

export function setSteeringLock(config, steeringLockDeg) {
  if (!(steeringLockDeg > 0 && steeringLockDeg <= 1800)) return config
  return { ...config, steeringLockDeg }
}

// Tracks the smallest and largest value an axis reads during a calibration
// step.
export function createRangeTracker() {
  let min = Infinity
  let max = -Infinity
  return {
    add(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return
      min = Math.min(min, value)
      max = Math.max(max, value)
    },
    get range() {
      return { min, max }
    },
  }
}
