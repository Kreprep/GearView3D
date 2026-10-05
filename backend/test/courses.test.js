import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultCourseFor, publishedCourse, validateCoursePayload } from '../src/lib/courses.js'

test('publishedCourse never leaks draft, even when the row has one', () => {
  const row = {
    id: 'step-1',
    moduleSlug: 'load-handling',
    sortOrder: 1,
    kind: 'briefing',
    title: 'Read Up',
    objective: null,
    instructions: null,
    hint: null,
    goalType: null,
    content: { body: 'published body' },
    data: null,
    draft: { content: { body: 'SECRET unpublished body' } },
  }

  const result = publishedCourse(row)
  assert.equal('draft' in result, false)
  assert.equal(JSON.stringify(result).includes('SECRET'), false)
  assert.deepEqual(result.content, { body: 'published body' })
})

test('publishedCourse only attaches course geometry for driving steps', () => {
  const drivingRow = { id: 'd1', kind: 'driving', goalType: 'checkpoints', data: { checkpoints: [] } }
  const briefingRow = { id: 'b1', kind: 'briefing', data: { checkpoints: [] } }

  assert.equal(publishedCourse(drivingRow).course.id, 'd1')
  assert.equal(publishedCourse(briefingRow).course, null)
})

test('publishedCourse only attaches walkAround payload for walk-around steps', () => {
  const walkRow = { id: 'w1', kind: 'walk-around', data: { phase: 'engine-off', checks: [] } }
  const drivingRow = { id: 'd1', kind: 'driving', data: {} }

  assert.deepEqual(publishedCourse(walkRow).walkAround, { phase: 'engine-off', checks: [] })
  assert.equal(publishedCourse(drivingRow).walkAround, null)
})

test('validateCoursePayload requires a title for every kind', () => {
  const problems = validateCoursePayload('briefing', { title: '  ' })
  assert.ok(problems.includes('Step needs a title.'))
})

test('validateCoursePayload: walk-around engine-off needs at least one check', () => {
  const problems = validateCoursePayload('walk-around', {
    title: 'Engine Off',
    data: { phase: 'engine-off', checks: [] },
  })
  assert.ok(problems.some((p) => p.includes('inspection check')))
})

test('validateCoursePayload: walk-around engine-on needs a gauge or device', () => {
  const problems = validateCoursePayload('walk-around', {
    title: 'Engine On',
    data: { phase: 'engine-on', gauges: [], devices: [] },
  })
  assert.ok(problems.some((p) => p.includes('gauge or device')))
})

test('validateCoursePayload: engine-on cab fields must name what the cab has', () => {
  const payload = (data) => ({ title: 'Engine On', data: { phase: 'engine-on', ...data } })
  // The stock row, and a row from before the cab fields, are fine.
  assert.deepEqual(validateCoursePayload('walk-around', defaultCourseFor('engine-on-inspection')), [])
  assert.deepEqual(validateCoursePayload('walk-around', payload({ gauges: [{ id: 'hour-meter', answer: 'Normal' }], devices: [{ id: 'horn' }] })), [])

  const problems = validateCoursePayload('walk-around', payload({
    gauges: [
      { id: 'a', label: 'Mystery', instrument: 'gauge.oilTemp' },
      { id: 'b', label: 'Fuel', instrument: 'gauge.fuel', fault: { lamp: 'stays-lit' } },
      { id: 'c', label: 'Charge', instrument: 'lamp.charge', fault: { lamp: 'stays-lit' } },
    ],
    devices: [{ id: 'horn', label: 'Horn', detect: 'honk' }, { id: 'brakes', detect: 'brake-test' }],
  }))
  assert.equal(problems.length, 3)
  assert.ok(problems.some((p) => p.includes('unknown instrument')))
  assert.ok(problems.some((p) => p.startsWith('Gauge "Fuel"')))
  assert.ok(problems.some((p) => p.includes('unknown test "honk"')))
})

test('validateCoursePayload: walk-around defect-test needs a scenario', () => {
  const problems = validateCoursePayload('walk-around', {
    title: 'Defects',
    data: { phase: 'defect-test', scenarios: [] },
  })
  assert.ok(problems.some((p) => p.includes('defect test')))
})

