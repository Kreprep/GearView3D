import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drivingCourses } from '../data/drivingCourse.js'
import { courseGoalType, courseTaskKey, resolveCapacityKg, resolveFailConditions, validateCourse } from './courseGoals.js'
import { featureCourses } from '../test-helpers/featureCourses.js'

const START = { position: [0, 0, 0], heading: 0 }

test('validateCourse requires a start position', () => {
  const problems = validateCourse({ goalType: 'checkpoints', checkpoints: [{ position: [0, 0, 1] }] })
  assert.ok(problems.some((p) => p.includes('start position')))
})

test('validateCourse: checkpoints goal needs at least one checkpoint', () => {
  const problems = validateCourse({ start: START, goalType: 'checkpoints', checkpoints: [] })
  assert.ok(problems.some((p) => p.includes('checkpoint run needs')))
})

test('validateCourse: parking goal needs a parking bay', () => {
  const problems = validateCourse({ start: START, goalType: 'parking' })
  assert.ok(problems.some((p) => p.includes('parking bay')))
})

test('validateCourse: pallet goal needs a pallet and a drop zone', () => {
  const problems = validateCourse({ start: START, goalType: 'pallet' })
  assert.ok(problems.some((p) => p.includes('pallet course needs at least one pallet')))
  assert.ok(problems.some((p) => p.includes('drop zone')))
})

test('validateCourse: racking goal needs racks, pallets, and a valid target on each pallet', () => {
  const problems = validateCourse({ start: START, goalType: 'racking', racks: [], pallets: [] })
  assert.ok(problems.some((p) => p.includes('racking course needs at least one rack')))
  assert.ok(problems.some((p) => p.includes('racking course needs at least one pallet')))
})

test('validateCourse: racking pallet targeting a rack that does not exist is rejected', () => {
  const problems = validateCourse({
    start: START,
    goalType: 'racking',
    racks: [{ id: 'rack-1', position: [10, 0, 10] }],
    pallets: [{ position: [0, 0, 5], targetRack: 'rack-missing', targetLevel: 'bottom' }],
  })
  assert.ok(problems.some((p) => p.includes('no longer exists')))
})

test('validateCourse: free goal fails without completionCode', () => {
  const problems = validateCourse({ start: START, goalType: 'free' })
  assert.ok(problems.some((p) => p.includes('custom completion code')))
})

test('validateCourse: free goal with a syntax error in completionCode is rejected', () => {
  const problems = validateCourse({ start: START, goalType: 'free', completionCode: 'this is not valid js (((' })
  assert.ok(problems.some((p) => p.includes('syntax error')))
})

test('validateCourse: free goal with valid completionCode passes', () => {
  const problems = validateCourse({ start: START, goalType: 'free', completionCode: 'return context.engineStarted' })
  assert.deepEqual(problems, [])
})

test('validateCourse: a well-formed checkpoints course has no problems', () => {
  const problems = validateCourse({
    start: START,
    goalType: 'checkpoints',
    checkpoints: [{ position: [0, 0, 5] }, { position: [0, 0, 10] }],
  })
  assert.deepEqual(problems, [])
})

test('validateCourse: overlapping solids (two racks on the same spot) are rejected', () => {
  const problems = validateCourse({
    start: START,
    goalType: 'racking',
    racks: [
      { id: 'r1', position: [0, 0, 5] },
      { id: 'r2', position: [0.1, 0, 5.1] },
    ],
    pallets: [{ position: [0, 0, 2], targetRack: 'r1', targetLevel: 'bottom' }],
  })
  assert.ok(problems.some((p) => p.includes('overlap')))
})

test('validateCourse: an object placed outside declared bounds is rejected', () => {
  const problems = validateCourse({
    start: START,
    bounds: { halfWidth: 5, minZ: -3, maxZ: 20 },
    goalType: 'checkpoints',
    checkpoints: [{ position: [100, 0, 5] }],
  })
  assert.ok(problems.some((p) => p.includes('outside the course boundary')))
})

test('courseGoalType falls back to free with no course', () => {
  assert.equal(courseGoalType(null), 'free')
  assert.equal(courseGoalType(undefined), 'free')
})

test('courseGoalType prefers an explicit stored goalType over inferring from markers', () => {
  assert.equal(courseGoalType({ goalType: 'free', checkpoints: [{ position: [0, 0, 1] }] }), 'free')
})

test('courseGoalType infers checkpoints from markers when goalType is missing', () => {
  assert.equal(courseGoalType({ checkpoints: [{ position: [0, 0, 1] }] }), 'checkpoints')
})

