import '../../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drivingCourses } from '../../data/drivingCourse.js'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import { drivingScenarios, runScenario, SCENARIO_DT, scenarioCourse } from '../../test-helpers/drivingScenarios.js'
import { createHeadlessDrive } from '../../test-helpers/headlessDrive.js'
import { neutralControls } from './controls.js'
import { createSafetyMonitor } from './safetyMonitor.js'
import { createSimCore } from './simCore.js'

// Every rule raised by a scripted drive (docs/revisions/post-defense-plan.md,
// Phase 6: "each rule fires in a scripted scenario"), on the same headless
// core and the same scripts the characterization test replays. The monitor
// watches each step, as the viewer's does each frame.

const SEATED = { firstPerson: true, lookYaw: 0 }
const CHASE = { firstPerson: false, lookYaw: 0 }

const scenarioById = (id) => drivingScenarios.find((scenario) => scenario.id === id)

// Drive a scenario with a monitor watching. Returns its tally, the edges in
// order and the most signs shown at once.
function watch(scenario, { view = SEATED, course = scenarioCourse(scenario) } = {}) {
  const monitor = createSafetyMonitor(course)
  const edges = []
  let mostShown = 0
  const sim = createHeadlessDrive(course, {
    afterStep(core) {
      const result = monitor.update(core.state, core.world, typeof view === 'function' ? view(core.state) : view)
      edges.push(...result.edges)
      mostShown = Math.max(mostShown, result.shown.length)
    },
  })
  if (scenario.setup) sim.core.debugSet(scenario.setup)
  runScenario(scenario, { observe: sim.observe, frame: sim.frame })
  return { ...monitor.tally(), edges, mostShown, state: sim.core.state }
}

const NO_KEYS = {}
const hold = (keys) => () => keys
const startEngine = [
  { name: 'start sequence', cab: { seatbelt: true, parkingBrake: true }, engineToggle: true, keys: hold(NO_KEYS), frames: 1 },
  { name: 'release parking brake', cab: { parkingBrake: false }, keys: hold(NO_KEYS), frames: 1 },
]
const openCourse = (extra = {}) => ({ id: 'open', start: { position: [0, 0, 0], heading: 0 }, checkpoints: [], ...extra })
const cone = (x, z) => ({ type: 'cone', position: [x, 0, z] })

// --- The scripted drives the characterization test already runs --------------

test('start-interlock and parking-brake-on: a refused start, then throttle against the brake', () => {
  const { violations, dangers, edges } = watch(scenarioById('start-interlock'))
  assert.equal(violations['start-interlock'], 1)
  assert.equal(violations['parking-brake-on'], 1)
  assert.deepEqual(dangers, {})
  // Neither is a fault: they are information, with no chime.
  assert.ok(edges.every((edge) => edge.sound === null))
})

test('obstacle-ahead: driving at a cone, a wall, a parked vehicle or a rack escalates to danger before the strike', () => {
  for (const id of ['cone-hit', 'wall-hit', 'vehicle-hit', 'rack-strike']) {
    const { violations, dangers, state } = watch(scenarioById(id))
    assert.ok(state.failed, `${id} still fails`)
    assert.equal(violations['obstacle-ahead'], 1, id)
    assert.equal(dangers['obstacle-ahead'], 1, id)
  }
})

test('overload: forks into a pallet over the rated capacity', () => {
  const { violations, dangers } = watch(scenarioById('load-limits-overload'))
  assert.equal(violations.overload, 1)
  assert.equal(dangers.overload, 1)
})

test('tilt-forward-elevated: a raised load tilted forward away from the rack', () => {
  const { dangers } = watch(scenarioById('load-tipping'))
  assert.equal(dangers['tilt-forward-elevated'], 1)
})

test('forks-high-travel: carrying with the forks well above travel height', () => {
  assert.equal(watch(scenarioById('high-travel')).violations['forks-high-travel'], 1)
})

test('forks-not-inserted and mast-not-back: a half-inserted load lifted and driven mast-upright', () => {
  const { violations } = watch(scenarioById('sudden-stop-slip'))
  assert.equal(violations['forks-not-inserted'], 1)
  assert.equal(violations['mast-not-back'], 1)
})

