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
// 'R' | null for the keyboard's automatic direction; also lights, beacon and
// turnSignal) before that. `press` on a phase taps those keys once when it
// starts (the cab keys that raise commands: H, L, O, [, ]).
//
// Since Phase 4 the engine starts only through the pre-start interlock
// (seatbelt, parking brake, N) and the parking brake holds the truck, so
// every drive begins with startEngine: the learner's start sequence, then the
// parking brake released.
//
// Everything here is deterministic: no randomness, no wall clock, and every
// decision is a threshold on the observation.

import { drivingCourses } from '../data/drivingCourse.js'
import { palletPhysics, TINE_HEEL_Z } from '../data/physicsProfile.js'
import { RACK_LEVEL_HEIGHTS } from '../data/rackProfile.js'
import { hornReach } from '../lib/driving/stepGoals.js'
import { featureCourses } from './featureCourses.js'

export const SCENARIO_DT = 1 / 60

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

// Creep forward until the truck is stopped by what is in front of it: the
// rack's face, where its body is held.
const creepUntilBlocked = (speed = 0.25, frames = 1500) => ({
  name: 'creep until blocked',
  keys: (obs) => speedKeys(obs, speed),
  until: (obs, phaseFrame) => phaseFrame > 20 && obs.speed === 0,
  frames,
})

// Where the truck stands, on a course driven up the +Z axis, with its forks
// into a pallet: `seated` (0..1) of the way from the pallet's near face at
// the fork tips to its near face at the carriage.
const FORK_TIP_Z = 0.6436886749311639
function forksInAt(pallet, seated = 1) {
  const nearFace = pallet.position[2] - palletPhysics(pallet).footprint.halfDepth
  const tipsAtFace = nearFace - FORK_TIP_Z
  // Stopping short of the carriage by a centimetre: the load is seated, not
  // shoved.
  const heelsAtFace = nearFace - TINE_HEEL_Z - 0.0025
  return tipsAtFace + (heelsAtFace - tipsAtFace) * seated
}

// Drive the lowered forks into a pallet straight ahead and stop there: at
// travelling speed to a truck's length short of it, then at a crawl, which is
// how a load is approached.
const forksInto = (pallet, seated = 1) => {
  const stopZ = forksInAt(pallet, seated)
  return {
    name: seated === 1 ? 'forks into the pallet' : `forks ${Math.round(seated * 100)}% into the pallet`,
    keys: (obs) => {
      const remaining = stopZ - obs.z
      if (remaining <= 0.012) return speedKeys(obs, 0)
      return speedKeys(obs, remaining > 1.2 ? 0.6 : Math.max(0.1, Math.min(0.3, remaining * 0.6)))
    },
    until: (obs, phaseFrame) => phaseFrame > 20 && stopped(obs) && obs.z >= stopZ - 0.03,
    frames: 1500,
  }
}

// The fork height at which a carried pallet's underside is `clearance` above
// a rack level's shelf, and at which the tines hang free inside the pockets
// of a pallet resting on it.
const PALLET_UNDER_TINE_TOP = 0.0104
const aboveShelf = (level, clearance = 0.035) => RACK_LEVEL_HEIGHTS[level] + PALLET_UNDER_TINE_TOP + clearance
const freeOnShelf = (level) => RACK_LEVEL_HEIGHTS[level] + PALLET_UNDER_TINE_TOP - 0.009

// Travel height: let go of the lift key here and the carriage coasts up to
// about 20 cm as the valve closes, clear of the floor and under the
// forks-high-travel threshold.
const TRAVEL_HEIGHT = 0.035

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

// Setting a load down: level the mast, lower until the surface has the load
// and the tines hang free in the pockets, then back straight out.
const levelMast = { name: 'level the mast', keys: hold({ tiltForward: true }), until: (obs) => obs.tilt >= -0.002, frames: 300 }
const backOut = (distance, speed = -0.25) => {
  let from = 0
  return {
    name: 'back out',
    keys: (obs) => speedKeys(obs, speed),
    until: (obs, phaseFrame) => {
      if (phaseFrame === 0) from = obs.z
      return from - obs.z >= distance
    },
    frames: 900,
  }
}

