import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAdminProgressReport } from '../src/lib/progressSummary.js'

const user = { email: 'trainee@mail.com', fullName: 'Trainee' }
const modules = [{ slug: 'pallet-testing' }, { slug: 'final-driving-test' }]

test('a module row carries its mission steps: the pass and the last run', () => {
  const lastRun = { finishedAt: 'T2', passed: false, score: 80, violations: {}, dangers: { overload: 1 }, rules: [], reasons: [] }
  const snapshot = {
    userId: 7,
    user,
    data: {
      simulations: {
        'final-driving-test': {
          percentage: 100,
          attemptStats: { 'final-test': { completedAt: 'T1', mission: { lastRun, runs: 2, bestScore: 95, passedAt: 'T1' } } },
        },
      },
    },
  }

  const { progress } = buildAdminProgressReport([snapshot], modules, {})
  const [pallets, finalTest] = progress
  assert.deepEqual(pallets.missions, [])
  assert.deepEqual(finalTest.missions, [
    { stepId: 'final-test', passedAt: 'T1', bestScore: 95, runs: 2, lastRun: { finishedAt: 'T2', passed: false, score: 80 } },
  ])
})
