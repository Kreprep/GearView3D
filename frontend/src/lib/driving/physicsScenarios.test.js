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
import { featureCourses } from '../../test-helpers/featureCourses.js'

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
  // A left swerve throws the truck onto its right side, where the physics
  // leaves it lying, its load thrown clear.
  assert.equal(raised.view.tipAxis, 'right')
  assert.ok(Math.abs(raised.view.tipAngle - Math.PI / 2) < 0.1, `lying at ${raised.view.tipAngle}`)
  assert.ok(raised.state.tip.pose.position.y > 0.1)
  assert.equal(raised.view.pallets[0].onForks, false)

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
  // The load's weight carries it over: the rear wheels lift and the truck
  // comes to rest on its fork tips, nose down.
  assert.ok(view.tipAngle > 0.05 && view.tipAngle < 0.5, `pitched ${view.tipAngle}`)
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
    'reverse-travel': 'reverse-travel',
    'speed-zones': 'speed-zones',
    'load-centre': 'load-centre-delivery',
    'stability-turns': 'stability-turns',
    'rack-retrieval': 'rack-retrieval',
    'final-test': 'final-test-pass',
  }
  for (const id of Object.keys(drivingCourses)) {
    assert.deepEqual(validateCourse(buildDefaultCourse(id).data), [], id)
  }
  // Every course is driven below but the free-practice pad and Load Limits,
  // whose overload is driven above (load-limits-overload).
  assert.deepEqual(Object.keys(drivingCourses).filter((id) => !completes[id]), ['controls-intro', 'load-limits'])
  for (const [courseId, scenarioId] of Object.entries(completes)) {
    const { view, events } = drive(scenarioId)
    assert.equal(failOf(events), null, courseId)
    const { checkpoints, tasks } = drivingCourses[courseId]
    const done = tasks
      ? view.missionIndex === tasks.length
      : view.deliveredCount >= 1 || view.parked || (checkpoints.length > 0 && view.checkpointIndex === checkpoints.length)
    assert.ok(done, `${courseId} completes`)
  }
})

// --- The module improvements' Phase 5 features ------------------------------
// On the fixture courses in test-helpers/featureCourses.js.

test('a load heavier at the far end is over the plate derated for its load centre; the same weight centred lifts', () => {
  const far = drive('load-centre-overload')
  assert.equal(failOf(far.events), 'overload')
  assert.ok(Math.abs(far.state.load.centre - 0.9) < 0.05, `load centre ${far.state.load.centre} m`)
  assert.ok(far.state.load.deratedKg < 700, `derated to ${far.state.load.deratedKg} kg`)

  const centred = drive('load-centre-lift')
  assert.equal(failOf(centred.events), null)
  assert.equal(centred.view.pallets[1].state, 'carried')
  assert.ok(centred.state.load.centre < 0.61, `load centre ${centred.state.load.centre} m`)
  assert.equal(centred.state.load.overCapacity, false)
})

test('a pallet that starts on the top shelf rests there, is taken off it and delivered to the zone it names', () => {
  const scenario = scenarioById('shelf-retrieval')
  const sim = createHeadlessDrive(scenarioCourse(scenario))
  sim.frame({}, {})
  const [pallet] = sim.core.state.pallets
  // Resting on the decking, at the front of the bay, after the first step.
  assert.ok(Math.abs(pallet.position.y - RACK_LEVEL_HEIGHTS.top) < 0.002, `resting at ${pallet.position.y}`)
  assert.deepEqual([pallet.state, pallet.touch.rackId, pallet.touch.rackLevel], ['ground', 'pick-rack', 'top'])
  sim.dispose()

  const { view, events } = drive('shelf-retrieval')
  assert.equal(failOf(events), null)
  assert.deepEqual(types(events).filter((type) => type.startsWith('pallet-')), ['pallet-lifted', 'pallet-dropped', 'pallet-delivered'])
  // In the dock, not the spare zone beside it.
  assert.ok(Math.hypot(view.pallets[0].position.x, view.pallets[0].position.z - 6) < 0.9)
})

test('a pallet set down in a zone it does not name is not delivered', () => {
  const scenario = scenarioById('shelf-retrieval')
  const course = scenarioCourse(scenario)
  const sim = createHeadlessDrive({ ...course, pallets: [{ ...course.pallets[0], target: { zone: 'spare' } }] })
  runScenario(scenario, { observe: sim.observe, frame: sim.frame })
  assert.equal(sim.view().deliveredCount, 0)
  assert.equal(sim.view().pallets[0].state, 'released')
  sim.dispose()
})

test('a blind crossing clears only once the horn has sounded for it', () => {
  const { events, watched } = drive('horn-crossing', (v) => v.checkpointIndex)
  const cleared = events.find((event) => event.type === 'checkpoint' && event.id === 'crossing')
  // Stopped in the crossing for a second without the horn: still the active
  // checkpoint until H.
  const stoppedFor = watched.filter((index) => index === 0).length
  assert.ok(stoppedFor > 1200, `waited ${stoppedFor} frames`)
  assert.ok(cleared)
  assert.equal(types(events).at(-1), 'course-complete')
})