const brakeToStop = {
  name: 'brake to stop',
  keys: (obs) => speedKeys(obs, 0),
  until: (obs, phaseFrame) => phaseFrame > 2 && Math.abs(obs.speed) < 0.001,
  frames: 600,
}

// Pick a pallet up the way the courses teach: forks all the way in, up to
// travel height, mast back.
const pickUp = (pallet) => [forksInto(pallet), raiseTo(TRAVEL_HEIGHT), tiltBackTo(-0.1)]
// And set it down where the truck stands.
const setDownOnFloor = [levelMast, lowerTo(0), backOut(0.8), brakeToStop]
const setDownOnShelf = (level) => [
  raiseTo(aboveShelf(level)),
  creepUntilBlocked(0.18),
  levelMast,
  lowerTo(freeOnShelf(level)),
  backOut(0.6),
  brakeToStop,
]

// Reverse straight back until the truck is at `z`.
const reverseTo = (z, speed = -0.25) => ({
  name: `reverse to ${z}`,
  keys: (obs) => speedKeys(obs, obs.z > z ? speed : 0),
  until: (obs, phaseFrame) => obs.failed || (phaseFrame > 2 && obs.z <= z + 0.02 && stopped(obs)),
  frames: 2400,
})
const honk = { name: 'sound the horn', press: ['h'], keys: hold(NO_KEYS), frames: 1 }
const stopAt = (point) => ({
  name: `stop at ${point[2]}`,
  keys: driveTo(point, { speed: 0.4, stop: true, stopRadius: 0.05 }),
  until: (obs, phaseFrame) => obs.failed || (phaseFrame > 20 && stopped(obs)),
  frames: 1200,
})

// Bang-bang steering in reverse: the tail toward a point. Reversing turns
// the truck the other way for the same steer, so the keys are swapped.
function reverseSteerKeys(obs, point, deadband = 0.03) {
  const bearing = Math.atan2(obs.x - point[0], obs.z - point[2])
  const error = wrapAngle(bearing - obs.heading)
  if (error > deadband) return { right: true }
  if (error < -deadband) return { left: true }
  return {}
}

// Follow a checkpoint course in reverse, as followCheckpoints does forward.
function reverseCheckpoints(checkpoints, speed) {
  return (obs) => {
    const checkpoint = checkpoints[obs.checkpointIndex]
    if (!checkpoint) return speedKeys(obs, 0)
    const distance = distanceTo(obs, checkpoint.position)
    const target = checkpoint.type === 'stop' ? (distance < 0.35 ? 0 : -Math.min(speed, Math.max(0.12, distance * 0.6))) : -speed
    return { ...reverseSteerKeys(obs, checkpoint.position), ...speedKeys(obs, target) }
  }
}

// forksInto from off the pallet's line: steering for its centre on the way
// in, so the tines meet the pockets square (a medium pallet's leave about
// 2 cm either way).
const forksIntoSteered = (pallet) => {
  const phase = forksInto(pallet)
  return {
    ...phase,
    name: 'steer the forks into the pallet',
    keys: (obs, phaseFrame) => {
      const keys = phase.keys(obs, phaseFrame)
      return obs.z < pallet.position[2] - 1.2 && obs.speed > 0.05 ? { ...steerKeys(obs, pallet.position, 0.004), ...keys } : keys
    },
  }
}

// Drive through `points` in turn, moving on within `reach` of each.
function followPoints(points, { speed = 0.3, reach = 0.5 } = {}) {
  let index = 0
  return {
    name: 'follow the route',
    keys: (obs, phaseFrame) => {
      if (phaseFrame === 0) index = 0
      while (index < points.length - 1 && distanceTo(obs, points[index]) < reach) index += 1
      return driveTo(points[index], { speed })(obs)
    },
    until: (obs) => obs.failed || distanceTo(obs, points.at(-1)) < reach,
    frames: 6000,
  }
}

