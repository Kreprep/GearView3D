import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COLD_TEMP, createCabGauges, NORMAL_TEMP, START_FUEL, START_HOURS, stepCabGauges } from './cabGauges.js'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import { cockpitSnapshot, displayedDirection } from './cockpitTelemetry.js'
import { mergeControls, neutralControls } from './controls.js'
import { createDashboardSource } from './dashboardSource.js'
import { createKeyboardSource, VIEW_COMMAND_BY_KEY } from './keyboardSource.js'
import { proximityReadout } from './proximity.js'
import { createSimState, createSimWorld } from './simState.js'
import { kmh, m } from './units.js'

const moving = { truck: { speed: 0.5 } }
const stopped = { truck: { speed: 0 } }

// --- dashboardSource -------------------------------------------------------

test('the key switch cranks a stopped engine on START and springs back to ON', () => {
  const dashboard = createDashboardSource()
  dashboard.turnKey('on', false)
  assert.deepEqual(dashboard.drainCommands(), [])
  assert.equal(dashboard.switches.key, 'on')

  dashboard.turnKey('start', false)
  assert.deepEqual(dashboard.drainCommands(), ['engineToggle'])
  assert.equal(dashboard.switches.key, 'on')

  // START on a running engine does nothing.
  dashboard.turnKey('start', true)
  assert.deepEqual(dashboard.drainCommands(), [])

  dashboard.turnKey('off', true)
  assert.deepEqual(dashboard.drainCommands(), ['engineToggle'])
  assert.equal(dashboard.switches.key, 'off')
})

test('the keyboard E goes through the key switch', () => {
  const dashboard = createDashboardSource()
  dashboard.toggleEngine(false)
  assert.deepEqual(dashboard.drainCommands(), ['engineToggle'])
  assert.equal(dashboard.switches.key, 'on')
  dashboard.toggleEngine(true)
  assert.deepEqual(dashboard.drainCommands(), ['engineToggle'])
  assert.equal(dashboard.switches.key, 'off')
})

test('cab switches toggle and reach the merged controls', () => {
  const dashboard = createDashboardSource()
  dashboard.toggle('seatbelt')
  dashboard.toggle('parkingBrake')
  dashboard.toggle('nonsense')
  const merged = mergeControls([createKeyboardSource().read(stopped), dashboard.read()])
  assert.equal(merged.seatbelt, true)
  assert.equal(merged.parkingBrake, true)
  dashboard.toggle('seatbelt')
  assert.equal(dashboard.read().seatbelt, false)
})

test('a moved switch is reported once, so the viewer can republish at once', () => {
  const dashboard = createDashboardSource()
  assert.equal(dashboard.takeChanged(), false)
  dashboard.setLever('F')
  assert.equal(dashboard.takeChanged(), true)
  assert.equal(dashboard.takeChanged(), false)
  dashboard.toggle('nonsense')
  assert.equal(dashboard.takeChanged(), false)
})

test('with the lever released the keyboard keeps its automatic direction', () => {
  const keyboard = createKeyboardSource()
  const dashboard = createDashboardSource()
  keyboard.keyDown('s')
  const merged = mergeControls([keyboard.read(stopped), dashboard.read()])
  assert.equal(merged.direction, 'R')
  assert.equal(merged.throttle, 1)
})

test('with the lever engaged it sets the direction and S is only the brake', () => {
  const keyboard = createKeyboardSource()
  const dashboard = createDashboardSource()
  dashboard.setLever('F')
  const leverEngaged = dashboard.switches.lever !== null

  keyboard.keyDown('s')
  const braking = mergeControls([keyboard.read(stopped, { leverEngaged }), dashboard.read()])
  assert.equal(braking.direction, 'F')
  assert.equal(braking.throttle, 0)
  assert.equal(braking.brake, 1)

  keyboard.keyUp('s')
  keyboard.keyDown('w')
  dashboard.setLever('R')
  const reversing = mergeControls([keyboard.read(moving, { leverEngaged }), dashboard.read()])
  assert.equal(reversing.direction, 'R')
  assert.equal(reversing.throttle, 1)

  dashboard.setLever('N')
  assert.equal(mergeControls([keyboard.read(moving, { leverEngaged }), dashboard.read()]).direction, 'N')

  dashboard.releaseLever()
  assert.equal(dashboard.read().explicitDirection, false)
})

