import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bindCaptured,
  calibratePedal,
  calibrateSteering,
  clearAction,
  createRangeTracker,
  deviceLabel,
  inputForAction,
  resetAction,
  setRotation,
  setSteeringLock,
} from './controllerSetup.js'
import { defaultControllerConfig, resolveControllerConfig, T300_KEY, TH8A_KEY } from './gamepad.js'

const button = (index, device = T300_KEY) => ({ device, kind: 'button', index })

test('deviceLabel names the known devices and trims other ids', () => {
  assert.equal(deviceLabel(T300_KEY), 'T300 RS')
  assert.equal(deviceLabel(TH8A_KEY), 'TH8A')
  assert.equal(deviceLabel('1234:abcd', [{ key: '1234:abcd', name: 'Some Wheel (Vendor: 1234 Product: abcd)' }]), 'Some Wheel')
  assert.equal(deviceLabel('1234:abcd', [{ key: '1234:abcd', name: '1234-abcd-Some Wheel' }]), 'Some Wheel')
})

test('inputForAction only binds an axis to an axis action and a button to the rest', () => {
  assert.equal(inputForAction('steer', button(0)), null)
  assert.equal(inputForAction('horn', { device: T300_KEY, kind: 'axis', index: 2, from: 0, to: 1 }), null)
  assert.deepEqual(inputForAction('throttle', { device: T300_KEY, kind: 'axis', index: 2, from: 1, to: -1 }), {
    device: T300_KEY,
    kind: 'axis',
    index: 2,
    released: 1,
    pressed: -1,
    deadzone: 0.02,
  })
  assert.deepEqual(inputForAction('cameraDown', { device: T300_KEY, kind: 'hat', index: 9, direction: 'down' }), {
    device: T300_KEY,
    kind: 'hat',
    index: 9,
    direction: 'down',
  })
})

test('bindCaptured replaces, or appends for gears without duplicates', () => {
  let config = bindCaptured(defaultControllerConfig(), 'horn', button(3))
  config = bindCaptured(config, 'horn', button(4))
  assert.deepEqual(config.bindings.horn, [button(4)])

  config = clearAction(config, 'gearForward')
  config = bindCaptured(config, 'gearForward', button(1, TH8A_KEY), { append: true })
  config = bindCaptured(config, 'gearForward', button(2, TH8A_KEY), { append: true })
  config = bindCaptured(config, 'gearForward', button(1, TH8A_KEY), { append: true })
  assert.deepEqual(config.bindings.gearForward, [button(2, TH8A_KEY), button(1, TH8A_KEY)])
  // The result is still a valid stored config.
  assert.deepEqual(resolveControllerConfig(config), config)
})

test('clear and reset an action', () => {
  const cleared = clearAction(defaultControllerConfig(), 'throttle')
  assert.deepEqual(cleared.bindings.throttle, [])
  assert.deepEqual(resetAction(cleared, 'throttle').bindings.throttle, defaultControllerConfig().bindings.throttle)
})

test('steering calibration keeps the axis and stores the measured range', () => {
  const config = calibrateSteering(defaultControllerConfig(), { min: -0.98, center: 0.01, max: 0.97 })
  assert.deepEqual(config.bindings.steer[0], { device: T300_KEY, kind: 'axis', index: 0, min: -0.98, center: 0.01, max: 0.97, deadzone: 0.005 })
  // A range that doesn't bracket the centre (the wheel was never turned) is ignored.
  assert.equal(calibrateSteering(config, { min: 0, center: 0, max: 0 }), config)
})

test('pedal calibration takes the resting value and the far extreme', () => {
  const config = calibratePedal(defaultControllerConfig(), 'brake', { min: -0.97, max: 1, rest: 1 })
  assert.equal(config.bindings.brake[0].released, 1)
  assert.equal(config.bindings.brake[0].pressed, -0.97)
  // An inverted pedal (rests low).
  const inverted = calibratePedal(defaultControllerConfig(), 'brake', { min: -1, max: 0.9, rest: -1 })
  assert.equal(inverted.bindings.brake[0].pressed, 0.9)
  // Never pressed: unchanged.
  const untouched = defaultControllerConfig()
  assert.equal(calibratePedal(untouched, 'brake', { min: 0.99, max: 1, rest: 1 }), untouched)
})

test('rotation and steering lock are range checked', () => {
  const config = defaultControllerConfig()
  assert.equal(setRotation(config, T300_KEY, 1080).devices[T300_KEY].rotationDeg, 1080)
  assert.equal(setRotation(config, T300_KEY, 10), config)
  assert.equal(setSteeringLock(config, 450).steeringLockDeg, 450)
  assert.equal(setSteeringLock(config, 0), config)
})

test('the range tracker keeps the extremes', () => {
  const tracker = createRangeTracker()
  ;[0.2, -0.9, 0.95, Number.NaN, 0].forEach((value) => tracker.add(value))
  assert.deepEqual(tracker.range, { min: -0.9, max: 0.95 })
})
