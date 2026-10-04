import { displayedDirection } from '../driving/cockpitTelemetry.js'
import { MAX_STEER_ANGLE, STOP_SPEED_EPSILON, TILT_BACK_MAX, TILT_FORWARD_MAX } from '../driving/constants.js'
import { cabPowered } from '../driving/dashboardSource.js'
import { kmh, m } from '../driving/units.js'

// The engine-on inspection's device and control tests
// (docs/modules/module-improvements-plan.md, section 3.3): each one ticks
// itself when the learner is seen doing it in the cab. Pure: a detector is a
// reducer over one inspection snapshot per sim step (inspectionSnapshot()),
// and lib/inspection/inspectionMonitor.js runs them. They read the
// simulation and never write it.
//
// A detector is (memo, snapshot, device) => memo, starting from {}. It is
// done once memo.done is true, and stays done.

// Test thresholds, each a GearView default in real units.
// Steering: turned to at least this share of full lock, each way.
export const STEER_LOCK_SHARE = 0.95
// Brakes: creep forward past this speed, then brake to a stop within this
// distance of where the brake went on.
export const BRAKE_TEST_SPEED = kmh(2)
export const BRAKE_TEST_DISTANCE = m(2)
// The brake counts as applied from this pedal travel. The truck is stopped
// where the keyboard takes it to be (below STOP_SPEED_EPSILON, where a held
// S stops braking and starts reversing).
export const BRAKE_APPLIED = 0.3
// Lift and tilt: forks raised above this height and lowered again below the
// second (about travel height: forks tilted forward meet the floor sooner),
// and the mast tilted past this share of each limit. (Forward tilt
// needs the forks off the floor, as on the real truck.)
export const LIFT_TEST_HEIGHT = m(0.5)
export const LIFT_TEST_LOWERED = m(0.15)
export const TILT_TEST_SHARE = 0.8
// Travel: this far driven forward, and this far in reverse.
export const TRAVEL_TEST_DISTANCE = m(0.5)

// What the detectors read, from the state the last sim step left
// (state.frame.controls is that step's merged controls) and the dashboard's
// switches. `horn` is whether the horn sounded since the last snapshot, and
// `marked` the device ids whose markers were clicked since then.
export function inspectionSnapshot(state, { switches, horn = false, marked = [] }) {
  const { truck, forks } = state
  const controls = state.frame.controls
  const powered = cabPowered(switches, truck.engineOn)
  return {
    time: state.time,
    engineOn: truck.engineOn,
    x: truck.x,
    z: truck.z,
    speed: truck.speed,
    steer: truck.steer,
    forkHeight: forks.height,
    tilt: forks.tilt,
    brake: controls ? controls.brake : 0,
    // The reverse beeper's rule (drivingAudio.js): the engine running and
    // the truck in R.
    reverseBeeper: truck.engineOn && Boolean(controls) && displayedDirection(state, controls, switches) === 'R',
    lights: powered && switches.lights,
    beacon: powered && switches.beacon,
    turnSignal: powered ? switches.turnSignal : 'off',
    horn,
    marked,
  }
}

const done = (memo) => (memo.done ? memo : { ...memo, done: true })

// Records one of several things seen, done once all of them have been.
const seeing = (memo, key, seen, needed) => {
  if (!seen || memo[key]) return memo
  const next = { ...memo, [key]: true }
  return needed.every((name) => next[name]) ? { ...next, done: true } : next
}

