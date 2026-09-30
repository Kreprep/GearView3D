import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOUND_BANK } from '../../data/soundBank.js'
import {
  CREEP_SPEED,
  FORKS_TRAVEL_HEIGHT,
  OBSTACLE_MIN_SPEED,
  PARKED_FORKS_MAX,
  TAIL_SWING_REACH,
  TILT_FORWARD_ANGLE,
} from '../../data/safetyThresholds.js'
import { ALERT_RULES, resolveAlerts } from '../courseAlerts.js'
import { TILT_SECURE_ANGLE } from './constants.js'
import {
  activeAlerts,
  ALERT_CLEAR_AFTER,
  ALERT_MAX_SHOWN,
  ALERT_SHOW_AFTER,
  createAlertQueue,
  SAFETY_RULES,
  stepAlertQueue,
} from './safetyRules.js'
import { kmh, m } from './units.js'

// A snapshot in which nothing is wrong: engine running, belted, stopped,
// forks down, nothing near (safetySnapshot.js builds the real ones).
const snapshot = (overrides = {}) => ({
  time: 0,
  live: true,
  engineOn: true,
  speed: 0,
  lever: null,
  throttle: 0,
  lift: 0,
  steer: 0,
  steerRate: 0,
  yaw: 0,
  seatbelt: true,
  parkingBrake: false,
  forkHeight: 0,
  mastTilt: 0,
  grip: 'none',
  carrying: false,
  loadLanded: false,
  atStack: false,
  overCapacity: false,
  interlockMissing: [],
  ahead: null,
  behind: null,
  rearLeft: null,
  rearRight: null,
  lookingAhead: null,
  speedLimit: kmh(8),
  speedLimitKmh: 8,
  ...overrides,
})

const ALL_ON = resolveAlerts({})
const alertsFor = (overrides, enabled = ALL_ON) => activeAlerts(snapshot(overrides), enabled)
const ids = (overrides, enabled) => alertsFor(overrides, enabled).map((alert) => alert.id)
const alertFor = (id, overrides) => alertsFor(overrides).find((alert) => alert.id === id)
const fires = (id, overrides) => assert.ok(ids(overrides).includes(id), `${id} should fire`)
const quiet = (id, overrides) => assert.ok(!ids(overrides).includes(id), `${id} should not fire`)

// A secured load being carried: off the ground, mast back, forks at travel
// height.
const CARRYING = { carrying: true, mastTilt: TILT_SECURE_ANGLE - 0.05, forkHeight: m(0.12), grip: 'secure' }

// --- The rule table ----------------------------------------------------------

test('the rule table and the course switches list the same rules, in the same order', () => {
  assert.deepEqual(SAFETY_RULES.map((rule) => rule.id), ALERT_RULES.map((rule) => rule.id))
})

test('every rule is well formed and names a sound the bank has', () => {
  for (const rule of SAFETY_RULES) {
    assert.ok(['info', 'caution', 'danger'].includes(rule.severity), `${rule.id} severity`)
    assert.ok(['warning', 'mandatory', 'prohibition'].includes(rule.kind), `${rule.id} kind`)
    assert.ok(rule.pictogram && rule.messageKey.startsWith('safety.sign.') && rule.osha, `${rule.id} fields`)
    assert.equal(typeof rule.when, 'function')
    if (rule.sound !== null) assert.ok(SOUND_BANK[rule.sound], `${rule.id} sound`)
  }
})

test('caution plays the chime, danger the alarm, info nothing', () => {
  for (const rule of SAFETY_RULES) {
    assert.equal(rule.sound, { info: null, caution: 'cautionChime', danger: 'dangerAlarm' }[rule.severity], rule.id)
  }
})

test('nothing fires on a quiet snapshot, or while carrying a secured load at travel height', () => {
  assert.deepEqual(ids(), [])
  assert.deepEqual(ids({ ...CARRYING, speed: kmh(5) }), [])
})

test('nothing fires once the attempt has failed', () => {
  assert.deepEqual(ids({ live: false, overCapacity: true, seatbelt: false, speed: kmh(15), ahead: 0.01 }), [])
})

test('a rule the course switched off does not fire', () => {
  const enabled = resolveAlerts({ alerts: { overspeed: false } })
  assert.deepEqual(ids({ speed: kmh(12) }, enabled), [])
  assert.deepEqual(ids({ speed: kmh(12) }), ['overspeed'])
})

// --- One test per rule -------------------------------------------------------