const course = (id) => drivingCourses[id]
const palletOf = (id, index = 0) => (course(id).pallets || [course(id).pallet])[index]

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
        until: (obs) => obs.failed || obs.checkpointIndex >= 5,
        frames: 6000,
      },
      // Since the module improvements' Phase 6 the course ends in a dead end:
      // round the corner into it, stop, and reverse out.
      followPoints([[0, 0, 38], [0, 0, 39.4]], { speed: 0.4, reach: 0.4 }),
      {
        name: 'into the dead end',
        keys: followCheckpoints(course('driving-course'), 0.4),
        until: (obs) => obs.failed || obs.checkpointIndex >= course('driving-course').checkpoints.length - 1,
        frames: 2400,
      },
      {
        name: 'reverse out',
        keys: reverseCheckpoints(course('driving-course').checkpoints, 0.35),
        until: (obs) => obs.failed || obs.checkpointIndex >= course('driving-course').checkpoints.length,
        frames: 3000,
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
      ...pickUp(palletOf('precision-carry')),
      {
        name: 'carry to the drop zone',
        keys: driveTo([0, 0, 18.4], { speed: 0.5, stop: true }),
        until: (obs, phaseFrame) => phaseFrame > 30 && stopped(obs),
        frames: 2400,
      },
      ...setDownOnFloor,
      settle(),
    ],
  },
  {
    id: 'load-limits-overload',
    course: course('load-limits'),
    phases: [
      ...startEngine,
      forksInto(palletOf('load-limits', 1)),
      { name: 'try to lift', keys: hold({ raise: true }), until: (obs) => obs.failed, frames: 300 },
      settle(150),
    ],
  },
  {
    id: 'rack-storage-delivery',
    course: course('rack-storage'),
    phases: [
      ...startEngine,
      ...pickUp(palletOf('rack-storage')),
      {
        name: 'carry toward the rack',
        keys: driveTo([0, 0, 13.2], { speed: 0.5, stop: true }),
        until: (obs, phaseFrame) => phaseFrame > 30 && stopped(obs),
        frames: 2400,
      },
      ...setDownOnShelf('middle'),
    ],
  },
  {
    // A load lost to a hard stop: the forks two thirds of the way in, the
    // mast left upright, then full brake from speed. Friction cannot hold
    // it, and with a third of the pallet beyond the tips it goes off them.
    id: 'load-dropped',
    course: course('precision-carry'),
    phases: [
      ...startEngine,
      forksInto(palletOf('precision-carry'), 0.66),
      raiseTo(TRAVEL_HEIGHT),
      { name: 'speed up', keys: hold({ forward: true }), until: (obs) => obs.failed || obs.speed >= 1.0, frames: 600 },
      {
        name: 'slam the brakes',
        keys: hold({ back: true }),
        until: (obs, phaseFrame) => obs.failed || (phaseFrame > 2 && obs.speed <= 0.05),
        frames: 300,
      },
      settle(180),
    ],
  },
  {
    // The same stop with the load seated to the carriage and the mast tilted
    // all the way back: it rides it out.
    id: 'load-held',
    course: course('precision-carry'),
    phases: [
      ...startEngine,
      ...pickUp(palletOf('precision-carry')),
      tiltBackTo(-0.185),
      { name: 'speed up', keys: hold({ forward: true }), until: (obs) => obs.failed || obs.speed >= 1.0, frames: 600 },
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
    id: 'high-travel',
    course: course('precision-carry'),
    phases: [
      ...startEngine,
      forksInto(palletOf('precision-carry')),
      raiseTo(0.3),
      tiltBackTo(-0.1),
      { name: 'drive with forks high', keys: hold({ forward: true }), until: (obs) => obs.failed, frames: 600 },
      settle(60),
    ],
  },
  {
    // A pallet struck at speed: the forks are too high for the pockets, so
    // the tines meet its face.
    id: 'pallet-impact',
    course: course('pallet-pickup'),
    setup: { x: 0, z: 6.5, heading: 0, forkHeight: 0.05 },
    phases: [
      ...startEngine,
      { name: 'drive at the pallet', keys: (obs) => speedKeys(obs, 0.55), until: (obs) => obs.failed, frames: 900 },
      settle(90),
    ],
  },
  {
    // A forward tip-over: a load half as heavy again as the truck's rating,
    // on a course that does not fail an overload. The stability model does.
    id: 'tip-over-forward',
    course: course('rack-storage'),
    courseOverride: { capacityKg: 300 },
    phases: [
      ...startEngine,
      forksInto(palletOf('rack-storage')),
      { name: 'lift', keys: hold({ raise: true }), until: (obs) => obs.failed, frames: 300 },
      settle(150),
    ],
  },
  {
    // A sideways tip-over: a load carried high, then a swerve at speed.
    id: 'tip-over-turn',
    course: course('pallet-pickup'),
    courseOverride: { decorations: [], capacityKg: 500 },
    phases: [
      ...startEngine,
      forksInto(palletOf('pallet-pickup')),
      raiseTo(0.7),
      tiltBackTo(-0.1),
      { name: 'speed up', keys: hold({ forward: true }), until: (obs) => obs.failed || obs.speed >= 1.0, frames: 600 },
      { name: 'swerve', keys: hold({ forward: true, left: true }), until: (obs) => obs.failed, frames: 300 },
      settle(150),
    ],
  },
  {
    // The same swerve with the load at travel height: the truck stays up.
    id: 'turn-lowered',
    course: course('pallet-pickup'),
    courseOverride: { decorations: [], capacityKg: 500 },
    phases: [
      ...startEngine,
      ...pickUp(palletOf('pallet-pickup')),
      { name: 'speed up', keys: hold({ forward: true }), until: (obs) => obs.failed || obs.speed >= 1.0, frames: 600 },
      { name: 'swerve', keys: hold({ forward: true, left: true }), until: (obs) => obs.failed, frames: 120 },
      { name: 'coast to a stop', keys: hold(NO_KEYS), until: (obs, phaseFrame) => phaseFrame > 2 && stopped(obs), frames: 900 },
    ],
  },
  {
    // One tine in a pocket and the other outside the pallet: lifted, it
    // rolls off the fork.
    id: 'one-tine-pickup',
    course: course('pallet-pickup'),
    courseOverride: { failConditions: { loadDrop: true } },
    setup: { x: -0.105, z: 8.5, heading: 0 },
    phases: [
      ...startEngine,
      forksInto(palletOf('pallet-pickup')),
      { name: 'lift', keys: hold({ raise: true }), until: (obs) => obs.failed || obs.forkHeight >= 0.4, frames: 600 },
      settle(180),
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
      ...pickUp(palletOf('pallet-pickup')),
      { name: 'reverse clear', keys: (obs) => speedKeys(obs, -0.25), until: (obs) => obs.z <= 9.0, frames: 600 },
      brakeToStop,
      {
        name: 'carry to the drop zone',
        keys: driveTo([-2.6, 0, 18], { speed: 0.4, stop: true }),
        until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs)),
        frames: 2400,
      },
      levelMast,
      lowerTo(0),
      { name: 'back out', keys: (obs) => speedKeys(obs, -0.25), until: (obs) => obs.deliveredCount >= 1, frames: 900 },
      brakeToStop,
      settle(),
    ],
  },
  {
    id: 'rack-storage-top-delivery',
    course: course('rack-storage-top'),
    phases: [
      ...startEngine,
      ...pickUp(palletOf('rack-storage-top')),
      {
        name: 'carry toward the rack',
        keys: driveTo([0, 0, 13.2], { speed: 0.5, stop: true }),
        until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs)),
        frames: 2400,
      },
      ...setDownOnShelf('top'),
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
  ...phase5Scenarios(),
  ...phase6Scenarios(),
  ...phase7Scenarios(),
]

