import '../../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drivingCourses } from '../../data/drivingCourse.js'
import { PALLET_DROP_LEAN, PALLET_LEVEL_LEAN } from '../../data/palletProfile.js'
import { RACK_LEVEL_HEIGHTS } from '../../data/rackProfile.js'
import { drivingScenarios, runScenario, scenarioCourse } from '../../test-helpers/drivingScenarios.js'
import { createHeadlessDrive } from '../../test-helpers/headlessDrive.js'
import { validateCourse } from '../courseGoals.js'
import { buildDefaultCourse } from '../../data/courseDefaults.js'

// The physics, driven the way a learner drives it: the headless core through
// the keyboard and dashboard sources, on the built-in courses (docs/revisions/
// post-defense-plan.md, Phase 7's scenario tests). The scripted drives are the
// ones the characterization test replays (test-helpers/drivingScenarios.js);
// here each is judged on what the physics was supposed to do. The same
// behaviours on the bare physics world, against friction theory, are in
// lib/physics/world.test.js.

const scenarioById = (id) => drivingScenarios.find((scenario) => scenario.id === id)

// Drive a scenario. Returns the final view, the events and everything
// `watch(view)` returned along the way.
function drive(id, watch = () => null) {
  const scenario = scenarioById(id)
  const sim = createHeadlessDrive(scenarioCourse(scenario))
  if (scenario.setup) sim.core.debugSet(scenario.setup)
  const watched = []
  runScenario(scenario, {
    observe: sim.observe,
    frame(keys, options) {
      sim.frame(keys, options)
      watched.push(watch(sim.view(), sim.core.state))
    },
  })
  const result = { view: sim.view(), state: sim.core.state, events: sim.events, watched }
  sim.dispose()
  return result
}

const types = (events) => events.map((event) => event.type)
const failOf = (events) => events.find((event) => event.type === 'fail')?.reason ?? null

test('a seated load survives hard braking with the mast tilted back', () => {
  const { view, events, watched } = drive('load-held', (v) => v.pallets[0].slipSpeed)
  assert.equal(failOf(events), null)
  assert.equal(view.pallets[0].state, 'carried')
  assert.ok(view.pallets[0].onForks)
  // It crept on the tines, no more.
  assert.ok(Math.max(...watched) < 0.08, `slid at ${Math.max(...watched)}`)
})

test('a load on a short bite slides off under hard braking, and that fails the attempt', () => {
  const { view, events } = drive('load-dropped')
  assert.equal(failOf(events), 'load-dropped')
  // Off the forks, on the floor ahead of the truck.
  assert.equal(view.pallets[0].onForks, false)
  assert.ok(view.pallets[0].position.y < 0.01)
  assert.ok(view.pallets[0].position.z > view.z + 0.6)
})

test('a course that does not fail a lost load lets it be lost', () => {
  const scenario = scenarioById('load-dropped')
  const sim = createHeadlessDrive({ ...scenarioCourse(scenario), failConditions: { overload: true } })
  runScenario(scenario, { observe: sim.observe, frame: sim.frame })
  assert.equal(sim.view().failed, false)
  assert.equal(sim.view().pallets[0].onForks, false)
  sim.dispose()
})

test('a one-tine pickup tips the pallet', () => {
  const { view, watched } = drive('one-tine-pickup', (v) => v.pallets[0].lean)
  assert.ok(Math.max(...watched) > PALLET_DROP_LEAN, `leaned ${Math.max(...watched)} rad`)
  // Never carried: it rolled off the one fork.
  assert.notEqual(view.pallets[0].state, 'carried')
  assert.equal(view.deliveredCount, 0)
})

test('ramming a pallet at 8 km/h fails as a pallet impact, and shoves it', () => {
  const { view, events } = drive('pallet-impact')
  assert.equal(failOf(events), 'pallet-impact')
  const impact = events.find((event) => event.type === 'impact')
  assert.deepEqual([impact.what, impact.speed > 0.34], ['pallet', true])
  assert.ok(view.pallets[0].position.z > drivingCourses['pallet-pickup'].pallet.position[2] + 0.05)
})

test('driving the forks into a pallet at a crawl is not an impact', () => {
  for (const id of ['precision-carry-delivery', 'pallet-pickup-delivery']) {
    assert.equal(failOf(drive(id).events), null, id)
  }
})