test('obstacle-ahead: a caution under 2 s to contact, a stop sign under 1 s', () => {
  const speed = kmh(7.2) // 2 m/s
  quiet('obstacle-ahead', { speed, ahead: m(4.5) })
  const caution = alertFor('obstacle-ahead', { speed, ahead: m(3) })
  assert.equal(caution.severity, 'caution')
  assert.equal(caution.kind, 'warning')
  const stop = alertFor('obstacle-ahead', { speed, ahead: m(1.5) })
  assert.deepEqual(
    [stop.severity, stop.kind, stop.pictogram, stop.messageKey, stop.sound],
    ['danger', 'prohibition', 'stop', 'safety.sign.obstacle-ahead.stop', 'dangerAlarm'],
  )
})

test('obstacle-ahead: not while positioning slowly, not in reverse, not with a clear path', () => {
  quiet('obstacle-ahead', { speed: OBSTACLE_MIN_SPEED, ahead: 0.01 })
  quiet('obstacle-ahead', { speed: -kmh(7.2), ahead: 0.01 })
  quiet('obstacle-ahead', { speed: kmh(7.2), ahead: null })
})

test('obstacle-behind: the same, reversing', () => {
  const speed = -kmh(3.6) // 1 m/s backwards
  quiet('obstacle-behind', { speed, behind: m(2.5) })
  assert.equal(alertFor('obstacle-behind', { speed, behind: m(1.5) }).severity, 'caution')
  assert.equal(alertFor('obstacle-behind', { speed, behind: m(0.5) }).messageKey, 'safety.sign.obstacle-behind.stop')
  quiet('obstacle-behind', { speed: kmh(3.6), behind: m(0.5) })
  quiet('obstacle-ahead', { speed, behind: m(0.5) })
})

test('tail-swing: turning with something at the rear corner on the outside of the turn', () => {
  const turning = { speed: kmh(3), steer: 0.6 }
  // Turning left swings the tail right.
  fires('tail-swing', { ...turning, yaw: 1, rearRight: TAIL_SWING_REACH / 2 })
  quiet('tail-swing', { ...turning, yaw: 1, rearLeft: TAIL_SWING_REACH / 2 })
  fires('tail-swing', { ...turning, yaw: -1, rearLeft: TAIL_SWING_REACH / 2 })
  // Out of reach, steering straight, or stopped.
  quiet('tail-swing', { ...turning, yaw: 1, rearRight: TAIL_SWING_REACH * 2 })
  quiet('tail-swing', { speed: kmh(3), steer: 0.05, yaw: 1, rearRight: TAIL_SWING_REACH / 2 })
  quiet('tail-swing', { speed: 0, steer: 0.6, yaw: 0, rearRight: TAIL_SWING_REACH / 2 })
})

test('overload: a load over the rated capacity on the forks is a danger', () => {
  const alert = alertFor('overload', { overCapacity: true })
  assert.deepEqual([alert.severity, alert.kind], ['danger', 'prohibition'])
  quiet('overload', { overCapacity: false })
})

test('start-interlock: one mandatory sign for the first thing a refused start still wants', () => {
  const engineOff = { engineOn: false }
  quiet('start-interlock', engineOff)
  const all = alertFor('start-interlock', { ...engineOff, interlockMissing: ['seatbelt', 'parkingBrake', 'neutral'] })
  assert.deepEqual([all.kind, all.severity, all.sound], ['mandatory', 'info', null])
  assert.equal(all.messageKey, 'safety.sign.start-interlock.seatbelt')
  const brake = alertFor('start-interlock', { ...engineOff, interlockMissing: ['parkingBrake', 'neutral'] })
  assert.deepEqual([brake.messageKey, brake.pictogram], ['safety.sign.start-interlock.parkingBrake', 'parking-brake'])
  const neutral = alertFor('start-interlock', { ...engineOff, interlockMissing: ['neutral'] })
  assert.deepEqual([neutral.messageKey, neutral.pictogram], ['safety.sign.start-interlock.neutral', 'neutral'])
})

test('look-direction: reversing in first-person while looking ahead', () => {
  fires('look-direction', { speed: -kmh(3), lookingAhead: true })
  quiet('look-direction', { speed: -kmh(3), lookingAhead: false })
  // Not first-person (a chase camera sees all round).
  quiet('look-direction', { speed: -kmh(3), lookingAhead: null })
  quiet('look-direction', { speed: kmh(3), lookingAhead: true })
  quiet('look-direction', { speed: -CREEP_SPEED, lookingAhead: true })
})