test('direction-change-moving: shuttling the dashboard lever F to R on the move', () => {
  assert.equal(watch(scenarioById('direction-lever')).violations['direction-change-moving'], 1)
})

test('overspeed: full throttle on a course with the default 8 km/h limit', () => {
  const scenario = scenarioById('accelerate-course')
  const limited = { ...scenario.course, speedLimitKmh: undefined }
  assert.equal(watch(scenario, { course: limited }).violations.overspeed, 1)
  // The course's own limit, and its own switch.
  assert.equal(watch(scenario, { course: { ...limited, speedLimitKmh: 18 } }).violations.overspeed, undefined)
  assert.equal(watch(scenario, { course: { ...limited, alerts: { overspeed: false } } }).violations.overspeed, undefined)
})

test('look-direction: reversing in first-person while looking ahead, not in chase or looking behind', () => {
  const scenario = scenarioById('engine-off-coast')
  assert.equal(watch(scenario, { view: SEATED }).violations['look-direction'], 1)
  assert.equal(watch(scenario, { view: CHASE }).violations['look-direction'], undefined)
  assert.equal(watch(scenario, { view: { firstPerson: true, lookYaw: Math.PI } }).violations['look-direction'], undefined)
})

// --- Drives scripted for the rules those do not reach -------------------------

test('seatbelt-off: unbuckling with the engine running', () => {
  const scenario = {
    course: openCourse(),
    phases: [...startEngine, { name: 'unbuckle', cab: { seatbelt: false }, keys: hold(NO_KEYS), frames: 30 }],
  }
  assert.deepEqual(watch(scenario).violations, { 'seatbelt-off': 1 })
})

test('forks-raised-parked: the parking brake set, then the engine off, with the forks left up', () => {
  const scenario = {
    course: openCourse(),
    phases: [
      ...startEngine,
      { name: 'raise', keys: hold({ raise: true }), until: (obs) => obs.forkHeight >= 0.2, frames: 300 },
      { name: 'parking brake', cab: { parkingBrake: true }, keys: hold(NO_KEYS), frames: 30 },
      { name: 'engine off', engineToggle: true, keys: hold(NO_KEYS), frames: 60 },
    ],
  }
  // One violation: the sign stays up from the brake through the engine off.
  assert.deepEqual(watch(scenario).violations, { 'forks-raised-parked': 1 })
})

test('lifting-while-moving: raising the forks on the move', () => {
  const scenario = {
    course: openCourse({ speedLimitKmh: 18 }),
    phases: [
      ...startEngine,
      { name: 'drive', keys: hold({ forward: true }), frames: 40 },
      { name: 'raise while driving', keys: hold({ forward: true, raise: true }), frames: 12 },
      { name: 'drive on', keys: hold({ forward: true }), frames: 20 },
    ],
  }
  const { violations } = watch(scenario)
  assert.equal(violations['lifting-while-moving'], 1)
})

test('obstacle-behind: reversing at a wall', () => {
  const scenario = {
    course: openCourse({ decorations: [{ type: 'wall', position: [0, 0, -2.5], rotation: Math.PI / 2, length: 3 }] }),
    phases: [...startEngine, { name: 'reverse', keys: hold({ back: true }), until: (obs) => obs.failed, frames: 900 }],
  }
  const { violations, dangers, state } = watch(scenario, { view: CHASE })
  assert.ok(state.failed)
  assert.equal(violations['obstacle-behind'], 1)
  assert.equal(dangers['obstacle-behind'], 1)
  assert.equal(violations['obstacle-ahead'], undefined)
})

test('tail-swing: turning left with a cone off the right rear corner', () => {
  const { halfWidth, halfLength } = defaultVehicleProfile('en').footprint
  // Right is -X at heading 0. The cone is 40 cm off the rear corner.
  const course = openCourse({ decorations: [cone(-(halfWidth + 0.1), -halfLength + 0.03)] })
  const turn = (keys) => ({
    course,
    phases: [...startEngine, { name: 'turn', keys: (obs) => ({ ...keys, forward: obs.speed < 0.12 }), until: (obs) => obs.failed, frames: 90 }],
  })
  assert.equal(watch(turn({ left: true })).violations['tail-swing'], 1)
  // Turning right swings the tail away from it.
  assert.equal(watch(turn({ right: true })).violations['tail-swing'], undefined)
})

