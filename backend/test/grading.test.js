import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreAnswers, intoModuleQuiz, intoPartsQuiz, migrateParts } from '../src/lib/grading.js'

test('scoreAnswers trims whitespace before comparing', () => {
  const questions = [{ id: 'q1', answer: 'Forks' }]
  const result = scoreAnswers(questions, { q1: '  Forks  ' })
  assert.equal(result.score, 1)
  assert.equal(result.results.q1.correct, true)
})

test('scoreAnswers treats a missing answer as wrong, not a crash', () => {
  const questions = [
    { id: 'q1', answer: 'Forks' },
    { id: 'q2', answer: 'Mast' },
  ]
  const result = scoreAnswers(questions, { q1: 'Forks' })
  assert.equal(result.score, 1)
  assert.equal(result.total, 2)
  assert.equal(result.percentage, 50)
  assert.equal(result.results.q2.correct, false)
  assert.equal(result.results.q2.correctAnswer, 'Mast')
})

test('scoreAnswers on zero questions reports 0%, not NaN', () => {
  const result = scoreAnswers([], {})
  assert.equal(result.total, 0)
  assert.equal(result.percentage, 0)
})

test('intoModuleQuiz prepends newest-first and keeps other module keys', () => {
  const place = intoModuleQuiz('load-handling')
  const data = { quizzes: { 'post-operation': [{ id: 'old' }] } }
  const next = place(data, { id: 'new' })

  assert.deepEqual(next.quizzes['load-handling'], [{ id: 'new' }])
  assert.deepEqual(next.quizzes['post-operation'], [{ id: 'old' }])
})

test('intoModuleQuiz prepends onto an existing list for the same module', () => {
  const place = intoModuleQuiz('load-handling')
  const data = { quizzes: { 'load-handling': [{ id: 'old' }] } }
  const next = place(data, { id: 'new' })

  assert.deepEqual(next.quizzes['load-handling'], [{ id: 'new' }, { id: 'old' }])
})

test('intoPartsQuiz prepends newest-first under parts.quizzes[equipmentId]', () => {
  const place = intoPartsQuiz('backhoe')
  const data = { parts: { viewedPartIds: ['a'], quizzes: { forklift: [{ id: 'fk' }] } } }
  const next = place(data, { id: 'new' })

  assert.deepEqual(next.parts.quizzes.backhoe, [{ id: 'new' }])
  assert.deepEqual(next.parts.quizzes.forklift, [{ id: 'fk' }])
  assert.deepEqual(next.parts.viewedPartIds, ['a'])
})

test('intoPartsQuiz folds legacy practiceAttempts into forklift before appending', () => {
  const place = intoPartsQuiz('forklift')
  const data = { parts: { practiceAttempts: [{ id: 'legacy' }], quizzes: {} } }
  const next = place(data, { id: 'new' })

  assert.deepEqual(next.parts.quizzes.forklift, [{ id: 'new' }, { id: 'legacy' }])
  assert.equal(next.parts.practiceAttempts, undefined)
})

test('migrateParts is a no-op when there is no legacy data', () => {
  const parts = { viewedPartIds: ['x'], quizzes: { forklift: [{ id: 'a' }] } }
  const result = migrateParts(parts)
  assert.deepEqual(result, parts)
})

test('migrateParts handles a completely empty/undefined parts object', () => {
  const result = migrateParts(undefined)
  assert.deepEqual(result, { viewedPartIds: [], quizzes: {} })
})