test('the horn sounded far from the crossing does not count for it', () => {
  const course = scenarioCourse(scenarioById('horn-crossing'))
  const sim = createHeadlessDrive(course)
  const honkAtStart = { name: 'horn at the start', press: ['h'], keys: () => ({}), frames: 1 }
  const [first, second] = scenarioById('horn-crossing').phases
  runScenario({ phases: [first, second, honkAtStart, ...scenarioById('horn-crossing').phases.slice(2, 4)] }, { observe: sim.observe, frame: sim.frame })
  assert.equal(sim.view().checkpointIndex, 0)
  sim.dispose()
})

test('a mission runs its tasks in order and completes only with the last', () => {
  const { view, events } = drive('mission-run')
  assert.equal(failOf(events), null)
  const tasks = events.filter((event) => event.type === 'mission-task')
  assert.deepEqual(tasks.map((event) => event.id), ['start', 'cross', 'deliver', 'park'])
  assert.deepEqual(tasks.map((event) => event.isLast), [false, false, false, true])
  // The pallet's delivery is one task, not the end: the last task is after it.
  const delivered = events.find((event) => event.type === 'pallet-delivered')
  assert.ok(delivered.f < tasks.at(-1).f)
  assert.equal(view.missionIndex, 4)
  assert.equal(view.parked, true)
})

test('the Phase 5 fixture courses validate', () => {
  for (const id of ['load-centre', 'shelf-retrieval', 'horn-crossing', 'mission']) {
    assert.deepEqual(validateCourse(featureCourses[id]), [], id)
  }
})

// --- The module improvements' Phase 6 courses ---------------------------------

test('Reversing and Looking Behind is driven out in reverse the whole way', () => {
  const { events, watched } = drive('reverse-travel', (v) => v.speed)
  assert.equal(types(events).at(-1), 'course-complete')
  // Never forward faster than a creep: the lane is too narrow to turn round.
  assert.ok(Math.max(...watched) < 0.01, `forward at ${Math.max(...watched)}`)
})

test('Speed Zones: the blind crossing clears only after the horn, under the limit', () => {
  const { events, watched } = drive('speed-zones', (v) => v.speed)
  const ids = events.filter((event) => event.type === 'checkpoint' || event.type === 'course-complete').map((event) => event.id)
  assert.deepEqual(ids, ['stop-line', 'blind-crossing', 'zone-exit'])
  const crossing = events.find((event) => event.id === 'blind-crossing')
  assert.ok(crossing.f > events.find((event) => event.id === 'stop-line').f)
  // 5 km/h is 0.347 units a second.
  assert.ok(Math.max(...watched) < 0.347, `top speed ${Math.max(...watched)}`)

  const course = drivingCourses['speed-zones']
  const sim = createHeadlessDrive(course)
  const scenario = scenarioById('speed-zones')
  runScenario({ phases: scenario.phases.filter((phase) => phase.name !== 'sound the horn') }, { observe: sim.observe, frame: sim.frame })
  assert.equal(sim.view().checkpointIndex, 1, 'no horn, no crossing')
  sim.dispose()
})

test('Reading the Load Chart: the far load overloads the derated plate, the centred one is delivered', () => {
  const far = drive('load-centre-far')
  assert.equal(failOf(far.events), 'overload')
  assert.ok(Math.abs(far.state.load.centre - 0.9) < 0.05, `load centre ${far.state.load.centre} m`)

  const { view, events, state } = drive('load-centre-delivery')
  assert.equal(failOf(events), null)
  assert.equal(view.deliveredCount, 1)
  assert.equal(state.pallets[1].state, 'delivered')
  assert.equal(state.pallets[0].state, 'ground')
})

test('Turning with a Load: the near-rated load goes round the bends without tipping or sliding', () => {
  const { events, watched } = drive('stability-turns', (v) => v.lateralMargin)
  assert.equal(failOf(events), null)
  assert.deepEqual(types(events).filter((type) => type.startsWith('pallet-')), ['pallet-lifted', 'pallet-dropped', 'pallet-delivered'])
  assert.ok(Math.min(...watched) > 0, `lateral margin ${Math.min(...watched)}`)
})

test('Retrieving from the Top Shelf: off the shelf and into the dock', () => {
  const { view, events } = drive('rack-retrieval')
  assert.equal(failOf(events), null)
  assert.deepEqual(types(events).filter((type) => type.startsWith('pallet-')), ['pallet-lifted', 'pallet-dropped', 'pallet-delivered'])
  assert.ok(Math.hypot(view.pallets[0].position.x, view.pallets[0].position.z - 3) < 0.9)
})

test('the driving course ends by reversing out of the dead end', () => {
  const { events } = drive('driving-course', (v) => v.speed)
  const last = events.filter((event) => event.type === 'checkpoint' || event.type === 'course-complete').slice(-2)
  assert.deepEqual(last.map((event) => event.id), ['course-park', 'course-reverse'])
})