test('validateCourse: a speed limit has to be a positive number, or left out for the default', () => {
  const course = { start: START, goalType: 'checkpoints', checkpoints: [{ position: [0, 0, 1] }] }
  assert.deepEqual(validateCourse(course), [])
  assert.deepEqual(validateCourse({ ...course, speedLimitKmh: 12, alerts: { overspeed: false } }), [])
  assert.ok(validateCourse({ ...course, speedLimitKmh: 0 }).some((p) => p.includes('speed limit')))
})

// --- The load-handling fails and the capacity plate ---------------------------

test('a course with no fail conditions has none on', () => {
  for (const course of [undefined, null, {}, { failConditions: null }, { failConditions: {} }]) {
    assert.deepEqual(resolveFailConditions(course), { overload: false, highTravel: false, loadDrop: false })
  }
})

test('the fails a course stores are read as they are', () => {
  const failConditions = { overload: true, highTravel: false, loadDrop: true }
  assert.deepEqual(resolveFailConditions({ failConditions }), failConditions)
})

test('a course saved before the physics: any of the three slip rules is a lost load', () => {
  for (const key of ['suddenStop', 'sharpTurn', 'unsecuredTravel']) {
    assert.deepEqual(resolveFailConditions({ failConditions: { [key]: true } }), { overload: false, highTravel: false, loadDrop: true }, key)
  }
  assert.equal(resolveFailConditions({ failConditions: { suddenStop: false, sharpTurn: false } }).loadDrop, false)
  // loadTipping is gone: a tip-over is physics and always fails.
  assert.deepEqual(resolveFailConditions({ failConditions: { loadTipping: true, overload: true } }), { overload: true, highTravel: false, loadDrop: false })
})

test('the new key wins over the old ones once a course has been saved again', () => {
  assert.equal(resolveFailConditions({ failConditions: { loadDrop: false, suddenStop: true } }).loadDrop, false)
})

test('the stock pallet courses fail a lost load, an overload and travelling high', () => {
  for (const id of ['precision-carry', 'load-limits']) {
    assert.deepEqual(resolveFailConditions(drivingCourses[id]), { overload: true, highTravel: true, loadDrop: true }, id)
  }
})

test('the rated capacity is the course\'s own plate, or the reference truck\'s', () => {
  assert.equal(resolveCapacityKg({ capacityKg: 1000 }), 1000)
  for (const course of [undefined, {}, { capacityKg: null }, { capacityKg: 0 }, { capacityKg: '900' }]) {
    assert.equal(resolveCapacityKg(course), 2270)
  }
})

test('a built-in free course seeded before completion code gets the stock code, and nothing else does', async () => {
  const { withMissingCompletionCode } = await import('./courseGoals.js')
  const stock = drivingCourses['controls-intro']
  const stored = { start: { position: [0, 0, 0], heading: 0 }, checkpoints: [] }

  const filled = withMissingCompletionCode(stored, stock)
  assert.equal(filled.completionCode, stock.completionCode)
  assert.deepEqual(validateCourse(filled), [])

  // The row's own value wins, a blanked one included; a stock course with no
  // code adds nothing.
  for (const own of [{ ...stored, completionCode: 'return true' }, { ...stored, completionCode: '' }, { ...stored, completionCode: null }]) {
    assert.equal(withMissingCompletionCode(own, stock), own)
  }
  assert.equal(withMissingCompletionCode(stored, { completionCode: null }), stored)
  assert.equal(withMissingCompletionCode(null, stock), null)
})

// --- Missions, targets, shelves and zones (module improvements Phase 5) -----

const MISSION = featureCourses.mission
const withTasks = (tasks) => ({ ...MISSION, tasks })
const has = (problems, text) => problems.some((problem) => problem.includes(text))

test('a mission is recognised by its tasks, before its bay or pallets', () => {
  const unstored = { ...MISSION, goalType: undefined }
  assert.equal(courseGoalType(unstored), 'mission')
  assert.deepEqual(courseTaskKey(MISSION), { key: 'driving.task.mission', values: { count: 4 } })
  assert.deepEqual(validateCourse(MISSION), [])
})

test('a mission needs tasks, each with an id, a label and a known type', () => {
  assert.ok(has(validateCourse(withTasks([])), 'at least one task'))
  assert.ok(has(validateCourse({ ...MISSION, tasks: undefined, goalType: 'mission' }), 'at least one task'))
  assert.ok(has(validateCourse(withTasks([{ id: 'a', type: 'fly', label: 'Fly' }])), 'unknown type'))
  assert.ok(has(validateCourse(withTasks([{ type: 'start', label: 'Go' }])), 'needs an id'))
  assert.ok(has(validateCourse(withTasks([{ id: 'a', type: 'start', label: ' ' }])), 'needs a label'))
  const twice = [{ id: 'a', type: 'start', label: 'Go' }, { id: 'a', type: 'checkpoint', ref: 'crossing', label: 'Cross' }]
  assert.ok(has(validateCourse(withTasks(twice)), 'share the id'))
})

