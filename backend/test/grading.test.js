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

test('intoPartsQuiz prepends newest-first under parts.quizAttempts', () => {
  const place = intoPartsQuiz()
  const data = { parts: { viewedPartIds: ['a'], quizAttempts: [{ id: 'old' }] } }
  const next = place(data, { id: 'new' })

  assert.deepEqual(next.parts, { viewedPartIds: ['a'], quizAttempts: [{ id: 'new' }, { id: 'old' }] })
})

test('intoPartsQuiz folds legacy shapes in before prepending the new attempt', () => {
  const place = intoPartsQuiz()
  const data = {
    parts: {
      viewedPartIds: [],
      quizzes: { forklift: [{ id: 'fk' }], backhoe: [{ id: 'bh' }] },
      practiceAttempts: [{ id: 'legacy' }],
    },
  }
  const next = place(data, { id: 'new' })

  assert.deepEqual(next.parts.quizAttempts, [{ id: 'new' }, { id: 'fk' }, { id: 'legacy' }])
  assert.equal(next.parts.quizzes, undefined)
  assert.equal(next.parts.practiceAttempts, undefined)
})

test('intoPartsQuiz starts a list on a snapshot with no parts at all', () => {
  const next = intoPartsQuiz()({}, { id: 'new' })
  assert.deepEqual(next.parts, { viewedPartIds: [], quizAttempts: [{ id: 'new' }] })
})
