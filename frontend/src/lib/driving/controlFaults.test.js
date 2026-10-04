import '../../test-helpers/physics.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import { INSPECTION_PAD } from '../../data/inspectionPad.js'
import { MAX_STEER_ANGLE, STEERING_WHEEL_LOCK, STOP_SPEED_EPSILON } from './constants.js'
import { neutralControls } from './controls.js'
import { linkageSteerAngle, NO_CONTROL_FAULTS, normalizeControlFaults, steeringPlayInput, takeUpPlay } from './controlFaults.js'
import { createSimCore } from './simCore.js'
import { SIM_DT } from './simLoop.js'
import { kmh, mps } from './units.js'

// The control faults of the defect test's cab scenarios (docs/modules/
// module-improvements-plan.md, section 3.4), each on the headless core. With
// them off the characterization trace (simCore.characterization.test.js)
// covers the unchanged behaviour.

const profile = defaultVehicleProfile('en')
const deg = (degrees) => (degrees * Math.PI) / 180

const controls = (overrides = {}) => ({ ...neutralControls(), seatbelt: true, ...overrides })

// A core on the empty inspection pad with the engine running and the parking
// brake off.
function runningCore(faults) {
  const core = createSimCore(INSPECTION_PAD, profile)
  if (faults) core.setFaults(faults)
  core.command('engineStart')
  core.step(SIM_DT, controls({ parkingBrake: true, direction: 'N' }))
  assert.equal(core.state.truck.engineOn, true, 'the engine starts through the interlock')
  return core
}

const run = (core, seconds, input) => {
  for (let step = 0; step < Math.round(seconds / SIM_DT); step += 1) core.step(SIM_DT, input)
}

// Accelerate to `speed` in F, then hold full service brake: how far the truck
// rolls before it stops.
function stoppingDistance(faults, speed = kmh(8)) {
  const core = runningCore(faults)
  for (let step = 0; step < 2000 && core.state.truck.speed < speed; step += 1) core.step(SIM_DT, controls({ throttle: 1, direction: 'F' }))
  const from = core.state.truck.z
  for (let step = 0; step < 2000 && core.state.truck.speed > STOP_SPEED_EPSILON; step += 1) core.step(SIM_DT, controls({ brake: 1, direction: 'F' }))
  const distance = core.state.truck.z - from
  core.dispose()
  return distance
}

test('normalizeControlFaults: everything off by default, values clamped, unknown keys dropped', () => {
  assert.deepEqual(normalizeControlFaults(undefined), NO_CONTROL_FAULTS)
  assert.deepEqual(normalizeControlFaults({ brakeFade: 'lots', extra: 1 }), NO_CONTROL_FAULTS)
  const clamped = normalizeControlFaults({ brakeFade: 5, steeringPlay: -1, liftDrift: 99 })
  assert.equal(clamped.brakeFade, 0.9)
  assert.equal(clamped.steeringPlay, 0)
  assert.ok(clamped.liftDrift > 0 && clamped.liftDrift <= mps(0.5))
})

test('a core starts with every fault off', () => {
  const core = createSimCore(INSPECTION_PAD, profile)
  assert.deepEqual(core.state.faults, NO_CONTROL_FAULTS)
  core.dispose()
})

test('brake fade: losing half the service brake doubles the stopping distance', () => {
  const healthy = stoppingDistance(null)
  const faded = stoppingDistance({ brakeFade: 0.5 })
  assert.ok(healthy > 0)
  // Coasting drag still helps the faded brake, so a little under double.
  assert.ok(faded / healthy > 1.7 && faded / healthy < 2.05, `ratio ${faded / healthy}`)
})

test('brake fade leaves the parking brake its hold', () => {
  const core = runningCore({ brakeFade: 0.9 })
  run(core, 2, controls({ throttle: 1, direction: 'F', parkingBrake: true }))
  assert.equal(core.state.truck.speed, 0)
  core.dispose()
})

test('steering play: the wheel turns through the play before the rear wheels move, and still reaches full lock', () => {
  const play = deg(30)
  const core = runningCore({ steeringPlay: play })
  const share = steeringPlayInput(core.state.faults)
  assert.ok(Math.abs(share - play / STEERING_WHEEL_LOCK) < 1e-12)

  // Inside half the play either way of centre: nothing reaches the wheels.
  run(core, 1, controls({ steer: share * 0.45 }))
  assert.ok(Math.abs(core.state.truck.steer) < 1e-9, `steer ${core.state.truck.steer}`)
  run(core, 1, controls({ steer: -share * 0.45 }))
  assert.ok(Math.abs(core.state.truck.steer) < 1e-9)

  // Past it, the wheels follow; at full input they reach lock.
  run(core, 2, controls({ steer: 1 }))
  assert.ok(Math.abs(Math.abs(core.state.truck.steer) - MAX_STEER_ANGLE) < 1e-3)

  // Back from lock, the first `play` of the wheel's turn does nothing.
  run(core, 2, controls({ steer: 1 - share * 0.9 }))
  assert.ok(Math.abs(Math.abs(core.state.truck.steer) - MAX_STEER_ANGLE) < 1e-3, 'still at lock inside the play')
  core.dispose()
})

test('a healthy steering box has no play', () => {
  const core = runningCore(null)
  run(core, 1, controls({ steer: 0.05 }))
  assert.ok(Math.abs(core.state.truck.steer) > 0.05 * MAX_STEER_ANGLE * 0.9)
  core.dispose()
})

test('takeUpPlay and linkageSteerAngle: backlash both ways', () => {
  assert.equal(takeUpPlay(0, 0.3, 0), 0.3)
  assert.equal(takeUpPlay(0, 0.05, 0.2), 0)
  assert.ok(Math.abs(takeUpPlay(0, 0.3, 0.2) - 0.2) < 1e-12)
  assert.ok(Math.abs(takeUpPlay(0.2, 0.15, 0.2) - 0.2) < 1e-12)
  assert.ok(Math.abs(linkageSteerAngle(0.9, 0.2) - MAX_STEER_ANGLE) < 1e-12)
})

test('lift drift: raised forks sink with the lever released, engine off too, and stop at the floor', () => {
  const drift = mps(0.05)
  const core = runningCore({ liftDrift: drift })
  run(core, 0.6, controls({ lift: 1 }))
  const raised = core.state.forks.height
  assert.ok(raised > 0.05)
  // Let the valve close, then watch for two seconds.
  run(core, 0.3, controls())
  const before = core.state.forks.height
  run(core, 2, controls())
  assert.ok(Math.abs(before - core.state.forks.height - drift * 2) < drift * SIM_DT * 2, `sank ${before - core.state.forks.height}`)

  core.command('engineStop')
  const stopped = core.state.forks.height
  run(core, 1, controls())
  assert.ok(core.state.forks.height < stopped, 'it sinks with the engine off')

  run(core, 60, controls())
  assert.ok(core.state.forks.height >= 0)
  assert.ok(core.state.forks.height < 0.01)
  core.dispose()
})

test('healthy forks hold their height', () => {
  const core = runningCore(null)
  run(core, 0.6, controls({ lift: 1 }))
  run(core, 0.3, controls())
  const held = core.state.forks.height
  run(core, 3, controls())
  assert.equal(core.state.forks.height, held)
  core.dispose()
})