export const DETECTORS = {
  // Clicking the device's marker on the truck: the fallback for any device
  // without a detector of its own, as the walk-around always worked.
  marker: (memo, snapshot, device) => (snapshot.marked.includes(device.id) ? done(memo) : memo),

  horn: (memo, snapshot) => (snapshot.horn ? done(memo) : memo),

  lights: (memo, snapshot) => (snapshot.lights ? done(memo) : memo),

  beacon: (memo, snapshot) => (snapshot.beacon ? done(memo) : memo),

  // Left then right, in either order.
  'turn-signals': (memo, snapshot) => {
    const next = seeing(memo, 'left', snapshot.turnSignal === 'left', ['left', 'right'])
    return seeing(next, 'right', snapshot.turnSignal === 'right', ['left', 'right'])
  },

  // The lever in R with the engine running sounds the beeper.
  'backup-alarm': (memo, snapshot) => (snapshot.reverseBeeper ? done(memo) : memo),

  // Full lock both ways (the rear wheels follow the wheel at a standstill
  // with the engine running).
  'steer-lock': (memo, snapshot) => {
    const lock = STEER_LOCK_SHARE * MAX_STEER_ANGLE
    const next = seeing(memo, 'one', snapshot.steer >= lock, ['one', 'other'])
    return seeing(next, 'other', snapshot.steer <= -lock, ['one', 'other'])
  },

  // Forward past the test speed, then the brake held until the truck stops
  // within the test distance. Letting the brake off first, or running past
  // the distance, starts the test again.
  'brake-test': (memo, snapshot) => {
    if (memo.done) return memo
    const stopped = Math.abs(snapshot.speed) <= STOP_SPEED_EPSILON
    const braking = snapshot.brake >= BRAKE_APPLIED
    if (memo.brakingFrom) {
      const travelled = Math.hypot(snapshot.x - memo.brakingFrom.x, snapshot.z - memo.brakingFrom.z)
      if (travelled > BRAKE_TEST_DISTANCE) return {}
      if (stopped) return { done: true }
      if (!braking) return snapshot.speed >= BRAKE_TEST_SPEED ? { armed: true } : {}
      return memo
    }
    const armed = memo.armed || snapshot.speed >= BRAKE_TEST_SPEED
    if (armed && braking && !stopped) return { brakingFrom: { x: snapshot.x, z: snapshot.z } }
    return armed ? { armed: true } : memo
  },

  // Forks up past the test height and back down, and the mast tilted back
  // and forward.
  'lift-tilt': (memo, snapshot) => {
    const needed = ['lowered', 'tiltBack', 'tiltForward']
    let next = memo
    if (snapshot.forkHeight >= LIFT_TEST_HEIGHT && !next.raised) next = { ...next, raised: true }
    next = seeing(next, 'lowered', next.raised && snapshot.forkHeight <= LIFT_TEST_LOWERED, needed)
    next = seeing(next, 'tiltBack', snapshot.tilt <= -TILT_TEST_SHARE * TILT_BACK_MAX, needed)
    return seeing(next, 'tiltForward', snapshot.tilt >= TILT_TEST_SHARE * TILT_FORWARD_MAX, needed)
  },

  // Distance driven forward and in reverse, each counted from how far the
  // truck moved between snapshots and which way it was rolling.
  travel: (memo, snapshot) => {
    if (memo.done) return memo
    const from = memo.at
    const next = { ...memo, at: { x: snapshot.x, z: snapshot.z } }
    if (from) {
      const moved = Math.hypot(snapshot.x - from.x, snapshot.z - from.z)
      if (snapshot.speed > 0) next.forward = (memo.forward ?? 0) + moved
      else if (snapshot.speed < 0) next.reverse = (memo.reverse ?? 0) + moved
    }
    if ((next.forward ?? 0) >= TRAVEL_TEST_DISTANCE && (next.reverse ?? 0) >= TRAVEL_TEST_DISTANCE) next.done = true
    return next
  },
}
export const DETECTOR_IDS = Object.keys(DETECTORS)

// The stock engine-on devices (data/inspectionScenarios.js) and the detector
// each one is tested by, for rows saved before devices had a `detect`.
export const STOCK_DEVICE_DETECTORS = {
  horn: 'horn',
  headlights: 'lights',
  'tail-lights': 'marker',
  'turn-signals': 'turn-signals',
  'warning-beacon': 'beacon',
  'backup-alarm': 'backup-alarm',
  'steering-response': 'steer-lock',
  brakes: 'brake-test',
  'lift-tilt-functions': 'lift-tilt',
  'forward-reverse-travel': 'travel',
}

// The detector a device row is tested by: its own `detect` if that is one,
// else the stock one for its id, else a click on its marker.
export function deviceDetector(device) {
  if (DETECTORS[device?.detect]) return device.detect
  return STOCK_DEVICE_DETECTORS[device?.id] ?? 'marker'
}
