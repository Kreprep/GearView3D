import { clamp } from '../math.js'
import { CAMERA_COMMANDS } from './cameraModes.js'

// Steering wheel, pedals and shifter over the browser Gamepad API
// (docs/revisions/post-defense-plan.md, section 4.3): the pure half. Device
// ids, hat decoding, axis normalisation, input capture and the saved binding
// config. No browser APIs - gamepadBrowser.js snapshots navigator.getGamepads()
// into the plain shape these read, and wheelSource.js turns a snapshot into
// operator controls.
//
// A pad snapshot is { key, name, axes: number[], buttons: number[] } (button
// values, 0..1). `key` is the vendor:product pair (parseGamepadId), which is
// what bindings and calibration are stored against: the full id string
// differs between browsers.
//
// Wheels report a non-standard mapping, so no index is assumed anywhere
// except the measured T300 RS defaults below. Everything else is bound in
// Controller Setup.

export const T300_KEY = '044f:b66e' // Thrustmaster T300 RS (PC mode)
export const TH8A_KEY = '044f:b660' // TH8A on its own USB (reports "T500 RS Gear Shift")

// --- ids -----------------------------------------------------------------------

// Chrome: "... (Vendor: 044f Product: b66e)". Firefox: "044f-b66e-Name".
const CHROME_ID = /Vendor:\s*([0-9a-f]{4})\s+Product:\s*([0-9a-f]{4})/i
const FIREFOX_ID = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i

export function parseGamepadId(id = '') {
  const match = CHROME_ID.exec(id) || FIREFOX_ID.exec(id)
  if (!match) return { key: id, vendor: null, product: null }
  const vendor = match[1].toLowerCase().padStart(4, '0')
  const product = match[2].toLowerCase().padStart(4, '0')
  return { key: `${vendor}:${product}`, vendor, product }
}

// --- the POV hat ---------------------------------------------------------------

// Chrome folds a D-pad into one axis: value = -1 + index * 2/7, index 0 = up
// going clockwise. Centred reads about 3.29, outside -1..1.
export const HAT_DIRECTIONS = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left']
const HAT_CENTRED_LIMIT = 1.1

export function decodeHat(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > HAT_CENTRED_LIMIT) return null
  const index = Math.round((value + 1) * 3.5)
  return HAT_DIRECTIONS[((index % 8) + 8) % 8]
}

// A diagonal counts as both of its directions, as a D-pad feels.
export function hatMatches(direction, wanted) {
  if (!direction) return false
  return direction === wanted || direction.split('-').includes(wanted)
}

// --- axes ----------------------------------------------------------------------

const applyDeadzone = (value, deadzone = 0) => (Math.abs(value) <= deadzone ? 0 : value)

// A steering axis, calibrated { min (full left), center, max (full right),
// deadzone, invert }, as -1 (full left of the wheel's rotation) .. 1.
export function steerFromAxis(value, { min = -1, center = 0, max = 1, deadzone = 0, invert = false } = {}) {
  const span = value < center ? center - min : max - center
  const normalised = span > 0 ? clamp((value - center) / span, -1, 1) : 0
  const signed = invert ? -normalised : normalised
  return applyDeadzone(signed, deadzone)
}

// A pedal axis, calibrated { released, pressed, deadzone }, as 0..1.
// T300 pedals rest at +1 and read -1 fully pressed. Before a pedal has first
// moved, some browsers report its axis as 0 - half pressed under this
// mapping - so an axis not yet `seen` to move reads as released.
export function pedalFromAxis(value, { released = 1, pressed = -1, deadzone = 0 } = {}, seen = true) {
  if (!seen) return 0
  const span = released - pressed
  if (!span) return 0
  return applyDeadzone(clamp((released - value) / span, 0, 1), deadzone)
}

// --- inputs --------------------------------------------------------------------

// A binding input is one of:
//   { device, kind: 'axis', index, ...calibration }
//   { device, kind: 'button', index }
//   { device, kind: 'hat', index, direction }
// `device` is a pad key. Several inputs may be bound to one action (every
// forward gear of an H-pattern shifter is bound to gearForward).
export const INPUT_KINDS = ['axis', 'button', 'hat']

export const findPad = (pads, device) => pads.find((pad) => pad.key === device) || null

const BUTTON_PRESSED = 0.5

