// Scripted drives for the driving-simulation characterization tests
// (lib/driving/simCore.characterization.test.js).
//
// Each scenario is a course plus a list of phases. A phase decides which keys
// are held this frame from an observation of the simulation, and ends when its
// `until` condition holds (or after `frames` frames). The same scripts ran
// against the pre-refactor frame loop to record
// lib/driving/__golden__/characterization.json, and now run against the
// headless core, so a behaviour change in the refactor shows up as a trace
// that no longer matches.
//
// Keys are the legacy held-key booleans the keyboard produced
// (forward/back/left/right/raise/lower/tiltBack/tiltForward); `engineToggle`
// on a phase presses E once when the phase starts, and `cab` sets the
// dashboard's switches ({ seatbelt, parkingBrake, lever }, lever 'F' | 'N' |
// 'R' | null for the keyboard's automatic direction) before that.
//
// Since Phase 4 the engine starts only through the pre-start interlock
// (seatbelt, parking brake, N) and the parking brake holds the truck, so
// every drive begins with startEngine: the learner's start sequence, then the
// parking brake released.
//
// Everything here is deterministic: no randomness, no wall clock, and every
// decision is a threshold on the observation.

import { drivingCourses } from '../data/drivingCourse.js'
import { TILT_FORWARD_MAX } from '../lib/driving/constants.js'

export const SCENARIO_DT = 1 / 60

// Pallet half-extents measured in the browser off the three pallet GLBs
// (lib/driving/models.js modelFootprint), so the headless run sees the same
// footprints the viewer measures at runtime.
export const MEASURED_PALLET_FOOTPRINTS = {
  light: { halfWidth: 0.14999999664723873, halfDepth: 0.14999998928931055 },
  medium: { halfWidth: 0.12469142398834228, halfDepth: 0.15001668661695977 },
  heavy: { halfWidth: 0.1300163514163415, halfDepth: 0.15000000988526271 },
}

// Same weight bands as palletModelForWeight() in lib/driving/models.js,
// which imports three.js and so stays out of this file.
export function measuredPalletFootprint(pallet) {
  const weight = pallet.weightKg
  if (typeof weight !== 'number' || weight <= 500) return MEASURED_PALLET_FOOTPRINTS.light
  if (weight >= 1000) return MEASURED_PALLET_FOOTPRINTS.heavy
  return MEASURED_PALLET_FOOTPRINTS.medium
}

const NO_KEYS = Object.freeze({})

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

// Hold a target speed with W/S. S brakes while moving forward and reverses
// once the truck is below the stop epsilon, so a target of 0 releases it as
// soon as the truck has nearly stopped, and a negative target keeps it held
// until the truck is reversing that fast.
function speedKeys(obs, target) {
  if (target < 0) return obs.speed > target ? { back: true } : {}
  if (target === 0) return obs.speed > 0.06 ? { back: true } : {}
  if (obs.speed < target - 0.04) return { forward: true }
  if (obs.speed > target + 0.12) return { back: true }
  return {}
}

// Bang-bang steering toward a point. A (left) turns a forward-moving truck
// toward +X, which is increasing heading.
function steerKeys(obs, point, deadband = 0.03) {
  const bearing = Math.atan2(point[0] - obs.x, point[2] - obs.z)
  const error = wrapAngle(bearing - obs.heading)
  if (error > deadband) return { left: true }
  if (error < -deadband) return { right: true }
  return {}
}

function distanceTo(obs, point) {
  return Math.hypot(point[0] - obs.x, point[2] - obs.z)
}

// Drive toward a point at `speed`, easing off over the last stretch when
// `stop` is set.
function driveTo(point, { speed = 0.5, stop = false, stopRadius = 0.15 } = {}) {
  return (obs) => {
    const distance = distanceTo(obs, point)
    const target = stop ? (distance < stopRadius ? 0 : Math.min(speed, Math.max(0.12, distance * 0.6))) : speed
    return { ...steerKeys(obs, point), ...speedKeys(obs, target) }
  }
}

const stopped = (obs) => Math.abs(obs.speed) < 0.001
const hold = (keys) => () => keys

// Follow a checkpoint course: target the active checkpoint, slowing into
// stop-type ones and waiting in them until they clear.
function followCheckpoints(course, speed) {
  return (obs) => {
    const checkpoint = course.checkpoints[obs.checkpointIndex]
    if (!checkpoint) return speedKeys(obs, 0)
    if (checkpoint.type === 'stop') {
      return driveTo(checkpoint.position, { speed, stop: true, stopRadius: 0.35 })(obs)
    }
    return driveTo(checkpoint.position, { speed })(obs)
  }
}

