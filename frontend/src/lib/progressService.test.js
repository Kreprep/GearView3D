import '../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import {
  getChecklistCompletion,
  getOverallProgress,
  getPartsProgress,
  getStoredProgress,
  hydrateChecklistCounts,
  hydrateProgressFromServer,
  markPartViewed,
} from './progressService.js'
import { migrateParts } from './migrateParts.js'

function emptyProgress(overrides = {}) {
  return {
    version: 1,
    checklists: {},
    parts: { viewedPartIds: [], quizAttempts: [] },
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

test('getPartsProgress averages hotspot views with the latest parts-quiz score once there is a quiz', () => {
  const progress = emptyProgress({
    parts: {
      viewedPartIds: ['h1', 'h2'],
      quizAttempts: [{ percentage: 80 }, { percentage: 20 }],
    },
  })
  const hotspotIds = ['h1', 'h2', 'h3', 'h4']

  // 2/4 viewed = 50%, latest quiz attempt (newest-first, so 80) = 80%.
  const withQuiz = getPartsProgress(progress, hotspotIds, true)
  assert.equal(withQuiz, Math.round(50 * 0.5 + 80 * 0.5))

  const withoutQuiz = getPartsProgress(progress, hotspotIds, false)
  assert.equal(withoutQuiz, 50)
})

test('getPartsProgress with a quiz but no attempt yet counts the quiz half as 0', () => {
  const progress = emptyProgress({ parts: { viewedPartIds: ['h1'], quizAttempts: [] } })
  const result = getPartsProgress(progress, ['h1', 'h2'], true)
  assert.equal(result, Math.round(50 * 0.5 + 0 * 0.5))
})

test('getOverallProgress averages module progress with parts percentage when parts exists', () => {
  const progress = emptyProgress({ simulations: { 'mod-a': { percentage: 60 } } })
  const result = getOverallProgress(progress, ['mod-a'], 40)
  assert.equal(result, Math.round((60 + 40) / 2))
})

test('getOverallProgress returns bare module progress when there is no parts page', () => {
  const progress = emptyProgress({ simulations: { 'mod-a': { percentage: 60 } } })
  assert.equal(getOverallProgress(progress, ['mod-a'], null), 60)
  assert.equal(getOverallProgress(progress, ['mod-a'], undefined), 60)
})

test('migrateParts folds the per-equipment map and practiceAttempts into quizAttempts, newest first', () => {
  const result = migrateParts({
    viewedPartIds: ['forks'],
    quizzes: { forklift: [{ id: 'f2' }, { id: 'f1' }] },
    practiceAttempts: [{ id: 'legacy' }],
  })

  assert.deepEqual(result, {
    viewedPartIds: ['forks'],
    quizAttempts: [{ id: 'f2' }, { id: 'f1' }, { id: 'legacy' }],
  })
})

test('migrateParts drops attempts stored for any other equipment', () => {
  const result = migrateParts({ quizzes: { backhoe: [{ id: 'b1' }], crane: [{ id: 'c1' }] } })
  assert.deepEqual(result.quizAttempts, [])
})

test('migrateParts passes an already-migrated shape through unchanged', () => {
  const parts = { viewedPartIds: ['mast'], quizAttempts: [{ id: 'a2' }, { id: 'a1' }] }
  assert.deepEqual(migrateParts(parts), parts)
})

test('migrateParts handles a missing or malformed parts object', () => {
  assert.deepEqual(migrateParts(undefined), { viewedPartIds: [], quizAttempts: [] })
  assert.deepEqual(migrateParts({ quizAttempts: 'bad', quizzes: { forklift: null } }), { viewedPartIds: [], quizAttempts: [] })
})

// The reset race, client side (plan 4.7). The server answers a push based on
// a revision older than its own with 409; the local copy is what was reset,
// so it is dropped and the server's read back instead of pushed again.
test('a push refused as stale drops the local copy and re-reads the reset one', async (t) => {
  const requests = []
  let serverDocument = emptyProgress({ parts: { viewedPartIds: ['mast'], quizAttempts: [] }, revision: 0 })
  globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
    requests.push({ method, body: body && JSON.parse(body) })
    if (method === 'PUT') return { ok: false, status: 409, json: async () => ({ error: 'Your progress was reset.' }) }
    return { ok: true, status: 200, json: async () => serverDocument }
  }

  await hydrateProgressFromServer()
  assert.equal(getStoredProgress().revision, 0)

  // An instructor resets the learner; this browser does not know yet.
  serverDocument = emptyProgress({ revision: 1 })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  markPartViewed('forks')
  assert.deepEqual(getStoredProgress().parts.viewedPartIds, ['mast', 'forks'])

  t.mock.timers.tick(800)
  t.mock.timers.reset()
  // The refused push, then the re-read, each settle over a few microtasks.
  for (let i = 0; i < 20 && getStoredProgress().revision !== 1; i += 1) await nextTurn()

  const push = requests.find(({ method }) => method === 'PUT')
  assert.equal(push.body.baseRevision, 0)
  assert.equal('revision' in push.body, false, 'the revision travels as baseRevision only')

  const local = getStoredProgress()
  assert.equal(local.revision, 1)
  assert.deepEqual(local.parts.viewedPartIds, [])
  assert.equal(requests.filter(({ method }) => method === 'PUT').length, 1, 'nothing is pushed over the reset')
})

test('a push after the re-read carries the new revision', async (t) => {
  const pushes = []
  globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
    if (method === 'PUT') {
      pushes.push(JSON.parse(body))
      return { ok: true, status: 200, json: async () => ({ saved: true }) }
    }
    return { ok: true, status: 200, json: async () => emptyProgress({ revision: 3 }) }
  }

  await hydrateProgressFromServer()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  markPartViewed('mast')
  t.mock.timers.tick(800)
  t.mock.timers.reset()
  await nextTurn()

  assert.equal(pushes.length, 1)
  assert.equal(pushes[0].baseRevision, 3)
  assert.deepEqual(pushes[0].parts.viewedPartIds, ['mast'])
})