test("every mission task's ref has to resolve", () => {
  const problems = validateCourse(withTasks([
    { id: 'c', type: 'checkpoint', ref: 'nowhere', label: 'Cross' },
    { id: 'd', type: 'deliver', ref: 'no-pallet', label: 'Deliver' },
  ]))
  assert.ok(has(problems, 'checkpoint that does not exist'))
  assert.ok(has(problems, 'pallet that does not exist'))
  const noBay = { ...withTasks([{ id: 'p', type: 'park', label: 'Park' }]), parkingBay: null }
  assert.ok(has(validateCourse(noBay), 'needs a parking bay'))
})

test('a mission starts first and parks last, and delivers each pallet once', () => {
  const [start, cross, deliver, park] = MISSION.tasks
  assert.ok(has(validateCourse(withTasks([cross, start])), 'only be the first task'))
  assert.ok(has(validateCourse(withTasks([park, deliver])), 'only be the last task'))
  assert.ok(has(validateCourse(withTasks([deliver, { ...deliver, id: 'again' }])), 'delivered by two tasks'))
})

test('a mission cannot ask for a pallet over the capacity for its load centre, or with nowhere to go', () => {
  const heavy = { ...MISSION, capacityKg: 1000, pallets: [{ ...MISSION.pallets[0], weightKg: 700, loadOffsetM: 0.3 }] }
  assert.ok(has(validateCourse(heavy), 'over the capacity for its load centre'))
  const centred = { ...heavy, pallets: [{ ...heavy.pallets[0], loadOffsetM: undefined }] }
  assert.ok(!has(validateCourse(centred), 'over the capacity'))
  const nowhere = { ...MISSION, dropZones: [], pallets: [{ ...MISSION.pallets[0], target: undefined }] }
  assert.ok(has(validateCourse(nowhere), 'nowhere to be delivered'))
})

test('what pallets point at has to exist: zones, racks and shelves', () => {
  const base = { start: START, goalType: 'pallet', dropZones: [{ id: 'dock', position: [0, 0, 8], radius: 0.9 }] }
  const pallet = { id: 'p', position: [0, 0, 4], weightKg: 400 }
  assert.deepEqual(validateCourse({ ...base, pallets: [{ ...pallet, target: { zone: 'dock' } }] }), [])
  assert.ok(has(validateCourse({ ...base, pallets: [{ ...pallet, target: { zone: 'gone' } }] }), 'drop zone that no longer exists'))
  assert.ok(has(validateCourse({ ...base, pallets: [{ ...pallet, startShelf: { rack: 'gone', level: 'top' } }] }), 'starts on a rack that no longer exists'))
  assert.ok(has(validateCourse({ ...base, pallets: [{ ...pallet, loadOffsetM: Number.NaN }] }), 'load offset'))

  const rack = { id: 'r1', position: [0, 0, 12], rotation: 0 }
  const onShelf = (id, level) => ({ ...pallet, id, startShelf: { rack: 'r1', level } })
  const shelved = { ...base, racks: [rack], pallets: [onShelf('a', 'top'), onShelf('b', 'bottom')] }
  // Inside the rack, where a shelf pallet belongs: not a solid overlap.
  assert.deepEqual(validateCourse(shelved), [])
  assert.ok(has(validateCourse({ ...shelved, pallets: [onShelf('a', 'top'), onShelf('b', 'top')] }), 'same shelf'))
  const goingHome = { ...onShelf('a', 'top'), target: { rack: 'r1', level: 'top' } }
  assert.ok(has(validateCourse({ ...shelved, pallets: [goingHome] }), 'shelf it is meant to be delivered to'))
})

test('drop zones need their own ids and a radius', () => {
  const zone = { id: 'dock', position: [0, 0, 8], radius: 0.9 }
  const course = { start: START, goalType: 'pallet', pallets: [{ id: 'p', position: [0, 0, 4] }] }
  assert.ok(has(validateCourse({ ...course, dropZones: [zone, zone] }), 'its own id'))
  assert.ok(has(validateCourse({ ...course, dropZones: [{ ...zone, radius: 0 }] }), 'radius above zero'))
  // A pallet course is satisfied by a listed zone as well as the older one.
  assert.equal(courseGoalType({ pallets: course.pallets, dropZones: [zone] }), 'pallet')
})