test('a load set on the target shelf is delivered, resting on the rack', () => {
  for (const [id, level] of [['rack-storage-delivery', 'middle'], ['rack-storage-top-delivery', 'top']]) {
    const { view, events, state } = drive(id)
    assert.equal(failOf(events), null, id)
    assert.deepEqual(types(events).filter((type) => type.startsWith('pallet-')), ['pallet-lifted', 'pallet-dropped', 'pallet-delivered'], id)
    const pallet = state.pallets[0]
    assert.equal(view.deliveredCount, 1, id)
    assert.ok(Math.abs(pallet.position.y - RACK_LEVEL_HEIGHTS[level]) < 0.002, `${id}: resting at ${pallet.position.y}`)
    assert.deepEqual([pallet.touch.rackLevel, pallet.touch.forks], [level, false], id)
    assert.ok(pallet.lean < PALLET_LEVEL_LEAN, id)
  }
})

test('a load set down in the drop zone is delivered once the forks are out', () => {
  for (const id of ['precision-carry-delivery', 'pallet-pickup-delivery']) {
    const { view, events } = drive(id)
    assert.deepEqual(types(events).filter((type) => type.startsWith('pallet-')), ['pallet-lifted', 'pallet-dropped', 'pallet-delivered'], id)
    assert.equal(view.deliveredCount, 1, id)
    assert.ok(Math.abs(view.pallets[0].position.y) < 0.001, id)
  }
})

test('a raised laden sharp turn tips the truck sideways; the same turn lowered does not', () => {
  const raised = drive('tip-over-turn', (v) => v.lateralMargin)
  assert.equal(failOf(raised.events), 'tip-over')
  // A left swerve throws the truck onto its right side.
  assert.equal(raised.view.tipAxis, 'right')
  assert.ok(raised.view.tipAngle > 1)

  const lowered = drive('turn-lowered', (v) => v.lateralMargin)
  assert.equal(failOf(lowered.events), null)
  assert.equal(lowered.view.tipAngle, 0)
  assert.ok(Math.min(...lowered.watched) > 0.3, `margin ${Math.min(...lowered.watched)}`)
  assert.equal(lowered.view.pallets[0].state, 'carried')
})

test('a load half as heavy again as the rating tips the truck forward as it lifts', () => {
  const { view, events } = drive('tip-over-forward')
  assert.equal(failOf(events), 'tip-over')
  assert.equal(view.tipAxis, 'forward')
  // The truck comes to rest on its fork tips.
  assert.ok(view.tipAngle > 0.02 && view.tipAngle < 0.5, `pitched ${view.tipAngle}`)
})

test('lifting a pallet over the capacity plate fails as an overload where the course says so', () => {
  assert.equal(failOf(drive('load-limits-overload').events), 'overload')
})

test('a cone the truck touches fails the attempt', () => {
  const { events, state } = drive('cone-hit')
  assert.equal(failOf(events), 'cone')
  assert.deepEqual(events.filter((event) => event.type === 'impact').map((event) => event.what), ['cone'])
  assert.equal(state.cones.filter((cone) => cone.hit).length, 1)
})

test('every built-in driving course validates and is completable headless', () => {
  const completes = {
    'accelerate-course': 'accelerate-course',
    'accelerate-brake': 'accelerate-brake',
    'turning-practice': 'turning-practice',
    'driving-course': 'driving-course',
    'secure-parking': 'secure-parking',
    'parallel-parking': 'parallel-parking',
    'forklift-gap-parking': 'forklift-gap-parking',
    'precision-carry': 'precision-carry-delivery',
    'pallet-pickup': 'pallet-pickup-delivery',
    'rack-storage': 'rack-storage-delivery',
    'rack-storage-top': 'rack-storage-top-delivery',
  }
  for (const id of Object.keys(drivingCourses)) {
    assert.deepEqual(validateCourse(buildDefaultCourse(id).data), [], id)
  }
  for (const [courseId, scenarioId] of Object.entries(completes)) {
    const { view, events } = drive(scenarioId)
    assert.equal(failOf(events), null, courseId)
    const done =
      view.deliveredCount >= 1 ||
      view.parked ||
      (drivingCourses[courseId].checkpoints.length > 0 && view.checkpointIndex === drivingCourses[courseId].checkpoints.length)
    assert.ok(done, `${courseId} completes`)
  }
})
