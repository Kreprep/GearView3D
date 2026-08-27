import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSimulationState, isStepComplete, withStepComplete } from './simulationProgress.js'

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