test('turn-speed: a steering wheel held past half lock above 5 km/h', () => {
  // The keyboard's virtual wheel cannot do this (its lock shrinks with
  // speed), so this drives the core with a wheel's analog controls.
  const course = openCourse({ speedLimitKmh: 18 })
  const core = createSimCore(course, defaultVehicleProfile('en'))
  const monitor = createSafetyMonitor(course)
  const drive = (controls, steps) => {
    for (let i = 0; i < steps; i += 1) {
      core.step(SCENARIO_DT, { ...neutralControls(), seatbelt: true, ...controls })
      monitor.update(core.state, core.world, CHASE)
    }
  }
  core.command('engineStart')
  drive({ parkingBrake: true }, 1)
  drive({ throttle: 1, direction: 'F', explicitDirection: true }, 90)
  assert.deepEqual(monitor.tally().violations, {})
  drive({ throttle: 1, direction: 'F', explicitDirection: true, steer: 0.9 }, 45)
  assert.equal(monitor.tally().violations['turn-speed'], 1)
})

// --- Clean drives stay clean ---------------------------------------------------

test('a careful drive raises no sign: both parking courses and the slalom', () => {
  for (const id of ['forklift-gap-parking', 'parallel-parking', 'turning-practice']) {
    const { violations, state } = watch(scenarioById(id), { view: CHASE })
    assert.ok(!state.failed, id)
    assert.deepEqual(violations, {}, id)
  }
})

test('the built-in acceleration courses allow full throttle', () => {
  for (const id of ['accelerate-course', 'accelerate-brake']) {
    assert.deepEqual(watch(scenarioById(id), { course: drivingCourses[id] }).violations, {}, id)
  }
})

// --- The monitor itself ---------------------------------------------------------

test('signs never stack more than two deep over any scripted drive', () => {
  for (const scenario of drivingScenarios) assert.ok(watch(scenario).mostShown <= 2, scenario.id)
})

test('a frame in which the simulation did not step judges nothing new', () => {
  const course = openCourse()
  const core = createSimCore(course, defaultVehicleProfile('en'))
  const monitor = createSafetyMonitor(course)
  const controls = { ...neutralControls(), seatbelt: true, parkingBrake: true }
  core.command('engineStart')
  core.step(SCENARIO_DT, controls)
  // Unbuckled, then 30 steps: the sign is up.
  for (let i = 0; i < 30; i += 1) {
    core.step(SCENARIO_DT, { ...controls, seatbelt: false })
    monitor.update(core.state, core.world, CHASE)
  }
  const shown = monitor.update(core.state, core.world, CHASE).shown
  assert.deepEqual(shown.map((alert) => alert.id), ['seatbelt-off'])
  // A 144 Hz screen renders frames between steps.
  const again = monitor.update(core.state, core.world, CHASE)
  assert.equal(again.shown, shown)
  assert.deepEqual(again.edges, [])
  assert.deepEqual(monitor.tally().violations, { 'seatbelt-off': 1 })
})

test('debugSnapshot reports the signs shown and the tally', () => {
  const course = openCourse()
  const core = createSimCore(course, defaultVehicleProfile('en'))
  const monitor = createSafetyMonitor(course)
  core.command('engineStart')
  for (let i = 0; i < 30; i += 1) {
    core.step(SCENARIO_DT, neutralControls())
    monitor.update(core.state, core.world, CHASE)
  }
  assert.deepEqual(monitor.debugSnapshot(), {
    signs: [{ id: 'start-interlock', severity: 'info', kind: 'mandatory' }],
    violations: { 'start-interlock': 1 },
    dangers: {},
  })
})

test('watching a drive does not change it', () => {
  const scenario = scenarioById('precision-carry-delivery')
  const watched = watch(scenario).state
  const unwatched = createHeadlessDrive(scenarioCourse(scenario))
  runScenario(scenario, { observe: unwatched.observe, frame: unwatched.frame })
  const strip = (state) => JSON.stringify({ ...state, frame: undefined })
  assert.equal(strip(watched), strip(unwatched.core.state))
})
