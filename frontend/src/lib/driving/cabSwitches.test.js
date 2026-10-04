import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCabGauges } from './cabGauges.js'
import { cabLampLit, cabLampMounts } from './cabLamps.js'
import { BULB_CHECK_SECONDS, createClusterClock, stepClusterClock } from './clusterClock.js'
import { cockpitSnapshot } from './cockpitTelemetry.js'
import { neutralControls } from './controls.js'
import { applyCabCommand, cabPowered, createDashboardSource } from './dashboardSource.js'
import { COMMAND_ACTIONS, defaultControllerConfig } from './gamepad.js'
import { createKeyboardSource } from './keyboardSource.js'
import { createWheelSource } from './wheelSource.js'
import { createSimState } from './simState.js'
import { WARNING_LAMPS } from '../inspection/instruments.js'

// The cab switches added for the engine-on inspection (docs/modules/
// module-improvements-plan.md, Phase 2): the beacon and the turn signals,
// the L key for the lights, the lamps on the truck and the cluster, and the
// bulb check. All view-side.

const COURSE = { start: { position: [0, 0, 0], heading: 0 } }

// --- switches ----------------------------------------------------------------

test('the turn-signal stalk flashes one side at a time and cancels on the same side', () => {
  const dashboard = createDashboardSource()
  assert.equal(dashboard.switches.turnSignal, 'off')
  dashboard.signal('left')
  assert.equal(dashboard.switches.turnSignal, 'left')
  dashboard.signal('right')
  assert.equal(dashboard.switches.turnSignal, 'right')
  dashboard.signal('right')
  assert.equal(dashboard.switches.turnSignal, 'off')
  dashboard.signal('up')
  assert.equal(dashboard.switches.turnSignal, 'off')
  assert.equal(dashboard.takeChanged(), true)
})

test('the beacon and lights are cab switches that never reach the simulation', () => {
  const dashboard = createDashboardSource()
  dashboard.toggle('beacon')
  dashboard.toggle('lights')
  dashboard.signal('left')
  assert.equal(dashboard.switches.beacon, true)
  assert.equal(dashboard.switches.lights, true)
  assert.deepEqual(dashboard.read(), { ...neutralControls() })
})

test('L, O, [ and ] work the switches, as the wheel actions do', () => {
  const keyboard = createKeyboardSource()
  for (const key of ['l', 'O', '[', ']']) assert.equal(keyboard.keyDown(key), true)
  const commands = keyboard.drainCommands()
  assert.deepEqual(commands, ['lights', 'beacon', 'turnSignalLeft', 'turnSignalRight'])
  for (const command of commands) assert.ok(COMMAND_ACTIONS.includes(command), `${command} is a wheel action too`)

  const dashboard = createDashboardSource()
  for (const command of commands) assert.equal(applyCabCommand(dashboard, command, false), true)
  assert.deepEqual([dashboard.switches.lights, dashboard.switches.beacon, dashboard.switches.turnSignal], [true, true, 'right'])
  // Camera commands are the view's.
  assert.equal(applyCabCommand(dashboard, 'cameraToggle', false), false)
})

test('the new wheel actions ship unbound and raise their command once bound', () => {
  const config = defaultControllerConfig()
  for (const action of ['lights', 'beacon', 'turnSignalLeft', 'turnSignalRight']) assert.deepEqual(config.bindings[action], [])

  config.bindings.beacon = [{ device: 'pad', kind: 'button', index: 10 }]
  const wheel = createWheelSource(config)
  const pad = (pressed) => [{ key: 'pad', axes: [], buttons: Array.from({ length: 12 }, (_, index) => (index === 10 && pressed ? 1 : 0)) }]
  wheel.update(pad(false))
  wheel.update(pad(true))
  wheel.update(pad(true))
  assert.deepEqual(wheel.drainCommands(), ['beacon'])
})

// --- lamps -------------------------------------------------------------------

