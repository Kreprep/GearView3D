import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyPhaseState, engineOnGauges, instrumentTargets, isPhaseComplete, phaseStateFor, visibleHotspotIds } from './walkAroundStep.js'

test('engine-off phase: incomplete until every check is ticked', () => {
  const data = { phase: 'engine-off', checks: [{ id: 'c1' }, { id: 'c2' }] }
  const state = { ...emptyPhaseState(), checks: ['c1'] }
  assert.equal(isPhaseComplete(data, state, false), false)
})

test('engine-off phase: complete once every check is ticked and no engine start required', () => {
  const data = { phase: 'engine-off', checks: [{ id: 'c1' }, { id: 'c2' }] }
  const state = { ...emptyPhaseState(), checks: ['c1', 'c2'] }
  assert.equal(isPhaseComplete(data, state, false), true)
})

test('engine-off phase: requireEngineStart gates completion even with every check ticked', () => {
  const data = { phase: 'engine-off', checks: [{ id: 'c1' }], requireEngineStart: true }
  const state = { ...emptyPhaseState(), checks: ['c1'] }
  assert.equal(isPhaseComplete(data, state, false), false)
  assert.equal(isPhaseComplete(data, state, true), true)
})

test('engine-off phase: no checks defined is never complete, not vacuously true', () => {
  const data = { phase: 'engine-off', checks: [] }
  assert.equal(isPhaseComplete(data, emptyPhaseState(), false), false)
})

test('engine-on phase: gauges must be answered correctly, not just answered', () => {
  const data = {
    phase: 'engine-on',
    devices: [{ id: 'horn' }],
    gauges: [{ id: 'fuel', answer: 'full' }],
  }
  const wrongState = { ...emptyPhaseState(), devices: ['horn'], gauges: { fuel: 'empty' } }
  const rightState = { ...emptyPhaseState(), devices: ['horn'], gauges: { fuel: 'full' } }

  assert.equal(isPhaseComplete(data, wrongState, false), false)
  assert.equal(isPhaseComplete(data, rightState, false), true)
})

test('engine-on phase: no devices or gauges at all is never complete', () => {
  const data = { phase: 'engine-on', devices: [], gauges: [] }
  assert.equal(isPhaseComplete(data, emptyPhaseState(), false), false)
})

test('defect-test phase: complete only when every scenario is answered correctly', () => {
  const data = { phase: 'defect-test', scenarios: [{ id: 's1', answer: 'unsafe' }, { id: 's2', answer: 'safe' }] }
  const partial = { ...emptyPhaseState(), scenarios: { s1: 'unsafe' } }
  const wrong = { ...emptyPhaseState(), scenarios: { s1: 'unsafe', s2: 'unsafe' } }
  const right = { ...emptyPhaseState(), scenarios: { s1: 'unsafe', s2: 'safe' } }

  assert.equal(isPhaseComplete(data, partial, false), false)
  assert.equal(isPhaseComplete(data, wrong, false), false)
  assert.equal(isPhaseComplete(data, right, false), true)
})

test('an unrecognized phase is never complete', () => {
  assert.equal(isPhaseComplete({ phase: 'not-a-phase' }, emptyPhaseState(), false), false)
  assert.equal(isPhaseComplete({}, emptyPhaseState(), false), false)
})

test('engine-on phase: requireEngineStart wants the start in this step, not the module-wide flag', () => {
  const data = { phase: 'engine-on', requireEngineStart: true, devices: [{ id: 'horn' }], gauges: [] }
  const answered = { ...emptyPhaseState(), devices: ['horn'] }
  // engineStarted (an older engine-off step's start) does not count.
  assert.equal(isPhaseComplete(data, answered, true), false)
  assert.equal(isPhaseComplete(data, { ...answered, started: true }, false), true)
  // A row from before the cab has no requireEngineStart and completes as before.
  assert.equal(isPhaseComplete({ ...data, requireEngineStart: undefined }, answered, false), true)
})

test('progress saved before `started` existed still reads', () => {
  const simulation = { walkAround: { 'engine-on-inspection': { devices: ['horn'], gauges: { 'hour-meter': 'Normal' } } } }
  const state = phaseStateFor(simulation, 'engine-on-inspection')
  assert.equal(state.started, false)
  assert.deepEqual(state.devices, ['horn'])
  assert.deepEqual(state.checks, [])
})

test('the ignition marker: engine-off only where the row starts the engine there, always in the cab', () => {
  const hotspots = [
    { id: 'forks', state: 'engine-off' },
    { id: 'ignition', state: 'ignition' },
    { id: 'horn', state: 'engine-on' },
    { id: 'dashboard' },
  ]
  const done = { engineOffComplete: true, engineStarted: false }
  assert.deepEqual(visibleHotspotIds({ phase: 'engine-off', requireEngineStart: true }, hotspots, done), ['forks', 'ignition', 'dashboard'])
  assert.deepEqual(visibleHotspotIds({ phase: 'engine-off', requireEngineStart: false }, hotspots, done), ['forks', 'dashboard'])
  assert.deepEqual(visibleHotspotIds({ phase: 'engine-on' }, hotspots, done), ['horn', 'ignition', 'dashboard'])
})

test('engine-on gauges: one per instrument on the dashboard, the rest as cards', () => {
  const data = {
    gauges: [
      { id: 'battery-charge-indicator', answer: 'Abnormal' },
      { id: 'charge-again', instrument: 'lamp.charge', answer: 'Normal' },
      { id: 'admin-made-gauge', answer: 'Normal' },
      { id: 'warning-lights', answer: 'Normal' },
    ],
  }
  const { dashboard, cards } = engineOnGauges(data)
  assert.deepEqual(
    dashboard.map(({ gauge, instrument }) => [gauge.id, instrument]),
    [['battery-charge-indicator', 'lamp.charge'], ['warning-lights', 'lamps']],
  )
  assert.deepEqual(cards.map((gauge) => gauge.id), ['charge-again', 'admin-made-gauge'])

  // The lamp row is judged from key ON; the rest once the engine runs.
  const state = { ...emptyPhaseState(), gauges: { 'battery-charge-indicator': 'Normal' } }
  assert.deepEqual(instrumentTargets(data, state, { keyOn: false, started: false }), {})
  assert.deepEqual(instrumentTargets(data, state, { keyOn: true, started: false }), { lamps: 'pending' })
  assert.deepEqual(instrumentTargets(data, state, { keyOn: true, started: true }), { 'lamp.charge': 'wrong', lamps: 'pending' })
})
