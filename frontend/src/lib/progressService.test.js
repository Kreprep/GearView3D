import '../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getChecklistCompletion,
  getOverallProgress,
  getPartsProgress,
  hydrateChecklistCounts,
} from './progressService.js'

function emptyProgress(overrides = {}) {
  return {
    version: 1,
    checklists: {},
    parts: { viewedPartIds: [], quizzes: {} },
    quizzes: {},
    simulations: {},
    ...overrides,
  }
}

test('getChecklistCompletion clamps a stored count above the module\'s current total', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ 'test-module': 3 }),
  })
  await hydrateChecklistCounts()

  // Five completed ids saved, but an admin has since trimmed the module to 3
  // items - completion must not read over 100%.
  const progress = emptyProgress({
    checklists: { 'test-module': { completedItems: ['a', 'b', 'c', 'd', 'e'] } },
  })
  const result = getChecklistCompletion(progress, 'test-module')

  assert.equal(result.totalCount, 3)
  assert.equal(result.completedCount, 3)
  assert.equal(result.percentage, 100)
})

test('getChecklistCompletion on a module with zero items is 0%, not NaN', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ 'empty-module': 0 }) })
  await hydrateChecklistCounts()

  const progress = emptyProgress()
  const result = getChecklistCompletion(progress, 'empty-module')
  assert.equal(result.percentage, 0)
  assert.equal(result.completedCount, 0)
})

test('getPartsProgress averages hotspot views with the latest parts-quiz score once the equipment has a quiz', () => {
  const progress = emptyProgress({
    parts: {
      viewedPartIds: ['h1', 'h2'],
      quizzes: { backhoe: [{ percentage: 80 }, { percentage: 20 }] },
    },
  })
  const hotspotIds = ['h1', 'h2', 'h3', 'h4']

  // 2/4 viewed = 50%, latest quiz attempt (newest-first, so 80) = 80%.
  const withQuiz = getPartsProgress(progress, hotspotIds, 'backhoe', true)
  assert.equal(withQuiz, Math.round(50 * 0.5 + 80 * 0.5))

  const withoutQuiz = getPartsProgress(progress, hotspotIds, 'backhoe', false)
  assert.equal(withoutQuiz, 50)
})

test('getPartsProgress with a quiz but no attempt yet counts the quiz half as 0', () => {
  const progress = emptyProgress({ parts: { viewedPartIds: ['h1'], quizzes: {} } })
  const result = getPartsProgress(progress, ['h1', 'h2'], 'backhoe', true)
  assert.equal(result, Math.round(50 * 0.5 + 0 * 0.5))
})

test('getOverallProgress averages module progress with parts percentage when parts exists', () => {
  const progress = emptyProgress({ simulations: { 'mod-a': { percentage: 60 } } })
  const result = getOverallProgress(progress, ['mod-a'], 40)
  assert.equal(result, Math.round((60 + 40) / 2))
})

test('getOverallProgress returns bare module progress when the equipment has no parts page', () => {
  const progress = emptyProgress({ simulations: { 'mod-a': { percentage: 60 } } })
  assert.equal(getOverallProgress(progress, ['mod-a'], null), 60)
  assert.equal(getOverallProgress(progress, ['mod-a'], undefined), 60)
})
