import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeHat,
  defaultControllerConfig,
  detectInput,
  hatMatches,
  inputPressed,
  parseGamepadId,
  pedalFromAxis,
  resolveControllerConfig,
  steerFromAxis,
  T300_KEY,
  TH8A_KEY,
} from './gamepad.js'

const HAT_CENTRED = 3.2857143878936768

// A POV hat folded into one axis: -1 + index * 2/7.
const hatValue = (index) => -1 + (index * 2) / 7

const pad = ({ key = T300_KEY, axes = [], buttons = [] } = {}) => ({ key, name: 'test', axes, buttons })

// --- ids ---------------------------------------------------------------------

test('parseGamepadId reads vendor and product from Chrome and Firefox ids', () => {
  assert.deepEqual(parseGamepadId('Thrustmaster T300RS Racing wheel (Vendor: 044f Product: b66e)'), {
    key: '044f:b66e',
    vendor: '044f',
    product: 'b66e',
  })
  assert.deepEqual(parseGamepadId('044f-b660-T500 RS Gear Shift'), { key: '044f:b660', vendor: '044f', product: 'b660' })
  // Upper case hex, as some platforms report it.
  assert.equal(parseGamepadId('Wheel (Vendor: 044F Product: B66E)').key, '044f:b66e')
})

test('parseGamepadId falls back to the whole id', () => {
  assert.deepEqual(parseGamepadId('Some Pad'), { key: 'Some Pad', vendor: null, product: null })
  assert.equal(parseGamepadId('').key, '')
})

// --- hat -----------------------------------------------------------------------

test('decodeHat decodes all eight directions and centred', () => {
  const expected = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left']
  expected.forEach((direction, index) => assert.equal(decodeHat(hatValue(index)), direction, direction))
  // The value measured on the T300 for down.
  assert.equal(decodeHat(0.1429), 'down')
  assert.equal(decodeHat(HAT_CENTRED), null)
  assert.equal(decodeHat(-HAT_CENTRED), null)
  assert.equal(decodeHat(undefined), null)
})

test('hatMatches counts a diagonal as both of its directions', () => {
  assert.equal(hatMatches('up-right', 'up'), true)
  assert.equal(hatMatches('up-right', 'right'), true)
  assert.equal(hatMatches('up-right', 'left'), false)
  assert.equal(hatMatches('down', 'down'), true)
  assert.equal(hatMatches(null, 'down'), false)
})

// --- axes ---------------------------------------------------------------------

test('steerFromAxis normalises about a calibrated centre', () => {
  const cal = { min: -1, center: 0, max: 1, deadzone: 0 }
  assert.equal(steerFromAxis(0, cal), 0)
  assert.equal(steerFromAxis(-1, cal), -1)
  assert.equal(steerFromAxis(1, cal), 1)
  assert.equal(steerFromAxis(0.5, cal), 0.5)
  // An off-centre, asymmetric calibration.
  const skew = { min: -0.9, center: 0.1, max: 0.8, deadzone: 0 }
  assert.equal(steerFromAxis(0.1, skew), 0)
  assert.equal(steerFromAxis(-0.9, skew), -1)
  assert.ok(Math.abs(steerFromAxis(0.8, skew) - 1) < 1e-12)
  assert.equal(steerFromAxis(2, skew), 1)
  // Inverted, and a deadzone.
  assert.equal(steerFromAxis(-1, { ...cal, invert: true }), 1)
  assert.equal(steerFromAxis(0.01, { ...cal, deadzone: 0.02 }), 0)
})

test('pedalFromAxis maps released +1 .. pressed -1 onto 0..1', () => {
  const cal = { released: 1, pressed: -1, deadzone: 0 }
  assert.equal(pedalFromAxis(1, cal, true), 0)
  assert.equal(pedalFromAxis(-1, cal, true), 1)
  assert.equal(pedalFromAxis(0, cal, true), 0.5)
  assert.equal(pedalFromAxis(-1.2, cal, true), 1)
  assert.equal(pedalFromAxis(0.98, { ...cal, deadzone: 0.02 }, true), 0)
})

test('a pedal axis that has never moved reads as released', () => {
  const cal = { released: 1, pressed: -1, deadzone: 0 }
  // Some browsers report 0 (half pressed) until the pedal is first touched.
  assert.equal(pedalFromAxis(0, cal, false), 0)
})

// --- buttons and capture -------------------------------------------------------

test('inputPressed reads buttons and hat directions on the bound device only', () => {
  const wheel = pad({ axes: Array(10).fill(0).map((_, index) => (index === 9 ? hatValue(0) : 0)), buttons: [0, 1] })
  const pads = [wheel]
  assert.equal(inputPressed(pads, { device: T300_KEY, kind: 'button', index: 1 }), true)
  assert.equal(inputPressed(pads, { device: T300_KEY, kind: 'button', index: 0 }), false)
  assert.equal(inputPressed(pads, { device: TH8A_KEY, kind: 'button', index: 1 }), false)
  assert.equal(inputPressed(pads, { device: T300_KEY, kind: 'hat', index: 9, direction: 'up' }), true)
  assert.equal(inputPressed(pads, { device: T300_KEY, kind: 'hat', index: 9, direction: 'down' }), false)
})