// Whether a button or hat input is held.
export function inputPressed(pads, input) {
  const pad = findPad(pads, input.device)
  if (!pad) return false
  if (input.kind === 'button') return (pad.buttons[input.index] ?? 0) > BUTTON_PRESSED
  if (input.kind === 'hat') return hatMatches(decodeHat(pad.axes[input.index]), input.direction)
  return false
}

// For "press the control now" capture: the first input that changed between
// two snapshots - a button newly pressed, a hat newly pushed, or an axis
// moved more than half its range. Hat axes (centred outside -1..1) are only
// ever read as hats.
const AXIS_CAPTURE_TRAVEL = 0.5

export function detectInput(before, after) {
  for (const pad of after) {
    const previous = findPad(before, pad.key)
    if (!previous) continue
    for (let index = 0; index < pad.buttons.length; index += 1) {
      if (pad.buttons[index] > BUTTON_PRESSED && !((previous.buttons[index] ?? 0) > BUTTON_PRESSED)) {
        return { device: pad.key, kind: 'button', index }
      }
    }
    for (let index = 0; index < pad.axes.length; index += 1) {
      const from = previous.axes[index]
      const to = pad.axes[index]
      if (typeof from !== 'number' || typeof to !== 'number') continue
      const direction = decodeHat(to)
      const isHat = Math.abs(from) > HAT_CENTRED_LIMIT || Math.abs(to) > HAT_CENTRED_LIMIT
      if (isHat) {
        if (direction && direction !== decodeHat(from)) return { device: pad.key, kind: 'hat', index, direction }
        continue
      }
      if (Math.abs(to - from) > AXIS_CAPTURE_TRAVEL) return { device: pad.key, kind: 'axis', index, from, to }
    }
  }
  return null
}

// --- actions -------------------------------------------------------------------

// Analog actions, each read from its first bound axis.
export const STEER_ACTION = 'steer'
export const PEDAL_ACTIONS = ['throttle', 'brake', 'inching']
export const AXIS_ACTIONS = [STEER_ACTION, ...PEDAL_ACTIONS]
// Held while the input is: the hydraulic levers.
export const HELD_ACTIONS = ['liftUp', 'liftDown', 'tiltBack', 'tiltForward']
// One command per press. The lights, beacon and turn signals ship unbound:
// bind them in Controller Setup.
export const COMMAND_ACTIONS = ['engine', 'horn', 'seatbelt', 'parkingBrake', 'lights', 'beacon', 'turnSignalLeft', 'turnSignalRight', ...CAMERA_COMMANDS, 'inset']
// The direction lever. H-pattern: any gearForward input held is F, a
// gearReverse input is R, neither is N. Sequential: shiftUp / shiftDown step
// R-N-F.
export const SHIFTER_ACTIONS = ['gearForward', 'gearReverse', 'shiftUp', 'shiftDown']
export const ACTIONS = [...AXIS_ACTIONS, ...HELD_ACTIONS, ...COMMAND_ACTIONS, ...SHIFTER_ACTIONS]

// --- config --------------------------------------------------------------------

export const CONTROLLER_CONFIG_VERSION = 1
// The Thrustmaster Control Panel's rotation (900 degrees recommended), which
// the wheel's axis spans end to end. Must match the Control Panel.
export const DEFAULT_ROTATION_DEG = 900
// Wheel degrees each way that give the forklift's full steering lock. A real
// truck takes four to five turns lock to lock; 540 degrees each way keeps a
// 900-degree wheel from running out of travel.
export const DEFAULT_STEERING_LOCK_DEG = 540

const T300_PEDAL = { released: 1, pressed: -1, deadzone: 0.02 }
const T300_HAT = 9