test('overspeed: over the course speed limit, either way, and the sign shows the limit', () => {
  quiet('overspeed', { speed: kmh(7.9) })
  assert.deepEqual(alertFor('overspeed', { speed: kmh(8.5) }).values, { limit: 8 })
  fires('overspeed', { speed: -kmh(8.5) })
  quiet('overspeed', { speed: kmh(11), speedLimit: kmh(12), speedLimitKmh: 12 })
  assert.deepEqual(alertFor('overspeed', { speed: kmh(13), speedLimit: kmh(12), speedLimitKmh: 12 }).values, { limit: 12 })
})

test('turn-speed: past half lock, or the wheel turned fast, above 5 km/h', () => {
  fires('turn-speed', { speed: kmh(6), steer: 0.6 })
  fires('turn-speed', { speed: kmh(6), steer: 0.1, steerRate: 2 })
  quiet('turn-speed', { speed: kmh(6), steer: 0.4, steerRate: 1 })
  // A slow pivot at full lock is how a forklift turns.
  quiet('turn-speed', { speed: kmh(3), steer: 1, steerRate: 3 })
})

test('direction-change-moving: shuttling a lever against the way the truck is rolling', () => {
  fires('direction-change-moving', { lever: 'R', speed: kmh(4) })
  fires('direction-change-moving', { lever: 'F', speed: -kmh(4) })
  quiet('direction-change-moving', { lever: 'R', speed: CREEP_SPEED })
  quiet('direction-change-moving', { lever: 'N', speed: kmh(4) })
  quiet('direction-change-moving', { lever: 'F', speed: kmh(4) })
  // The keyboard's automatic direction is not a lever.
  quiet('direction-change-moving', { lever: null, speed: -kmh(4), throttle: 1 })
})

test('forks-high-travel: travelling with the forks above 15 cm, laden or not', () => {
  fires('forks-high-travel', { speed: kmh(3), forkHeight: m(0.2) })
  fires('forks-high-travel', { ...CARRYING, speed: -kmh(3), forkHeight: m(0.5) })
  quiet('forks-high-travel', { speed: kmh(3), forkHeight: FORKS_TRAVEL_HEIGHT })
  quiet('forks-high-travel', { speed: CREEP_SPEED, forkHeight: m(1) })
  // In a rack's bay the forks have to be up, storing a load or backing out.
  quiet('forks-high-travel', { ...CARRYING, speed: kmh(3), forkHeight: m(1.5), atStack: true })
  quiet('forks-high-travel', { speed: -kmh(3), forkHeight: m(1.5), atStack: true })
})

test('mast-not-back: travelling with a load and the mast not tilted back', () => {
  fires('mast-not-back', { ...CARRYING, speed: kmh(3), mastTilt: 0 })
  quiet('mast-not-back', { ...CARRYING, speed: kmh(3) })
  quiet('mast-not-back', { ...CARRYING, speed: 0, mastTilt: 0 })
  // A load resting on the floor or a shelf is being set down.
  quiet('mast-not-back', { ...CARRYING, speed: kmh(3), mastTilt: 0, loadLanded: true })
  quiet('mast-not-back', { speed: kmh(3), mastTilt: 0 })
})

test('tilt-forward-elevated: a raised load tilted forward, except over the stack', () => {
  const raised = { ...CARRYING, forkHeight: m(1.2), mastTilt: TILT_FORWARD_ANGLE + 0.01 }
  assert.equal(alertFor('tilt-forward-elevated', raised).severity, 'danger')
  quiet('tilt-forward-elevated', { ...raised, atStack: true })
  quiet('tilt-forward-elevated', { ...raised, loadLanded: true })
  quiet('tilt-forward-elevated', { ...raised, mastTilt: 0 })
  quiet('tilt-forward-elevated', { ...raised, forkHeight: FORKS_TRAVEL_HEIGHT })
  quiet('tilt-forward-elevated', { ...raised, carrying: false })
})

test('lifting-while-moving: the lift lever worked while travelling', () => {
  fires('lifting-while-moving', { speed: kmh(3), lift: 1 })
  fires('lifting-while-moving', { speed: -kmh(3), lift: -0.5 })
  quiet('lifting-while-moving', { speed: CREEP_SPEED, lift: 1 })
  quiet('lifting-while-moving', { speed: kmh(3), lift: 0 })
  quiet('lifting-while-moving', { engineOn: false, seatbelt: true, speed: kmh(3), lift: 1 })
})