test('detectInput reports a new button, a hat push or a moved axis', () => {
  const before = [pad({ axes: [0, 1, HAT_CENTRED], buttons: [0, 0] }), pad({ key: TH8A_KEY, buttons: [0, 0, 0] })]
  assert.equal(detectInput(before, before), null)

  const gear = [before[0], pad({ key: TH8A_KEY, buttons: [0, 0, 1] })]
  assert.deepEqual(detectInput(before, gear), { device: TH8A_KEY, kind: 'button', index: 2 })

  const hat = [pad({ axes: [0, 1, hatValue(6)], buttons: [0, 0] }), before[1]]
  assert.deepEqual(detectInput(before, hat), { device: T300_KEY, kind: 'hat', index: 2, direction: 'left' })

  // A small wobble is not a capture; pressing the pedal is.
  const wobble = [pad({ axes: [0.1, 0.9, HAT_CENTRED], buttons: [0, 0] }), before[1]]
  assert.equal(detectInput(before, wobble), null)
  const pedal = [pad({ axes: [0, -0.8, HAT_CENTRED], buttons: [0, 0] }), before[1]]
  assert.deepEqual(detectInput(before, pedal), { device: T300_KEY, kind: 'axis', index: 1, from: 1, to: -0.8 })
})

// --- config --------------------------------------------------------------------

test('the T300 and TH8A ship with the measured and chosen bindings', () => {
  const config = defaultControllerConfig()
  assert.deepEqual(config.bindings.steer, [{ device: T300_KEY, kind: 'axis', index: 0, min: -1, center: 0, max: 1, deadzone: 0.005 }])
  assert.equal(config.bindings.throttle[0].index, 5)
  assert.equal(config.bindings.brake[0].index, 1)
  assert.equal(config.bindings.inching[0].index, 6)
  assert.equal(config.bindings.cameraLeft[0].kind, 'hat')
  // The rim buttons the team chose (2026-09-30).
  assert.deepEqual(config.bindings.engine, [{ device: T300_KEY, kind: 'button', index: 3 }])
  assert.equal(config.bindings.shiftUp[0].index, 1)
  assert.equal(config.devices[T300_KEY].rotationDeg, 900)
  assert.equal(config.steeringLockDeg, 540)
  assert.equal(config.bindings.cameraToggle[0].index, 2)
  // The TH8A: gears 1-7 are F, button 7 is R.
  assert.deepEqual(config.bindings.gearForward.map((input) => [input.device, input.index]), [0, 1, 2, 3, 4, 5, 6].map((index) => [TH8A_KEY, index]))
  assert.deepEqual(config.bindings.gearReverse, [{ device: TH8A_KEY, kind: 'button', index: 7 }])
})

test('resolveControllerConfig lays stored bindings over the defaults and drops junk', () => {
  const stored = {
    version: 1,
    steeringLockDeg: 450,
    devices: { [T300_KEY]: { rotationDeg: 1080 } },
    bindings: {
      horn: [{ device: T300_KEY, kind: 'button', index: 3 }],
      // Explicitly unbound stays unbound.
      inching: [],
      gearForward: [1, 2, 3].map((index) => ({ device: TH8A_KEY, kind: 'button', index })),
      notAnAction: [{ device: T300_KEY, kind: 'button', index: 0 }],
      brake: [{ device: T300_KEY, kind: 'laser', index: 0 }],
    },
  }
  const config = resolveControllerConfig(stored)
  assert.equal(config.steeringLockDeg, 450)
  assert.equal(config.devices[T300_KEY].rotationDeg, 1080)
  assert.equal(config.bindings.horn[0].index, 3)
  assert.deepEqual(config.bindings.inching, [])
  assert.equal(config.bindings.gearForward.length, 3)
  assert.equal(config.bindings.notAnAction, undefined)
  // An invalid input is dropped, leaving the action unbound.
  assert.deepEqual(config.bindings.brake, [])
  // Anything not stored keeps its default.
  assert.equal(config.bindings.throttle[0].index, 5)
})

test('resolveControllerConfig survives nothing stored, or garbage', () => {
  assert.deepEqual(resolveControllerConfig(null), defaultControllerConfig())
  assert.deepEqual(resolveControllerConfig({ version: 99, bindings: 'x' }), defaultControllerConfig())
  assert.equal(resolveControllerConfig({ steeringLockDeg: -5 }).steeringLockDeg, 540)
})