test('the truck has lamps for every cab switch, the turn signals on their own side', () => {
  const mounts = Object.fromEntries(cabLampMounts().map((group) => [group.id, group]))
  for (const id of ['headlights', 'tailLights', 'beacon', 'turnLeft', 'turnRight']) assert.ok(mounts[id].lamps.length > 0, id)
  // The model faces +Z, so the operator's left is +X.
  assert.ok(mounts.turnLeft.lamps.every(([x]) => x > 0))
  assert.ok(mounts.turnRight.lamps.every(([x]) => x < 0))
  assert.equal(mounts.turnLeft.mode, 'blink')

  const switches = { ...createDashboardSource().switches, turnSignal: 'left', beacon: true }
  assert.equal(cabLampLit(mounts.turnLeft, switches, false), false, 'key off: nothing lights')
  switches.key = 'on'
  assert.equal(cabLampLit(mounts.turnLeft, switches, false), true)
  assert.equal(cabLampLit(mounts.turnRight, switches, false), false)
  assert.equal(cabLampLit(mounts.beacon, switches, false), true)
  assert.equal(cabLampLit(mounts.headlights, switches, false), false)
})

test('the bulb check lights every warning lamp for two seconds at key ON', () => {
  const clock = createClusterClock()
  stepClusterClock(clock, { powered: false, engineOn: false }, 1 / 60)
  assert.equal(clock.bulbCheck, 0)
  stepClusterClock(clock, { powered: true, engineOn: false }, 1 / 60)
  assert.equal(clock.bulbCheck, BULB_CHECK_SECONDS)

  const state = createSimState(COURSE)
  const switches = { ...createDashboardSource().switches, key: 'on', seatbelt: true }
  const snapshot = (at) => cockpitSnapshot(state, COURSE, { controls: neutralControls(), switches, gauges: createCabGauges(), clock: at })
  const field = (lamp) => `lamp${lamp[0].toUpperCase()}${lamp.slice(1)}`
  const during = snapshot(clock)
  for (const lamp of WARNING_LAMPS) assert.equal(during[field(lamp)], true, `${lamp} lit in the bulb check`)

  for (let i = 0; i < 2.1 * 60; i += 1) stepClusterClock(clock, { powered: true, engineOn: false }, 1 / 60)
  assert.equal(clock.bulbCheck, 0)
  const after = snapshot(clock)
  // Key on, engine stopped: oil and charge stay lit, the rest go out.
  assert.equal(after.lampOil, true)
  assert.equal(after.lampCharge, true)
  assert.equal(after.lampSeatbelt, false)
  assert.equal(after.lampOverload, false)

  // A second key ON after OFF checks the bulbs again.
  stepClusterClock(clock, { powered: false, engineOn: false }, 1 / 60)
  stepClusterClock(clock, { powered: true, engineOn: false }, 1 / 60)
  assert.equal(clock.bulbCheck, BULB_CHECK_SECONDS)
})

test('the cluster times faults from key ON and from the engine starting', () => {
  const clock = createClusterClock()
  stepClusterClock(clock, { powered: true, engineOn: false }, 0.5)
  stepClusterClock(clock, { powered: true, engineOn: false }, 0.5)
  assert.equal(clock.sinceKeyOn, 0.5)
  assert.equal(clock.sinceStart, null)
  stepClusterClock(clock, { powered: true, engineOn: true }, 0.5)
  stepClusterClock(clock, { powered: true, engineOn: true }, 0.5)
  assert.equal(clock.sinceStart, 0.5)
  stepClusterClock(clock, { powered: false, engineOn: false }, 0.5)
  assert.deepEqual([clock.sinceKeyOn, clock.sinceStart], [null, null])
})

test('with no clock and no faults the snapshot reads as before', () => {
  const state = createSimState(COURSE)
  const switches = { ...createDashboardSource().switches, key: 'on' }
  const snapshot = cockpitSnapshot(state, COURSE, { controls: neutralControls(), switches, gauges: createCabGauges() })
  assert.equal(cabPowered(switches, false), true)
  assert.equal(snapshot.lampSeatbelt, true)
  assert.equal(snapshot.lampParkingBrake, false)
  assert.equal(snapshot.lampTurnLeft, false)
  assert.equal(snapshot.turnSignal, 'off')
  assert.equal(snapshot.beacon, false)
})
