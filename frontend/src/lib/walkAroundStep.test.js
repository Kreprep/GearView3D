import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyPhaseState, isPhaseComplete } from './walkAroundStep.js'

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