// The module improvements' Phase 5 features, on the fixture courses in
// featureCourses.js (recorded with them, 2026-10-05).
function phase5Scenarios() {
  const feature = (id) => featureCourses[id]
  const featurePallet = (id, index = 0) => feature(id).pallets[index]

  return [
    {
      // The load 0.3 m toward the far end: 0.9 m from the fork face once
      // seated, over the plate derated for that.
      id: 'load-centre-overload',
      course: feature('load-centre'),
      setup: { x: -1.5, z: 0, heading: 0 },
      phases: [
        ...startEngine,
        forksInto(featurePallet('load-centre', 0)),
        { name: 'try to lift', keys: hold({ raise: true }), until: (obs) => obs.failed, frames: 300 },
        settle(60),
      ],
    },
    {
      // The same weight, centred: within the plate, so it lifts.
      id: 'load-centre-lift',
      course: feature('load-centre'),
      setup: { x: 1.5, z: 0, heading: 0 },
      phases: [...startEngine, ...pickUp(featurePallet('load-centre', 1)), settle(60)],
    },
    {
      // Off the top shelf: forks to the pockets, in until the rack stops the
      // truck, lift it clear, back out, down to travel height, back to the
      // dock and set it down.
      id: 'shelf-retrieval',
      course: feature('shelf-retrieval'),
      phases: [
        ...startEngine,
        stopAt([0, 0, 13.4]),
        raiseTo(freeOnShelf('top') + 0.01),
        lowerTo(freeOnShelf('top') + 0.004),
        creepUntilBlocked(0.15),
        raiseTo(aboveShelf('top', 0.02)),
        tiltBackTo(-0.1),
        backOut(0.8),
        brakeToStop,
        lowerTo(TRAVEL_HEIGHT),
        reverseTo(5.6),
        levelMast,
        lowerTo(0),
        backOut(0.8),
        brakeToStop,
        settle(),
      ],
    },
    {
      // A blind crossing reached without the horn does not clear; sounding
      // it there does, and the drive goes on.
      id: 'horn-crossing',
      course: feature('horn-crossing'),
      phases: [
        ...startEngine,
        stopAt([0, 0, 6]),
        settle(60),
        honk,
        settle(10),
        { name: 'on to the finish', keys: driveTo([0, 0, 11], { speed: 0.4 }), until: (obs) => obs.failed || obs.checkpointIndex >= 2, frames: 1200 },
        brakeToStop,
      ],
    },
    {
      // A whole mission: start, horn at the crossing, the pallet to the
      // dock, then reverse into the bay and secure the truck.
      id: 'mission-run',
      course: feature('mission'),
      phases: [
        ...startEngine,
        { name: 'approach the crossing', keys: driveTo([0, 0, 4], { speed: 0.4 }), until: (obs) => obs.z >= 2.6, frames: 900 },
        honk,
        stopAt([0, 0, 4]),
        ...pickUp(featurePallet('mission')),
        stopAt([0, 0, 15.4]),
        ...setDownOnFloor,
        reverseTo(7),
        brakeToStop,
        ...shutDown,
        settle(30),
      ],
    },
  ]
}

