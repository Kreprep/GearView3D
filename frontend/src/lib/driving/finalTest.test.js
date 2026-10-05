import '../../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drivingCourses } from '../../data/drivingCourse.js'
import { buildDefaultCourse } from '../../data/courseDefaults.js'
import { drivingScenarios, runScenario } from '../../test-helpers/drivingScenarios.js'
import { createHeadlessDrive } from '../../test-helpers/headlessDrive.js'
import { validateCourse } from '../courseGoals.js'
import { resolvePassRules, scoreMission } from '../missionScore.js'
import { createSafetyMonitor } from './safetyMonitor.js'

// The Final Driving Test (docs/modules/module-improvements-plan.md, Phase 7),
// driven headlessly the way a learner drives it, with the safety signs
// watching as the viewer's monitor does, and the run scored with the course's
// pass rules as the module page scores it on `course-complete`.

const course = drivingCourses['final-test']
const scenarioById = (id) => drivingScenarios.find((scenario) => scenario.id === id)

// The learner looks behind whenever the truck reverses, as the course asks.
const lookingWhereGoing = (state) => ({ firstPerson: true, lookYaw: state.truck.speed < -0.01 ? Math.PI : 0 })

function driveAndScore(id) {
  const monitor = createSafetyMonitor(course)
  const sim = createHeadlessDrive(course, {
    afterStep(core) {
      monitor.update(core.state, core.world, lookingWhereGoing(core.state))
    },
  })
  runScenario(scenarioById(id), { observe: sim.observe, frame: sim.frame })
  const result = { events: sim.events, view: sim.view(), state: sim.core.state, tally: monitor.tally() }
  sim.dispose()
  return { ...result, score: scoreMission(result.tally, resolvePassRules(course)) }
}

const taskIds = (events) => events.filter((event) => event.type === 'mission-task').map((event) => event.id)

test('the stock course and its step row validate as a mission', () => {
  assert.deepEqual(validateCourse(course), [])
  const row = buildDefaultCourse('final-test')
  assert.equal(row.goalType, 'mission')
  assert.equal(row.moduleSlug, 'final-driving-test')
  assert.deepEqual(validateCourse({ ...row.data, goalType: row.goalType }), [])
})

test('a clean drive finishes every task in order and passes the scorecard', () => {
  const { events, view, state, score } = driveAndScore('final-test-pass')
  assert.equal(view.failed, false)
  assert.deepEqual(taskIds(events), ['start', 'reverse-out', 'crossing', 'store', 'retrieve', 'park'])
  assert.equal(events.filter((event) => event.type === 'mission-task').at(-1).isLast, true)
  assert.equal(view.parked, true)
  // The pallet within the plate is on the middle shelf, the one off the top
  // shelf is at the dock, and the one over the derated plate was left alone.
  assert.deepEqual(state.pallets.map((pallet) => pallet.state), ['delivered', 'ground', 'delivered'])
  assert.equal(score.passed, true, JSON.stringify(score.reasons))
  assert.equal(score.score, 100)
})

test('the same drive with one danger sign finishes the mission but fails the scorecard', () => {
  const { events, view, tally, score } = driveAndScore('final-test-danger')
  assert.equal(view.failed, false)
  assert.deepEqual(taskIds(events), ['start', 'reverse-out', 'crossing', 'store', 'retrieve', 'park'])
  // Up to the rack too fast: the obstacle sign came up and rose to danger,
  // once, and nothing was struck.
  assert.deepEqual(tally.dangers, { 'obstacle-ahead': 1 })
  assert.equal(score.dangerCount, 1)
  assert.equal(score.passed, false)
  assert.deepEqual(score.reasons, [{ type: 'dangers', count: 1 }])
  assert.equal(score.score, 80)
})