const startEngine = [
  { name: 'start sequence', cab: { seatbelt: true, parkingBrake: true }, engineToggle: true, keys: hold(NO_KEYS), frames: 1 },
  { name: 'release parking brake', cab: { parkingBrake: false }, keys: hold(NO_KEYS), frames: 1 },
]
// Securing a parked truck: parking brake, then the key off.
const shutDown = [
  { name: 'set parking brake', cab: { parkingBrake: true }, keys: hold(NO_KEYS), frames: 1 },
  { name: 'engine off', engineToggle: true, keys: hold(NO_KEYS), frames: 1 },
]
const settle = (frames = 30) => ({ name: 'settle', keys: hold(NO_KEYS), frames })

// Creep forward until the truck is stopped by what is in front of it (a
// pallet seated against the carriage, or the rack face). Drives at a normal
// speed up to `fastUntilZ`, then creeps the rest of the way.
const creepUntilBlocked = (speed = 0.25, fastUntilZ = -Infinity) => ({
  name: 'creep until blocked',
  keys: (obs) => speedKeys(obs, obs.z < fastUntilZ ? 0.6 : speed),
  until: (obs, phaseFrame) => phaseFrame > 20 && obs.speed === 0,
  frames: 1500,
})

const raiseTo = (height) => ({
  name: `raise to ${height}`,
  keys: hold({ raise: true }),
  until: (obs) => obs.forkHeight >= height,
  frames: 600,
})

const lowerTo = (height) => ({
  name: `lower to ${height}`,
  keys: hold({ lower: true }),
  until: (obs) => obs.forkHeight <= height,
  frames: 600,
})

const tiltBackTo = (angle) => ({
  name: `tilt back to ${angle}`,
  keys: hold({ tiltBack: true }),
  until: (obs) => obs.tilt <= angle,
  frames: 300,
})

const tiltForwardTo = (angle) => ({
  name: `tilt forward to ${angle}`,
  keys: hold({ tiltForward: true }),
  until: (obs) => obs.tilt >= angle,
  frames: 300,
})

const brakeToStop = {
  name: 'brake to stop',
  keys: (obs) => speedKeys(obs, 0),
  until: (obs, phaseFrame) => phaseFrame > 2 && Math.abs(obs.speed) < 0.001,
  frames: 600,
}

const halfInsert = {
  name: 'half insert',
  keys: (obs) => speedKeys(obs, obs.z >= 4.33 ? 0 : obs.z < 3.6 ? 0.6 : 0.25),
  until: (obs, phaseFrame) => phaseFrame > 20 && obs.z >= 4.33 && stopped(obs),
  frames: 900,
}

const course = (id) => drivingCourses[id]