// The courses the module improvements' Phase 6 added to Load Handling and
// Pallet Handling Assessment, each driven to completion (recorded with them).
function phase6Scenarios() {
  const crossing = course('speed-zones').checkpoints[1].position
  const centred = palletOf('load-centre', 1)
  return [
    {
      // Out of the dead end the only way there is: in reverse, round the bend.
      id: 'reverse-travel',
      course: course('reverse-travel'),
      phases: [
        ...startEngine,
        {
          name: 'reverse out',
          keys: reverseCheckpoints(course('reverse-travel').checkpoints, 0.25),
          until: (obs) => obs.failed || obs.checkpointIndex >= course('reverse-travel').checkpoints.length,
          frames: 4000,
        },
        brakeToStop,
      ],
    },
    {
      // Under the 5 km/h limit, a stop at the line, then a stop and the horn
      // at the blind crossing.
      id: 'speed-zones',
      course: course('speed-zones'),
      phases: [
        ...startEngine,
        {
          name: 'to the stop line',
          keys: followCheckpoints(course('speed-zones'), 0.3),
          until: (obs) => obs.failed || obs.checkpointIndex >= 1,
          frames: 2400,
        },
        {
          name: 'to the crossing',
          keys: followCheckpoints(course('speed-zones'), 0.3),
          until: (obs, phaseFrame) => obs.failed || (phaseFrame > 20 && stopped(obs) && distanceTo(obs, crossing) < 0.4),
          frames: 2400,
        },
        honk,
        settle(10),
        {
          name: 'out of the zone',
          keys: followCheckpoints(course('speed-zones'), 0.3),
          until: (obs) => obs.failed || obs.checkpointIndex >= course('speed-zones').checkpoints.length,
          frames: 2400,
        },
        brakeToStop,
      ],
    },
    {
      // The far load's pallet: over the plate derated for its load centre.
      id: 'load-centre-far',
      course: course('load-centre'),
      setup: { x: -1.4, z: 3, heading: 0 },
      phases: [
        ...startEngine,
        forksInto(palletOf('load-centre', 0)),
        { name: 'try to lift', keys: hold({ raise: true }), until: (obs) => obs.failed, frames: 300 },
        settle(60),
      ],
    },
    {
      // The centred one: lined up from the start, lifted and delivered.
      id: 'load-centre-delivery',
      course: course('load-centre'),
      phases: [
        ...startEngine,
        followPoints([[1.4, 0, 2.2], [1.4, 0, 3.4]], { speed: 0.3, reach: 0.2 }),
        forksIntoSteered(centred),
        raiseTo(TRAVEL_HEIGHT),
        tiltBackTo(-0.1),
        reverseTo(5.4),
        {
          name: 'carry to the drop zone',
          keys: driveTo([0, 0, 14.4], { speed: 0.3, stop: true }),
          until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs)),
          frames: 2400,
        },
        ...setDownOnFloor,
        settle(),
      ],
    },
    {
      // The near-rated load round the curve and the S-bend, low and slow.
      id: 'stability-turns',
      course: course('stability-turns'),
      phases: [
        ...startEngine,
        ...pickUp(palletOf('stability-turns')),
        followPoints([[0, 0, 7], [1.8, 0, 11], [1.8, 0, 14], [0, 0, 17], [-1.8, 0, 20], [0, 0, 23], [0, 0, 25]], { speed: 0.3 }),
        {
          name: 'carry to the drop zone',
          keys: driveTo([0, 0, 26.9], { speed: 0.3, stop: true }),
          until: (obs, phaseFrame) => obs.failed || (phaseFrame > 30 && stopped(obs)),
          frames: 2400,
        },
        ...setDownOnFloor,
        settle(),
      ],
    },
    {
      // Off the top shelf, down to travel height, back to the dock.
      id: 'rack-retrieval',
      course: course('rack-retrieval'),
      phases: [
        ...startEngine,
        stopAt([0, 0, 10.4]),
        raiseTo(freeOnShelf('top') + 0.01),
        lowerTo(freeOnShelf('top') + 0.004),
        creepUntilBlocked(0.15),
        raiseTo(aboveShelf('top', 0.02)),
        tiltBackTo(-0.1),
        backOut(0.8),
        brakeToStop,
        lowerTo(TRAVEL_HEIGHT),
        reverseTo(2.6),
        levelMast,
        lowerTo(0),
        backOut(0.8),
        brakeToStop,
        settle(),
      ],
    },
  ]
}

