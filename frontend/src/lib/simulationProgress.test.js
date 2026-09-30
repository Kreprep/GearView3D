import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attemptStatsFor,
  buildSimulationState,
  emptyAttemptTally,
  isStepComplete,
  tallyAlert,
  violationTotal,
  withAttemptComplete,
  withAttemptFail,
  withStepComplete,
} from './simulationProgress.js'

test('buildSimulationState computes percentage against the current graded list', () => {
  const state = buildSimulationState({ stepsComplete: { a: true, b: false } }, ['a', 'b', 'c'])
  assert.equal(state.completedCount, 1)
  assert.equal(state.gradedCount, 3)
  assert.equal(state.percentage, 33)
  assert.equal(state.complete, false)
})

test('buildSimulationState reports complete when every graded step is done', () => {
  const state = buildSimulationState({ stepsComplete: { a: true, b: true } }, ['a', 'b'])
  assert.equal(state.percentage, 100)
  assert.equal(state.complete, true)
})

test('buildSimulationState with no graded steps is 0%, not NaN, and not complete', () => {
  const state = buildSimulationState({}, [])
  assert.equal(state.percentage, 0)
  assert.equal(state.complete, false)
})

test('buildSimulationState ignores entries for steps no longer in the graded list, but keeps them', () => {
  // A step an admin deleted stays in stepsComplete but doesn't count toward
  // the denominator or numerator - and isn't pruned, so re-adding it restores
  // completion for free.
  const saved = { stepsComplete: { deleted: true, kept: true } }
  const state = buildSimulationState(saved, ['kept'])

  assert.equal(state.completedCount, 1)
  assert.equal(state.gradedCount, 1)
  assert.equal(state.percentage, 100)
  assert.equal(state.stepsComplete.deleted, true)
})

test('isStepComplete reads a step id out of stepsComplete, defaulting missing to false', () => {
  const simulation = { stepsComplete: { start: true } }
  assert.equal(isStepComplete(simulation, 'start'), true)
  assert.equal(isStepComplete(simulation, 'finish'), false)
  assert.equal(isStepComplete(undefined, 'start'), false)
})

test('withStepComplete marks one step without dropping the others', () => {
  const simulation = { stepsComplete: { start: true } }
  const patch = withStepComplete(simulation, 'finish')
  assert.deepEqual(patch.stepsComplete, { start: true, finish: true })
})

// --- attemptStats: the safety record per driving step ------------------------

test('tallyAlert counts a sign coming up as a violation, and a danger as both', () => {
  let tally = emptyAttemptTally()
  tally = tallyAlert(tally, { id: 'overspeed', severity: 'caution' })
  tally = tallyAlert(tally, { id: 'overspeed', severity: 'caution' })
  tally = tallyAlert(tally, { id: 'overload', severity: 'danger' })
  assert.deepEqual(tally, { violations: { overspeed: 2, overload: 1 }, dangers: { overload: 1 } })
  assert.equal(violationTotal(tally.violations), 3)
})

test('tallyAlert counts an escalation under dangers only: it is the same violation', () => {
  let tally = tallyAlert(emptyAttemptTally(), { id: 'obstacle-ahead', severity: 'caution' })
  tally = tallyAlert(tally, { id: 'obstacle-ahead', severity: 'danger', escalation: true })
  assert.deepEqual(tally, { violations: { 'obstacle-ahead': 1 }, dangers: { 'obstacle-ahead': 1 } })
})

test('tallyAlert does not mutate the tally it is given', () => {
  const tally = emptyAttemptTally()
  tallyAlert(tally, { id: 'overspeed', severity: 'danger' })
  assert.deepEqual(tally, emptyAttemptTally())
})

test('withAttemptComplete records the latest completion and carries the fails before it', () => {
  let simulation = {}
  simulation = { ...simulation, ...withAttemptFail(simulation, 'park') }
  simulation = { ...simulation, ...withAttemptFail(simulation, 'park') }
  assert.equal(attemptStatsFor(simulation, 'park').failsSinceCompletion, 2)

  const tally = { violations: { overspeed: 2, 'tail-swing': 1 }, dangers: {} }
  simulation = { ...simulation, ...withAttemptComplete(simulation, 'park', { tally, completedAt: '2026-09-30T10:00:00.000Z' }) }
  assert.deepEqual(attemptStatsFor(simulation, 'park'), {
    completedAt: '2026-09-30T10:00:00.000Z',
    violations: { overspeed: 2, 'tail-swing': 1 },
    dangers: {},
    fails: 2,
    bestViolations: 3,
    failsSinceCompletion: 0,
  })
})

test('bestViolations keeps the cleanest completion; the record is always the latest', () => {
  let simulation = {}
  const complete = (violations, completedAt) => {
    simulation = { ...simulation, ...withAttemptComplete(simulation, 'park', { tally: { violations, dangers: {} }, completedAt }) }
    return attemptStatsFor(simulation, 'park')
  }
  assert.equal(complete({ overspeed: 3 }, 'a').bestViolations, 3)
  assert.equal(complete({}, 'b').bestViolations, 0)
  const third = complete({ overspeed: 1, 'turn-speed': 1 }, 'c')
  assert.equal(third.bestViolations, 0)
  assert.deepEqual(third.violations, { overspeed: 1, 'turn-speed': 1 })
  assert.equal(third.completedAt, 'c')
  assert.equal(third.fails, 0)
})

test('attempt stats are per step and leave the other steps alone', () => {
  let simulation = { stepsComplete: { a: true } }
  simulation = { ...simulation, ...withAttemptComplete(simulation, 'a', { completedAt: 'x' }) }
  simulation = { ...simulation, ...withAttemptFail(simulation, 'b') }
  assert.equal(attemptStatsFor(simulation, 'a').completedAt, 'x')
  assert.deepEqual(attemptStatsFor(simulation, 'a').violations, {})
  assert.equal(attemptStatsFor(simulation, 'b').failsSinceCompletion, 1)
  assert.equal(attemptStatsFor(simulation, 'c'), null)
  assert.deepEqual(simulation.stepsComplete, { a: true })
})
