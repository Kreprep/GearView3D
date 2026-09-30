import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeControls } from './controls.js'
import { defaultControllerConfig, resolveControllerConfig, T300_KEY, TH8A_KEY } from './gamepad.js'
import { createWheelSource } from './wheelSource.js'

const HAT_CENTRED = 3.2857143878936768

// A T300 snapshot: steering, the three pedals (released = +1), the hat.
function t300({ wheel = 0, gas = 1, brake = 1, clutch = 1, hat = HAT_CENTRED, buttons = [] } = {}) {
  const axes = Array(10).fill(0)
  axes[0] = wheel
  axes[1] = brake
  axes[5] = gas
  axes[6] = clutch
  axes[9] = hat
  const values = Array(26).fill(0)
  buttons.forEach((index) => {
    values[index] = 1
  })
  return { key: T300_KEY, name: 'T300', axes, buttons: values }
}

function th8a(pressed = []) {
  const buttons = Array(12).fill(0)
  pressed.forEach((index) => {
    buttons[index] = 1
  })
  return { key: TH8A_KEY, name: 'TH8A', axes: [], buttons }
}

const withBindings = (bindings) => {
  const config = defaultControllerConfig()
  return resolveControllerConfig({ ...config, bindings: { ...config.bindings, ...bindings } })
}

const button = (device, index) => ({ device, kind: 'button', index })

test('nothing connected reads as neutral controls with no lever', () => {
  const wheel = createWheelSource(defaultControllerConfig())
  wheel.update([])
  const controls = wheel.read()
  assert.equal(controls.steer, 0)
  assert.equal(controls.throttle, 0)
  assert.equal(controls.explicitDirection, false)
  assert.equal(controls.steeringWheelAngle, null)
  assert.deepEqual(wheel.status(), { steering: false, shifter: false })
})

test('the T300 wheel maps its rotation onto the steering lock', () => {
  const wheel = createWheelSource(defaultControllerConfig())
  // 900-degree rotation: axis -1 is 450 degrees left, which is 450/540 of
  // full lock, to the left (+).
  wheel.update([t300({ wheel: -1 })])
  let controls = wheel.read()
  assert.ok(Math.abs(controls.steer - 450 / 540) < 1e-9)
  // The cab wheel shows the real rotation: 450 degrees anticlockwise.
  assert.ok(Math.abs(controls.steeringWheelAngle - (450 * Math.PI) / 180) < 1e-9)
  // The paddles ship as a sequential direction lever, so a lone T300 owns
  // the direction (starting in N).
  assert.deepEqual(wheel.status(), { steering: true, shifter: true })
  assert.deepEqual([controls.direction, controls.explicitDirection], ['N', true])

  wheel.update([t300({ wheel: 0.6 })])
  controls = wheel.read()
  assert.ok(Math.abs(controls.steer - -270 / 540) < 1e-9)
})

test('a tighter steering lock reaches full lock sooner and clamps', () => {
  const config = { ...defaultControllerConfig(), steeringLockDeg: 180 }
  const wheel = createWheelSource(resolveControllerConfig(config))
  wheel.update([t300({ wheel: -1 })])
  assert.equal(wheel.read().steer, 1)
})

test('pedals read 0 until they have moved, then map released..pressed', () => {
  const wheel = createWheelSource(defaultControllerConfig())
  // Chrome before the first press: every axis 0.
  wheel.update([t300({ gas: 0, brake: 0, clutch: 0 })])
  let controls = wheel.read()
  assert.equal(controls.throttle, 0)
  assert.equal(controls.brake, 0)
  assert.equal(controls.inching, 0)

  wheel.update([t300({ gas: -1, brake: 1, clutch: 0.5 })])
  controls = wheel.read()
  assert.equal(controls.throttle, 1)
  assert.equal(controls.brake, 0)
  assert.equal(controls.inching, 0.25)
  // Seen now, so a real half press reads as half.
  wheel.update([t300({ gas: 0 })])
  assert.equal(wheel.read().throttle, 0.5)
})

test('the TH8A H-pattern is the direction lever: forward gears F, reverse R, none N', () => {
  const config = withBindings({
    gearForward: [1, 2, 3, 4, 5, 6].map((index) => button(TH8A_KEY, index)),
    gearReverse: [button(TH8A_KEY, 7)],
  })
  const wheel = createWheelSource(config)
  // Not plugged in: the T300's paddles are the lever, stepping from N.
  wheel.update([t300({ buttons: [1] })])
  assert.equal(wheel.read().direction, 'F')
  // Plugged in, the H-pattern wins over the paddles.

  wheel.update([t300(), th8a()])
  assert.deepEqual([wheel.read().direction, wheel.read().explicitDirection], ['N', true])
  assert.deepEqual(wheel.status(), { steering: true, shifter: true })
  wheel.update([t300(), th8a([3])])
  assert.equal(wheel.read().direction, 'F')
  wheel.update([t300(), th8a([7])])
  assert.equal(wheel.read().direction, 'R')
})

test('a sequential shifter steps R-N-F and stops at the ends', () => {
  const config = withBindings({ shiftUp: [button(T300_KEY, 4)], shiftDown: [button(T300_KEY, 5)] })
  const wheel = createWheelSource(config)
  const press = (index) => {
    wheel.update([t300({ buttons: [index] })])
    wheel.update([t300()])
  }
  wheel.update([t300()])
  assert.equal(wheel.read().direction, 'N')
  press(4)
  assert.equal(wheel.read().direction, 'F')
  press(4)
  assert.equal(wheel.read().direction, 'F')
  press(5)
  press(5)
  assert.equal(wheel.read().direction, 'R')
  press(5)
  assert.equal(wheel.read().direction, 'R')
  // Held down is one step, not one per update.
  wheel.update([t300({ buttons: [4] })])
  wheel.update([t300({ buttons: [4] })])
  wheel.update([t300({ buttons: [4] })])
  assert.equal(wheel.read().direction, 'N')
})

test('buttons: levers are held, commands fire once per press', () => {
  // Buttons no shipped default uses.
  const config = withBindings({
    liftUp: [button(T300_KEY, 20)],
    tiltBack: [button(T300_KEY, 21)],
    horn: [button(T300_KEY, 22)],
    engine: [button(T300_KEY, 23)],
  })
  const wheel = createWheelSource(config)
  wheel.update([t300({ buttons: [20, 21, 22, 23] })])
  const controls = wheel.read()
  assert.equal(controls.lift, 1)
  assert.equal(controls.tilt, -1)
  assert.deepEqual(wheel.drainCommands(), ['engine', 'horn'])
  wheel.update([t300({ buttons: [20, 21, 22, 23] })])
  assert.deepEqual(wheel.drainCommands(), [])
})

test('the default D-pad binding moves the camera', () => {
  const wheel = createWheelSource(defaultControllerConfig())
  wheel.update([t300({ hat: -1 })])
  assert.deepEqual(wheel.drainCommands(), ['cameraUp'])
  wheel.update([t300({ hat: -1 + (6 * 2) / 7 })])
  assert.deepEqual(wheel.drainCommands(), ['cameraLeft'])
})

test('a wheel and the keyboard merge: the pedal and the key do not cancel', () => {
  const wheel = createWheelSource(defaultControllerConfig())
  wheel.update([t300({ gas: 0, wheel: 0.2 })])
  wheel.update([t300({ gas: 0.5, wheel: 0.2 })])
  const merged = mergeControls([wheel.read(), { throttle: 1, steer: 0 }])
  assert.equal(merged.throttle, 1)
  assert.ok(merged.steer < 0)
  assert.ok(merged.steeringWheelAngle < 0)
})