// Reverse through `points` in turn, the tail toward each, moving on within
// `reach` of each and stopping at the last.
function reverseRoute(points, { speed = 0.25, reach = 0.3 } = {}) {
  let index = 0
  return {
    name: 'reverse along the route',
    keys: (obs, phaseFrame) => {
      if (phaseFrame === 0) index = 0
      while (index < points.length - 1 && distanceTo(obs, points[index]) < reach) index += 1
      const point = points[index]
      const last = index === points.length - 1
      const distance = distanceTo(obs, point)
      const target = last ? (distance < 0.05 ? 0 : -Math.min(speed, Math.max(0.1, distance * 0.6))) : -speed
      return { ...reverseSteerKeys(obs, point), ...speedKeys(obs, target) }
    },
    until: (obs, phaseFrame) => obs.failed || (phaseFrame > 20 && stopped(obs) && distanceTo(obs, points.at(-1)) < 0.12),
    frames: 4000,
  }
}

// Drive up the line x = `x` and stop with the truck at `z`, steering for a
// point beyond it, so the truck is square when it stops (steering for the
// stop point itself swings it about as it arrives).
function driveStraightTo(x, z, speed = 0.25) {
  return {
  name: `drive straight to ${z}`,
  keys: (obs) => {
    const remaining = z - obs.z
    const steer = obs.speed > 0.02 ? steerKeys(obs, [x, 0, z + 3], 0.004) : {}
    return { ...steer, ...speedKeys(obs, remaining <= 0.012 ? 0 : Math.min(speed, Math.max(0.08, remaining * 0.6))) }
  },
  until: (obs, phaseFrame) => obs.failed || (phaseFrame > 20 && stopped(obs) && obs.z >= z - 0.05),
  frames: 5000,
  }
}