test('forks-not-inserted: raising with the forks only partly in', () => {
  fires('forks-not-inserted', { lift: 1, grip: 'partial' })
  fires('forks-not-inserted', { lift: 1, grip: 'shallow' })
  quiet('forks-not-inserted', { lift: 1, grip: 'secure' })
  quiet('forks-not-inserted', { lift: 1, grip: 'none' })
  quiet('forks-not-inserted', { lift: -1, grip: 'partial' })
})

test('parking-brake-on: the accelerator against a set parking brake is information, not a fault', () => {
  const alert = alertFor('parking-brake-on', { parkingBrake: true, throttle: 1 })
  assert.deepEqual([alert.severity, alert.sound], ['info', null])
  quiet('parking-brake-on', { parkingBrake: true, throttle: 0.1 })
  quiet('parking-brake-on', { parkingBrake: false, throttle: 1 })
  quiet('parking-brake-on', { engineOn: false, parkingBrake: true, throttle: 1 })
})

test('seatbelt-off: the engine running with the seatbelt unfastened', () => {
  fires('seatbelt-off', { seatbelt: false })
  quiet('seatbelt-off', { seatbelt: true })
  quiet('seatbelt-off', { engineOn: false, seatbelt: false })
})

test('forks-raised-parked: forks up with the engine off or the parking brake set', () => {
  fires('forks-raised-parked', { engineOn: false, forkHeight: m(0.5) })
  fires('forks-raised-parked', { parkingBrake: true, forkHeight: m(0.5) })
  quiet('forks-raised-parked', { forkHeight: m(0.5) })
  quiet('forks-raised-parked', { engineOn: false, forkHeight: PARKED_FORKS_MAX })
})

// --- The alert queue ---------------------------------------------------------

const alert = (id, severity = 'caution', extra = {}) => ({
  id,
  severity,
  kind: 'warning',
  pictogram: 'obstacle',
  messageKey: `safety.sign.${id}`,
  sound: { info: null, caution: 'cautionChime', danger: 'dangerAlarm' }[severity],
  values: {},
  ...extra,
})

const DT = 1 / 60

// Run the queue over a script of [seconds, alerts] spans at the sim's step,
// collecting every edge.
function run(script, queue = createAlertQueue(), startTime = 0) {
  const edges = []
  let time = startTime
  for (const [seconds, active] of script) {
    const steps = Math.round(seconds / DT)
    for (let i = 0; i < steps; i += 1) {
      time += DT
      queue = stepAlertQueue(queue, active, time)
      edges.push(...queue.edges)
    }
  }
  return { queue, edges, time }
}

const shownIds = (queue) => queue.shown.map((entry) => entry.id)

test('a sign comes up only after its rule has held for 150 ms', () => {
  const early = run([[ALERT_SHOW_AFTER - 2 * DT, [alert('overspeed')]]])
  assert.deepEqual(shownIds(early.queue), [])
  assert.deepEqual(early.edges, [])

  const shown = run([[ALERT_SHOW_AFTER + 2 * DT, [alert('overspeed')]]])
  assert.deepEqual(shownIds(shown.queue), ['overspeed'])
  assert.deepEqual(shown.edges, [{ id: 'overspeed', severity: 'caution', sound: 'cautionChime', escalation: false }])
})

test('a rule that holds for less than 150 ms never shows and is never logged', () => {
  const { queue, edges } = run([
    [0.1, [alert('overspeed')]],
    [0.05, []],
    [0.1, [alert('overspeed')]],
    [1, []],
  ])
  assert.deepEqual(shownIds(queue), [])
  assert.deepEqual(edges, [])
})

test('a sign stays for 500 ms after its rule stops holding, then clears', () => {
  const up = run([[0.3, [alert('overspeed')]]])
  const lingering = run([[ALERT_CLEAR_AFTER - 3 * DT, []]], up.queue, up.time)
  assert.deepEqual(shownIds(lingering.queue), ['overspeed'])
  const cleared = run([[5 * DT, []]], lingering.queue, lingering.time)
  assert.deepEqual(shownIds(cleared.queue), [])
})

test('a rule that flickers keeps one steady sign and is logged once', () => {
  const script = [[0.3, [alert('overspeed')]]]
  for (let i = 0; i < 10; i += 1) script.push([0.2, []], [0.05, [alert('overspeed')]])
  const { queue, edges } = run(script)
  assert.deepEqual(shownIds(queue), ['overspeed'])
  assert.equal(edges.length, 1)
})