test('validateCoursePayload: walk-around rejects an unknown phase', () => {
  const problems = validateCoursePayload('walk-around', {
    title: 'Bad',
    data: { phase: 'not-a-phase' },
  })
  assert.ok(problems.some((p) => p.includes('Unknown walk-around phase')))
})

test('validateCoursePayload: driving delegates to validateCourse for goal-shape problems', () => {
  const problems = validateCoursePayload('driving', {
    title: 'Checkpoint Run',
    goalType: 'checkpoints',
    data: { start: { position: [0, 0, 0] }, checkpoints: [] },
  })
  assert.ok(problems.some((p) => p.includes('checkpoint')))
})

test('validateCoursePayload: driving rejects an unknown goal type', () => {
  const problems = validateCoursePayload('driving', {
    title: 'Weird',
    goalType: 'not-a-real-goal',
    data: { start: { position: [0, 0, 0] } },
  })
  assert.ok(problems.some((p) => p.includes('Unknown goal type')))
})

test('validateCoursePayload: non-driving, non-walk-around kinds only check the title', () => {
  const problems = validateCoursePayload('summary', { title: 'Done', data: { anything: true } })
  assert.deepEqual(problems, [])
})

test('validateCoursePayload rejects a driving step whose speed limit is not a positive number', () => {
  const data = { start: { position: [0, 0, 0], heading: 0 }, checkpoints: [{ position: [0, 0, 1] }] }
  const payload = { title: 'Drive', goalType: 'checkpoints', data }
  assert.deepEqual(validateCoursePayload('driving', payload), [])
  assert.deepEqual(validateCoursePayload('driving', { ...payload, data: { ...data, speedLimitKmh: 10, alerts: { overspeed: false } } }), [])
  const problems = validateCoursePayload('driving', { ...payload, data: { ...data, speedLimitKmh: -1 } })
  assert.ok(problems.some((p) => p.includes('speed limit')))
})

// A mission course (module improvements Phase 5): the publish check is
// validateCourse's mission rules, run in the backend.
const MISSION_DATA = {
  start: { position: [0, 0, 0], heading: 0 },
  checkpoints: [{ id: 'crossing', type: 'stop', requireHorn: true, position: [0, 0, 4], radius: 0.9 }],
  pallets: [{ id: 'load', position: [0, 0, 10], rotation: 0, weightKg: 400, target: { zone: 'dock' } }],
  dropZones: [{ id: 'dock', position: [0, 0, 16], radius: 0.9 }],
  parkingBay: { position: [0, 0, 7], width: 0.45, depth: 1, heading: 0 },
  tasks: [
    { id: 'start', type: 'start', label: 'Start the truck' },
    { id: 'cross', type: 'checkpoint', ref: 'crossing', label: 'Stop and sound the horn' },
    { id: 'deliver', type: 'deliver', ref: 'load', label: 'Take the pallet to the dock' },
    { id: 'park', type: 'park', label: 'Park and secure' },
  ],
}

test('validateCoursePayload accepts a mission whose tasks all resolve, in an order that can be finished', () => {
  assert.deepEqual(validateCoursePayload('driving', { title: 'Final test', goalType: 'mission', data: MISSION_DATA }), [])
})

test('validateCoursePayload refuses a mission with no tasks, a dangling ref or tasks out of order', () => {
  const check = (data) => validateCoursePayload('driving', { title: 'Final test', goalType: 'mission', data })
  assert.ok(check({ ...MISSION_DATA, tasks: [] }).some((p) => p.includes('at least one task')))
  const [start, cross, deliver, park] = MISSION_DATA.tasks
  assert.ok(check({ ...MISSION_DATA, tasks: [start, { ...cross, ref: 'gone' }] }).some((p) => p.includes('checkpoint that does not exist')))
  assert.ok(check({ ...MISSION_DATA, tasks: [start, { ...deliver, ref: 'gone' }] }).some((p) => p.includes('pallet that does not exist')))
  assert.ok(check({ ...MISSION_DATA, tasks: [park, deliver] }).some((p) => p.includes('only be the last task')))
  assert.ok(check({ ...MISSION_DATA, tasks: [cross, start] }).some((p) => p.includes('only be the first task')))
  const overloaded = { ...MISSION_DATA, capacityKg: 1000, pallets: [{ ...MISSION_DATA.pallets[0], weightKg: 700, loadOffsetM: 0.3 }] }
  assert.ok(check(overloaded).some((p) => p.includes('over the capacity for its load centre')))
})