// Measured on 2026-09-29 in Chrome (docs/revisions/post-defense-plan.md,
// 4.3): steering axis 0, gas axis 5, brake axis 1, clutch axis 6, D-pad on
// axis 9, which moves the camera. The rim buttons and paddles are the ones
// the team chose in Controller Setup on 2026-09-30: the paddles (0, 1) are a
// sequential direction lever for when no shifter is plugged in, 9 / 6 raise
// and lower the forks, 7 / 8 tilt the mast back and forward, 3 is the
// engine, 12 the horn, 4 the seatbelt, 5 the parking brake and 2 switches
// first-person / chase. The TH8A's H-pattern, recorded the same day, is
// gears 1-7 on buttons 0-6 and reverse on 7; every forward gear is F.
export function defaultControllerConfig() {
  const bindings = Object.fromEntries(ACTIONS.map((action) => [action, []]))
  bindings.steer = [{ device: T300_KEY, kind: 'axis', index: 0, min: -1, center: 0, max: 1, deadzone: 0.005 }]
  bindings.throttle = [{ device: T300_KEY, kind: 'axis', index: 5, ...T300_PEDAL }]
  bindings.brake = [{ device: T300_KEY, kind: 'axis', index: 1, ...T300_PEDAL }]
  // The clutch pedal is the inching pedal.
  bindings.inching = [{ device: T300_KEY, kind: 'axis', index: 6, ...T300_PEDAL }]
  const hat = (direction) => [{ device: T300_KEY, kind: 'hat', index: T300_HAT, direction }]
  bindings.cameraLeft = hat('left')
  bindings.cameraRight = hat('right')
  bindings.cameraUp = hat('up')
  bindings.cameraDown = hat('down')
  const button = (index) => [{ device: T300_KEY, kind: 'button', index }]
  bindings.shiftUp = button(1)
  bindings.shiftDown = button(0)
  bindings.liftUp = button(9)
  bindings.liftDown = button(6)
  bindings.tiltBack = button(7)
  bindings.tiltForward = button(8)
  bindings.engine = button(3)
  bindings.horn = button(12)
  bindings.seatbelt = button(4)
  bindings.parkingBrake = button(5)
  bindings.cameraToggle = button(2)
  const gear = (index) => ({ device: TH8A_KEY, kind: 'button', index })
  bindings.gearForward = [0, 1, 2, 3, 4, 5, 6].map(gear)
  bindings.gearReverse = [gear(7)]
  return {
    version: CONTROLLER_CONFIG_VERSION,
    steeringLockDeg: DEFAULT_STEERING_LOCK_DEG,
    devices: { [T300_KEY]: { rotationDeg: DEFAULT_ROTATION_DEG } },
    bindings,
  }
}

const isIndex = (value) => Number.isInteger(value) && value >= 0
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const AXIS_FIELDS = ['min', 'center', 'max', 'released', 'pressed', 'deadzone']

// A clean copy of a stored input, or null if it isn't one.
function cleanInput(input) {
  if (!input || typeof input !== 'object') return null
  const { device, kind, index } = input
  if (typeof device !== 'string' || !INPUT_KINDS.includes(kind) || !isIndex(index)) return null
  if (kind === 'button') return { device, kind, index }
  if (kind === 'hat') return HAT_DIRECTIONS.includes(input.direction) ? { device, kind, index, direction: input.direction } : null
  const axis = { device, kind, index }
  for (const field of AXIS_FIELDS) if (isNumber(input[field])) axis[field] = input[field]
  if (input.invert === true) axis.invert = true
  return axis
}

const validRotation = (value) => isNumber(value) && value >= 90 && value <= 3600

// The saved config (gearview_controller_v1) over the shipped defaults. An
// action the stored config names replaces its default, including with an
// empty list (deliberately unbound); anything it doesn't name keeps the
// default. Unknown actions, invalid inputs and other versions are dropped, so
// a hand-edited or stale entry can't break the driving screen.
export function resolveControllerConfig(stored) {
  const config = defaultControllerConfig()
  if (!stored || typeof stored !== 'object' || stored.version !== CONTROLLER_CONFIG_VERSION) return config

  if (isNumber(stored.steeringLockDeg) && stored.steeringLockDeg > 0 && stored.steeringLockDeg <= 1800) {
    config.steeringLockDeg = stored.steeringLockDeg
  }
  if (stored.devices && typeof stored.devices === 'object') {
    for (const [key, device] of Object.entries(stored.devices)) {
      if (validRotation(device?.rotationDeg)) config.devices[key] = { rotationDeg: device.rotationDeg }
    }
  }
  if (stored.bindings && typeof stored.bindings === 'object' && !Array.isArray(stored.bindings)) {
    for (const action of ACTIONS) {
      const inputs = stored.bindings[action]
      if (Array.isArray(inputs)) config.bindings[action] = inputs.map(cleanInput).filter(Boolean)
    }
  }
  return config
}

// The wheel rotation set for a device, in degrees end to end.
export const rotationFor = (config, device) => config.devices[device]?.rotationDeg ?? DEFAULT_ROTATION_DEG