// --- keyboard view commands ---------------------------------------------------

test('camera, inset and cab keys raise one command per press', () => {
  const keyboard = createKeyboardSource()
  for (const key of ['c', '1', '5', 'v', 'h', 'b', ' ']) assert.equal(keyboard.keyDown(key), true)
  keyboard.keyDown('c', true) // auto-repeat
  assert.deepEqual(keyboard.drainCommands(), [
    'cameraNext',
    'camera:first-person',
    'camera:front',
    'toggleInset',
    'horn',
    'seatbeltToggle',
    'parkingBrakeToggle',
  ])
  assert.equal(VIEW_COMMAND_BY_KEY['2'], 'camera:chase')
  // They are commands, not held controls or legacy keysUsed letters.
  assert.deepEqual(keyboard.drainLetters(), [])
  assert.equal(keyboard.keyDown('x'), false)
})

// --- cab gauges -------------------------------------------------------------

test('the gauges run with the engine and rest without it', () => {
  const gauges = createCabGauges()
  assert.deepEqual(gauges, { hours: START_HOURS, fuel: START_FUEL, temp: COLD_TEMP })

  stepCabGauges(gauges, { engineOn: false }, 60)
  assert.equal(gauges.hours, START_HOURS)
  assert.equal(gauges.fuel, START_FUEL)

  for (let i = 0; i < 60 * 60; i += 1) stepCabGauges(gauges, { engineOn: true, throttle: 1 }, 1 / 60)
  assert.ok(Math.abs(gauges.hours - (START_HOURS + 1 / 60)) < 1e-9)
  assert.ok(gauges.fuel < START_FUEL)
  assert.ok(Math.abs(gauges.temp - NORMAL_TEMP) < 0.01, 'warm after a minute')

  stepCabGauges(gauges, { engineOn: false }, 600)
  assert.ok(gauges.temp < NORMAL_TEMP / 2, 'cools once stopped')
})

// --- cockpit telemetry ------------------------------------------------------

test('the cockpit snapshot is flat and in real units', () => {
  const course = { start: { position: [0, 0, 0], heading: 0 }, decorations: [{ type: 'cone', position: [0.6, 0, 0] }] }
  const profile = defaultVehicleProfile('en')
  const world = createSimWorld(course, profile)
  const state = createSimState(course)
  state.truck.speed = kmh(12)
  state.forks.height = m(1.5)
  state.forks.tilt = -0.1
  const dashboard = createDashboardSource()
  const snapshot = cockpitSnapshot(state, course, {
    controls: neutralControls(),
    switches: dashboard.switches,
    gauges: createCabGauges(),
    proximity: proximityReadout(state, world),
  })

  assert.equal(snapshot.speedKmh, 12)
  assert.equal(snapshot.forkHeightM, 1.5)
  assert.equal(snapshot.tiltDeg, -5.7)
  assert.equal(snapshot.tilt, 'back')
  assert.equal(snapshot.direction, 'F')
  assert.equal(snapshot.keyPosition, 'off')
  assert.equal(typeof snapshot.proximityLeft, 'number')
  for (const [key, value] of Object.entries(snapshot)) {
    assert.ok(value === null || ['number', 'string', 'boolean'].includes(typeof value), `${key} is not a primitive`)
  }
})

test('the direction indicator follows the lever, then the input, then the motion', () => {
  const state = { truck: { speed: 0 } }
  const controls = neutralControls()
  const switches = { lever: null }
  assert.equal(displayedDirection(state, controls, switches), 'N')
  state.truck.speed = -0.3
  assert.equal(displayedDirection(state, controls, switches), 'R')
  controls.direction = 'F'
  assert.equal(displayedDirection(state, controls, switches), 'F')
  switches.lever = 'N'
  assert.equal(displayedDirection(state, controls, switches), 'N')
})