export const drivingScenarios = [
  {
    id: 'accelerate-course',
    course: course('accelerate-course'),
    phases: [
      ...startEngine,
      { name: 'full throttle', keys: hold({ forward: true }), until: (obs) => obs.checkpointIndex >= 1, frames: 900 },
      brakeToStop,
      settle(),
    ],
  },
  {
    id: 'accelerate-brake',
    course: course('accelerate-brake'),
    phases: [
      ...startEngine,
      { name: 'accelerate', keys: hold({ forward: true }), until: (obs) => obs.z >= 10.5, frames: 900 },
      brakeToStop,
      settle(60),
    ],
  },
  {
    id: 'engine-off-coast',
    course: course('accelerate-course'),
    phases: [
      ...startEngine,
      { name: 'accelerate', keys: hold({ forward: true, left: true }), frames: 90 },
      { name: 'engine off while moving', engineToggle: true, keys: hold({ forward: true, raise: true }), frames: 120 },
      // Rolling, parking brake off: the interlock refuses the restart.
      { name: 'restart refused while rolling', engineToggle: true, keys: hold({ back: true }), frames: 60 },
      brakeToStop,
      ...startEngine,
      { name: 'reverse with engine back on', keys: hold({ back: true, right: true }), frames: 240 },
      brakeToStop,
    ],
  },
  {
    id: 'turning-practice',
    course: course('turning-practice'),
    phases: [
      ...startEngine,
      {
        name: 'slalom',
        // Slower than before Phase 4: with rear-wheel steer, turning for the
        // next gate swings the tail toward the cone just passed.
        keys: followCheckpoints(course('turning-practice'), 0.35),
        until: (obs) => obs.failed || obs.checkpointIndex >= course('turning-practice').checkpoints.length,
        frames: 6000,
      },
      brakeToStop,
    ],
  },
  {
    id: 'driving-course',
    course: course('driving-course'),
    phases: [
      ...startEngine,
      {
        name: 'course',
        keys: followCheckpoints(course('driving-course'), 0.5),
        until: (obs) => obs.failed || obs.checkpointIndex >= course('driving-course').checkpoints.length,
        frames: 6000,
      },
      settle(),
    ],
  },
  {
    id: 'cone-hit',
    course: course('secure-parking'),
    phases: [
      ...startEngine,
      { name: 'drive at cone', keys: driveTo([1.2, 0, 4], { speed: 0.8 }), until: (obs) => obs.failed, frames: 900 },
      settle(90),
    ],
  },
  {
    id: 'wall-hit',
    course: course('precision-carry'),
    setup: { x: 2, z: 12, heading: Math.PI / 2 },
    phases: [
      ...startEngine,
      { name: 'drive at wall', keys: hold({ forward: true }), until: (obs) => obs.failed, frames: 600 },
      settle(60),
    ],
  },
  {
    id: 'vehicle-hit',
    course: course('forklift-gap-parking'),
    phases: [
      ...startEngine,
      { name: 'drive at parked vehicle', keys: driveTo([-0.45, 0, 16], { speed: 0.7 }), until: (obs) => obs.failed, frames: 1800 },
      settle(60),
    ],
  },
  {
    id: 'rack-strike',
    course: course('rack-storage'),
    setup: { x: 0, z: 10, heading: 0 },
    phases: [
      ...startEngine,
      { name: 'drive at rack', keys: hold({ forward: true }), until: (obs) => obs.failed, frames: 600 },
      settle(60),
    ],
  },
  {
    id: 'secure-parking',
    course: course('secure-parking'),
    setup: { x: -2.6, z: 12.6, heading: 0 },
    phases: [
      ...startEngine,
      {
        name: 'into the bay',
        keys: driveTo([-2.6, 0, 16], { speed: 0.3, stop: true, stopRadius: 0.05 }),
        until: (obs, phaseFrame) => phaseFrame > 30 && stopped(obs) && Math.abs(obs.z - 16) < 0.3,
        frames: 1200,
      },
      brakeToStop,
      ...shutDown,
      settle(30),
    ],
  },
  {
    id: 'precision-carry-delivery',
    course: course('precision-carry'),
    phases: [
      ...startEngine,
      creepUntilBlocked(0.25, 3.8),
      raiseTo(0.15),
      tiltBackTo(-0.1),
      {
        name: 'carry to the drop zone',
        keys: driveTo([0, 0, 18.3], { speed: 0.5, stop: true }),
        until: (obs, phaseFrame) => phaseFrame > 30 && stopped(obs),
        frames: 2400,
      },
      lowerTo(0),
      tiltForwardTo(0.08),
      { name: 'back away', keys: (obs) => speedKeys(obs, -0.3), until: (obs) => obs.deliveredCount >= 1 || obs.z < 16.8, frames: 600 },
      brakeToStop,
      settle(),
    ],
  },
  {
    id: 'load-limits-overload',
    course: course('load-limits'),
    phases: [
      ...startEngine,
      creepUntilBlocked(0.25, 5.8),
      { name: 'try to lift', keys: hold({ raise: true }), until: (obs) => obs.failed, frames: 300 },
      settle(150),
    ],
  },
  {
    id: 'rack-storage-delivery',
    course: course('rack-storage'),
    phases: [
      ...startEngine,
      creepUntilBlocked(0.25, 4.8),
      raiseTo(0.15),
      tiltBackTo(-0.1),
      {
        name: 'carry toward the rack',
        keys: driveTo([0, 0, 13.2], { speed: 0.5, stop: true }),
        until: (obs, phaseFrame) => phaseFrame > 30 && stopped(obs),
        frames: 2400,
      },
      raiseTo(0.375),
      creepUntilBlocked(0.18),
      {
        name: 'tilt forward to set down',
        keys: hold({ tiltForward: true }),
        until: (obs) => obs.deliveredCount >= 1 || obs.tilt >= TILT_FORWARD_MAX - 0.001,
        frames: 300,
      },
      { name: 'back away', keys: (obs) => speedKeys(obs, -0.25), frames: 120 },
      brakeToStop,
    ],
  },
  {
    id: 'sudden-stop-slip',
    course: course('precision-carry'),
    phases: [
      ...startEngine,
      halfInsert,
      raiseTo(0.15),
      { name: 'speed up', keys: hold({ forward: true }), until: (obs) => obs.failed || obs.speed >= 1.2, frames: 600 },
      {
        name: 'slam the brakes',
        keys: hold({ back: true }),
        until: (obs, phaseFrame) => obs.failed || (phaseFrame > 2 && obs.speed <= 0.05),
        frames: 300,
      },
      settle(120),
    ],
  },
  {
    id: 'turn-slip',
    course: course('precision-carry'),
    // Only the sharp-turn slip source on, so the cornering path is recorded
    // on its own.
    courseOverride: { failConditions: { sharpTurn: true } },
    phases: [
      ...startEngine,
      halfInsert,
      raiseTo(0.15),
      { name: 'speed up', keys: hold({ forward: true }), until: (obs) => obs.speed >= 1.0, frames: 600 },
      { name: 'swerve', keys: hold({ forward: true, left: true }), until: (obs) => obs.failed, frames: 300 },
      settle(120),
    ],
  },
  {
    id: 'high-travel',
    course: course('precision-carry'),
    phases: [
      ...startEngine,
      creepUntilBlocked(0.25, 3.8),
      raiseTo(0.3),
      tiltBackTo(-0.1),
      { name: 'drive with forks high', keys: hold({ forward: true }), until: (obs) => obs.failed, frames: 600 },
      settle(60),
    ],
  },
  {
    id: 'load-tipping',
    course: course('rack-storage'),
    courseOverride: { capacityKg: 500, failConditions: { loadTipping: true } },
    phases: [
      ...startEngine,
      creepUntilBlocked(0.25, 4.8),
      raiseTo(0.5),
      { name: 'tilt forward high', keys: hold({ tiltForward: true }), until: (obs) => obs.failed, frames: 300 },
      settle(150),
    ],
  },
  {
    // The built-in courses the scenarios above don't already drive, so every
    // one is re-driven by the characterization run (Phase 4).
    id: 'forklift-gap-parking',
    course: course('forklift-gap-parking'),
    phases: [
      ...startEngine,
      {
        name: 'into the gap',
        keys: driveTo([0, 0, 16], { speed: 0.5, stop: true, stopRadius: 0.05 }),
        until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs) && Math.abs(obs.z - 16) < 0.3),
        frames: 2400,
      },
      brakeToStop,
      ...shutDown,
      settle(30),
    ],
  },
  {
    id: 'parallel-parking',
    course: course('parallel-parking'),
    phases: [
      ...startEngine,
      { name: 'up the lane', keys: driveTo([0, 0, 7], { speed: 0.5 }), until: (obs) => obs.z >= 7, frames: 1200 },
      { name: 'ease across', keys: driveTo([-1.2, 0, 10.4], { speed: 0.3 }), until: (obs) => obs.failed || obs.z >= 10.4, frames: 1200 },
      { name: 'straighten', keys: driveTo([-1.2, 0, 12], { speed: 0.2 }), until: (obs) => obs.failed || obs.z >= 11.8, frames: 1200 },
      // Lined up now: roll straight in and stop in the middle of the bay.
      { name: 'into the bay', keys: (obs) => speedKeys(obs, obs.z < 12.85 ? 0.15 : 0), until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs)), frames: 1200 },
      brakeToStop,
      ...shutDown,
      settle(30),
    ],
  },
  {
    id: 'pallet-pickup-delivery',
    course: course('pallet-pickup'),
    phases: [
      ...startEngine,
      creepUntilBlocked(0.25, 8.8),
      raiseTo(0.15),
      tiltBackTo(-0.1),
      { name: 'reverse clear', keys: (obs) => speedKeys(obs, -0.25), until: (obs) => obs.z <= 9.2, frames: 600 },
      brakeToStop,
      {
        name: 'carry to the drop zone',
        keys: driveTo([-2.6, 0, 18], { speed: 0.4, stop: true }),
        until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs)),
        frames: 2400,
      },
      lowerTo(0),
      tiltForwardTo(0.08),
      { name: 'back away', keys: (obs) => speedKeys(obs, -0.3), until: (obs) => obs.deliveredCount >= 1, frames: 600 },
      brakeToStop,
      settle(),
    ],
  },
  {
    id: 'rack-storage-top-delivery',
    course: course('rack-storage-top'),
    phases: [
      ...startEngine,
      creepUntilBlocked(0.25, 4.8),
      raiseTo(0.15),
      tiltBackTo(-0.1),
      {
        name: 'carry toward the rack',
        keys: driveTo([0, 0, 13.2], { speed: 0.5, stop: true }),
        until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs)),
        frames: 2400,
      },
      raiseTo(0.65),
      creepUntilBlocked(0.18),
      {
        name: 'tilt forward to set down',
        keys: hold({ tiltForward: true }),
        until: (obs) => obs.deliveredCount >= 1 || obs.tilt >= TILT_FORWARD_MAX - 0.001,
        frames: 300,
      },
      { name: 'back away', keys: (obs) => speedKeys(obs, -0.25), frames: 120 },
      brakeToStop,
    ],
  },
  {
    // The pre-start interlock: each missing item blocks the crank, W held
    // (direction F) blocks it too, and once started the parking brake holds
    // the truck against the throttle.
    id: 'start-interlock',
    course: course('accelerate-course'),
    phases: [
      { name: 'crank with nothing set', engineToggle: true, keys: hold(NO_KEYS), frames: 10 },
      { name: 'crank with seatbelt only', cab: { seatbelt: true }, engineToggle: true, keys: hold(NO_KEYS), frames: 10 },
      { name: 'crank holding W', cab: { parkingBrake: true }, engineToggle: true, keys: hold({ forward: true }), frames: 10 },
      { name: 'crank in neutral', engineToggle: true, keys: hold(NO_KEYS), frames: 10 },
      { name: 'throttle against the parking brake', keys: hold({ forward: true }), frames: 120 },
      { name: 'release and drive', cab: { parkingBrake: false }, keys: hold({ forward: true }), frames: 120 },
      { name: 'parking brake while moving', cab: { parkingBrake: true }, keys: hold(NO_KEYS), until: (obs, phaseFrame) => phaseFrame > 2 && stopped(obs), frames: 300 },
    ],
  },
  {
    // The dashboard lever: in N the throttle only revs; F and R drive; a
    // shuttle F to R while moving decelerates through zero and reverses.
    id: 'direction-lever',
    course: course('accelerate-course'),
    phases: [
      ...startEngine,
      { name: 'throttle in N', cab: { lever: 'N' }, keys: hold({ forward: true }), frames: 60 },
      { name: 'throttle in F', cab: { lever: 'F' }, keys: hold({ forward: true }), frames: 150 },
      { name: 'shuttle to R', cab: { lever: 'R' }, keys: hold({ forward: true }), frames: 300 },
      { name: 'brake in R', keys: hold({ back: true }), until: (obs, phaseFrame) => phaseFrame > 2 && stopped(obs), frames: 300 },
    ],
  },
  {
    // A tight pivot at a crawl: the rear-steer bicycle model at full lock.
    id: 'rear-steer-pivot',
    course: course('controls-intro'),
    phases: [
      ...startEngine,
      { name: 'creep', keys: (obs) => speedKeys(obs, 0.05), frames: 60 },
      { name: 'full lock left at a crawl', keys: (obs) => ({ left: true, ...speedKeys(obs, 0.05) }), frames: 240 },
      brakeToStop,
    ],
  },
]

// Run one scenario against a simulation adapter:
//   adapter.observe() -> the observation the phases read
//   adapter.frame(keys, { engineToggle, cab }) -> advance one SCENARIO_DT frame
// Returns the per-phase frame log so a failing test can say where it went off.
export function runScenario(scenario, adapter) {
  let frame = 0
  const phaseLog = []
  for (const phase of scenario.phases) {
    const limit = phase.frames ?? 600
    let phaseFrame = 0
    const startFrame = frame
    while (phaseFrame < limit) {
      const obs = adapter.observe()
      if (phase.until && phase.until(obs, phaseFrame)) break
      const keys = phase.keys(obs, phaseFrame) || NO_KEYS
      const first = phaseFrame === 0
      adapter.frame(keys, { engineToggle: Boolean(phase.engineToggle) && first, cab: first ? phase.cab : undefined })
      phaseFrame += 1
      frame += 1
    }
    phaseLog.push({ phase: phase.name, startFrame, frames: phaseFrame })
  }
  return { frames: frame, phaseLog }
}

export function scenarioCourse(scenario) {
  return scenario.courseOverride ? { ...scenario.course, ...scenario.courseOverride } : scenario.course
}