test('a rule that comes back after its sign cleared is a new violation', () => {
  const { edges } = run([
    [0.3, [alert('overspeed')]],
    [1, []],
    [0.3, [alert('overspeed')]],
  ])
  assert.equal(edges.length, 2)
  assert.ok(edges.every((edge) => !edge.escalation))
})

test('danger is shown first, whichever came up first', () => {
  const { queue } = run([
    [0.3, [alert('overspeed')]],
    [0.3, [alert('overspeed'), alert('overload', 'danger')]],
  ])
  assert.deepEqual(shownIds(queue), ['overload', 'overspeed'])
})

test('at most two signs are stacked; the third still counts as a violation', () => {
  const three = [alert('overspeed'), alert('turn-speed'), alert('overload', 'danger')]
  const { queue, edges } = run([[0.3, three]])
  assert.equal(queue.shown.length, ALERT_MAX_SHOWN)
  assert.deepEqual(shownIds(queue), ['overload', 'overspeed'])
  assert.deepEqual(edges.map((edge) => edge.id).sort(), ['overload', 'overspeed', 'turn-speed'])

  // When the danger clears, the sign that was waiting takes its place
  // without being logged again.
  const after = run([[1, [alert('overspeed'), alert('turn-speed')]]], queue, 0.3)
  assert.deepEqual(shownIds(after.queue), ['overspeed', 'turn-speed'])
  assert.deepEqual(after.edges, [])
})

test('among equals the older sign keeps its place', () => {
  const { queue } = run([
    [0.3, [alert('turn-speed')]],
    [0.3, [alert('overspeed'), alert('turn-speed')]],
  ])
  assert.deepEqual(shownIds(queue), ['turn-speed', 'overspeed'])
})

test('a sign steps up to danger at once, and the step is logged as an escalation', () => {
  const up = run([[0.3, [alert('obstacle-ahead')]]])
  const stepped = stepAlertQueue(up.queue, [alert('obstacle-ahead', 'danger')], up.time + DT)
  assert.equal(stepped.shown[0].severity, 'danger')
  assert.deepEqual(stepped.edges, [{ id: 'obstacle-ahead', severity: 'danger', sound: 'dangerAlarm', escalation: true }])
})

test('a sign steps back down from danger only after 500 ms, so it cannot flicker between the two', () => {
  const script = [[0.3, [alert('obstacle-ahead', 'danger')]]]
  for (let i = 0; i < 6; i += 1) script.push([0.2, [alert('obstacle-ahead')]], [0.05, [alert('obstacle-ahead', 'danger')]])
  const flickering = run(script)
  assert.equal(flickering.queue.shown[0].severity, 'danger')
  // One edge: it came up as danger and never stepped down.
  assert.equal(flickering.edges.length, 1)

  const settled = run([[ALERT_CLEAR_AFTER + 2 * DT, [alert('obstacle-ahead')]]], flickering.queue, flickering.time)
  assert.equal(settled.queue.shown[0].severity, 'caution')
  assert.deepEqual(settled.edges, [])
})

test('a sign that came up as danger is one violation, not an escalation', () => {
  const { edges } = run([[0.3, [alert('overload', 'danger')]]])
  assert.deepEqual(edges, [{ id: 'overload', severity: 'danger', sound: 'dangerAlarm', escalation: false }])
})

test('a sign that is up keeps the same alert object, and `shown` the same array, until it changes', () => {
  const first = run([[0.3, [alert('overspeed', 'caution', { values: { limit: 8 } })]]])
  // A fresh but equal alert every step, as activeAlerts() produces.
  const second = run([[0.3, [alert('overspeed', 'caution', { values: { limit: 8 } })]]], first.queue, first.time)
  assert.equal(second.queue.shown, first.queue.shown)
  assert.equal(second.queue.shown[0], first.queue.shown[0])

  // What the sign says changed (the interlock moving on to its next item).
  const changed = run([[DT, [alert('overspeed', 'caution', { values: { limit: 12 } })]]], second.queue, second.time)
  assert.notEqual(changed.queue.shown, second.queue.shown)
  assert.deepEqual(changed.queue.shown[0].values, { limit: 12 })
  assert.deepEqual(changed.edges, [])
})

test('an idle queue reports no edges and allocates no new lists', () => {
  const queue = createAlertQueue()
  const next = stepAlertQueue(queue, [], 1)
  assert.equal(next.shown, queue.shown)
  assert.equal(next.edges.length, 0)
})