// The Final Driving Test (module improvements Phase 7): the whole mission, as
// a learner who passes drives it, and the same drive with one mistake, the
// forks put into the pallet that is over the derated capacity and backed out
// of again: a danger sign, nothing lifted, the mission still finished.
function phase7Scenarios() {
  const test = course('final-test')
  const [storePallet] = test.pallets
  const rack = test.racks[0]
  const dock = test.dropZones[0]
  const bay = test.parkingBay
  const crossing = test.checkpoints[1]
  // The horn is sounded once the crossing is in reach: before that it would
  // not count, after it the sound-horn sign would come up.
  const hornAt = crossing.position[2] - hornReach(crossing) + 0.03
  // Under the aisle's 5 km/h (0.347 units a second), with the keys' overshoot.
  const speed = 0.2
  // With the forks raised, the truck goes no faster than a creep (1 km/h)
  // until their tips are in the rack's slot, or forks-high-travel comes up.
  const inch = 0.06
  const inchIn = () => creepUntilBlocked(inch, 5000)

  const toTheCrossing = [
    ...startEngine,
    reverseRoute([[1.3, 0, 1], [0.6, 0, 0.4], test.checkpoints[0].position], { speed }),
    followPoints([[0.15, 0, 1.4], [0, 0, 2.6]], { speed, reach: 0.3 }),
    { name: 'approach the crossing', keys: driveTo(crossing.position, { speed }), until: (obs) => obs.failed || obs.z >= hornAt, frames: 900 },
    honk,
    {
      name: 'stop in the crossing',
      keys: driveTo(crossing.position, { speed, stop: true, stopRadius: 0.3 }),
      until: (obs, phaseFrame) => obs.failed || (phaseFrame > 20 && stopped(obs) && distanceTo(obs, crossing.position) < 0.4),
      frames: 1200,
    },
  ]
  const lineUpWith = (pallet, from) =>
    followPoints([...from, [pallet.position[0], 0, pallet.position[2] - 1.9], [pallet.position[0], 0, pallet.position[2] - 1.3]], { speed, reach: 0.25 })
  const atTheRack = rack.position[2] - 1.25
  const storeAndRetrieve = ({ beforeRetrieve = [] } = {}) => [
    lineUpWith(storePallet, [[0, 0, 8], [-0.6, 0, 9.4]]),
    forksIntoSteered(storePallet),
    raiseTo(TRAVEL_HEIGHT),
    tiltBackTo(-0.1),
    driveStraightTo(rack.position[0], atTheRack, speed),
    raiseTo(aboveShelf('middle')),
    inchIn(),
    levelMast,
    lowerTo(freeOnShelf('middle')),
    backOut(0.6, -inch),
    brakeToStop,
    ...beforeRetrieve,
    raiseTo(freeOnShelf('top') + 0.01),
    lowerTo(freeOnShelf('top') + 0.004),
    inchIn(),
    raiseTo(aboveShelf('top', 0.02)),
    tiltBackTo(-0.1),
    backOut(0.8, -inch),
    brakeToStop,
    lowerTo(TRAVEL_HEIGHT),
    reverseTo(dock.position[2] - 0.4, -speed),
    levelMast,
    lowerTo(0),
    backOut(0.8, -speed),
    brakeToStop,
  ]
  const park = [
    reverseRoute([[bay.position[0], 0, bay.position[2] + 1.2], bay.position], { speed, reach: 0.25 }),
    brakeToStop,
    ...shutDown,
    settle(30),
  ]

  return [
    { id: 'final-test-pass', course: test, phases: [...toTheCrossing, ...storeAndRetrieve(), ...park] },
    {
      // The same drive with one mistake: between storing the one pallet and
      // fetching the other, forks down, back off and up to the rack again
      // too fast, braking only just short of it. obstacle-ahead rises to
      // danger, nothing is touched, and the mission is still finished.
      id: 'final-test-danger',
      course: test,
      phases: [
        ...toTheCrossing,
        ...storeAndRetrieve({
          beforeRetrieve: [
            lowerTo(TRAVEL_HEIGHT),
            reverseTo(rack.position[2] - 2.8, -speed),
            {
              name: 'rush at the rack',
              keys: (obs) => speedKeys(obs, 0.3),
              until: (obs) => obs.failed || obs.z >= rack.position[2] - 0.78,
              frames: 1200,
            },
            brakeToStop,
            reverseTo(atTheRack + 0.02, -inch),
          ],
        }),
        ...park,
      ],
    },
  ]
}

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
      adapter.frame(keys, { engineToggle: Boolean(phase.engineToggle) && first, cab: first ? phase.cab : undefined, press: first ? phase.press : undefined })
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
