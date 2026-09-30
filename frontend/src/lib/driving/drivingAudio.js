import { SOUND_BANK } from '../../data/soundBank.js'
import { clamp } from '../math.js'
import { displayedDirection } from './cockpitTelemetry.js'
import { FORK_MAX_HEIGHT, MAX_SPEED } from './constants.js'
import { neutralControls } from './controls.js'

// What the driving simulation sounds like (docs/revisions/
// post-defense-plan.md, section 4.4). Audio is view-side: it reads the sim
// state each frame, like syncView.js, and never writes it.
//
// - audioTargets(state) says how loud and at what pitch each loop should be
//   right now. Pure, and where the tests are. engineRevTarget(state) is the
//   engine speed it asks for, and slewRev() how fast a real engine gets there.
// - eventSounds(event) / switchSounds(previous, next) / alertSounds(edges)
//   name the one-shots a sim event, a moved cab switch or a safety sign
//   plays. Pure.
// - createDrivingAudio(engine) holds one attempt's loops and applies all of
//   the above to an audio engine (lib/audio/audioEngine.js). The engine is
//   passed in, so this file has no browser APIs.

export const LOOP_NAMES = ['engineIdle', 'engineHigh', 'reverseBeeper', 'hydraulicWhine', 'reliefStrain', 'chainRattle']

// Working the lift makes the pump load the engine, which the governor answers
// with a few more revs, as a fraction of the throttle's range.
const LIFT_REV = 0.3
// A truck rolling in gear keeps its engine turning: with the pedal released
// the revs settle at this fraction of the throttle's range at top speed, less
// the slower it rolls, instead of dropping straight to idle. Without it,
// easing off to hold a speed limit sounded like the engine cutting out.
const ROAD_REV = 0.5
// An engine has inertia: its revs climb and fall at these rates (the
// throttle's whole range per second), falling slower than they climb. A
// keyboard's throttle is all or nothing, so feathering W to hold a speed is a
// string of taps; followed exactly, each tap flipped the sound between idle
// and full revs.
const REV_RISE_RATE = 2.5
const REV_FALL_RATE = 1.0
// How far the pump's pitch rises from no load to a load at the rated capacity.
const LOAD_PITCH_RISE = 0.25
// The reference truck's rated capacity (Toyota 8FGU25, public spec listing),
// for a course that sets none.
const REFERENCE_CAPACITY_KG = 2270

// How quickly each loop follows its target (seconds, the time constant of an
// exponential approach). The engine takes a moment to gain and lose revs; a
// beeper or a valve is on or off.
const ENGINE_TIME_CONSTANT = 0.18
const SWITCHED_TIME_CONSTANT = 0.03
const MACHINE_TIME_CONSTANT = 0.06
const LOOP_TIME_CONSTANTS = {
  engineIdle: ENGINE_TIME_CONSTANT,
  engineHigh: ENGINE_TIME_CONSTANT,
  reverseBeeper: SWITCHED_TIME_CONSTANT,
  hydraulicWhine: MACHINE_TIME_CONSTANT,
  reliefStrain: MACHINE_TIME_CONSTANT,
  chainRattle: MACHINE_TIME_CONSTANT,
}

const NO_CONTROLS = neutralControls()
// The dashboard's lever is already in the merged controls.
const NO_SWITCHES = { lever: null }

const silent = () => ({ gain: 0, rate: 1 })

// The two engine loops for an engine speed of `rev` (0 idle .. 1 full
// throttle). Both are pitched to the same firing frequency, so the crossfade
// between the recordings is heard as one engine. Equal power, because the two
// recordings are not in phase.
function engineLoops(rev) {
  const idleHz = SOUND_BANK.engineIdle.firingHz
  const highHz = SOUND_BANK.engineHigh.firingHz
  const firingHz = idleHz + rev * (highHz - idleHz)
  const angle = (rev * Math.PI) / 2
  return {
    engineIdle: { gain: Math.cos(angle), rate: firingHz / idleHz },
    engineHigh: { gain: Math.sin(angle), rate: firingHz / highHz },
  }
}

// The gain (0..1) and playback rate every loop should be heading for, given
// The engine speed the controls and the road ask for right now, 0 (idle) to
// 1 (full throttle). The throttle sets the revs whatever the direction lever
// says: in N, and against the parking brake or the inching pedal, it still
// revs the engine. A raised lift lever loads it a little, and a rolling truck
// holds it off idle (ROAD_REV). A failed attempt locks the controls
// (stepDrive), and the engine idles.
export function engineRevTarget(state) {
  if (!state.truck.engineOn || state.failed) return 0
  const controls = state.frame.controls || NO_CONTROLS
  const throttle = clamp(controls.throttle, 0, 1)
  const lift = clamp(controls.lift, -1, 1)
  const road = ROAD_REV * clamp(Math.abs(state.truck.speed) / MAX_SPEED, 0, 1)
  return Math.max(throttle, lift > 0 ? lift * LIFT_REV : 0, road)
}

// Move the engine's revs toward `target` over `dt` seconds, no faster than an
// engine gains or loses them.
export function slewRev(rev, target, dt) {
  if (target > rev) return Math.min(rev + REV_RISE_RATE * dt, target)
  return Math.max(rev - REV_FALL_RATE * dt, target)
}

// the sim state as the last step left it. `capacityKg` is the course's rated
// capacity, which the carried load is weighed against. `rev` is the engine
// speed to sound (createDrivingAudio passes its slewed one); left out, it is
// the one the state asks for.
export function audioTargets(state, { capacityKg, rev = engineRevTarget(state) } = {}) {
  const { truck, forks } = state
  const controls = state.frame.controls || NO_CONTROLS
  const targets = Object.fromEntries(LOOP_NAMES.map((name) => [name, silent()]))
  if (!truck.engineOn) return targets

  // A failed attempt locks the controls (stepDrive).
  const live = !state.failed
  const lift = live ? clamp(controls.lift, -1, 1) : 0
  const tilt = live ? clamp(controls.tilt, -1, 1) : 0

  Object.assign(targets, engineLoops(clamp(rev, 0, 1)))

  if (displayedDirection(state, controls, NO_SWITCHES) === 'R') targets.reverseBeeper.gain = 1

  // stepForks clamps the height to exactly 0 and FORK_MAX_HEIGHT.
  const liftStalled = (lift > 0 && forks.height >= FORK_MAX_HEIGHT) || (lift < 0 && forks.height <= 0)
  const liftLever = Math.abs(lift)
  const loadKg = state.hud.carriedLoadKg || 0
  const capacity = typeof capacityKg === 'number' && capacityKg > 0 ? capacityKg : REFERENCE_CAPACITY_KG
  targets.hydraulicWhine.gain = Math.max(liftLever, Math.abs(tilt))
  targets.hydraulicWhine.rate = 1 + LOAD_PITCH_RISE * clamp(loadKg / capacity, 0, 1)
  if (liftStalled) targets.reliefStrain.gain = liftLever
  else targets.chainRattle.gain = liftLever

  return targets
}

// The one-shots a sim core event (simCore.js) plays.
export function eventSounds(event) {
  if (event.type === 'engine') return [event.on ? 'engineStart' : 'engineStop']
  if (event.type === 'engine-blocked') return ['denied']
  return []
}

// The cab switches (dashboardSource.js) that make a sound when they move.
const SWITCH_SOUNDS = [
  ['key', 'keyClick'],
  ['seatbelt', 'seatbelt'],
  ['parkingBrake', 'parkingBrake'],
]

// The one-shots for the switches that moved between two readings. `previous`
// is null the first time, when nothing has moved yet.
export function switchSounds(previous, next) {
  if (!previous) return []
  return SWITCH_SOUNDS.filter(([name]) => previous[name] !== next[name]).map(([, sound]) => sound)
}

// The one-shot for the safety signs that came up this frame (the alert
// queue's edges, safetyRules.js): a caution chimes and a danger sounds the
// alarm. Several at once play only the most urgent, not a pile of chimes.
const ALERT_SOUND_PRIORITY = ['dangerAlarm', 'cautionChime']

export function alertSounds(edges) {
  const wanted = new Set(edges.map((edge) => edge.sound))
  const sound = ALERT_SOUND_PRIORITY.find((name) => wanted.has(name))
  return sound ? [sound] : []
}

// One attempt's sound. `engine` is an audio engine: createLoop(name) ->
// { setGain, setRate, stop }, playOneShot(name) and now() (seconds).
export function createDrivingAudio(engine, { capacityKg } = {}) {
  const loops = Object.fromEntries(LOOP_NAMES.map((name) => [name, engine.createLoop(name)]))
  let lastSwitches = null
  // While the start recording cranks, the engine loops wait for it to fire.
  let engineCatchAt = 0
  // The engine's revs, following engineRevTarget() with inertia (slewRev),
  // and the audio clock when they were last moved.
  let rev = null
  let revAt = 0

  return {
    // Every frame: point the loops at their targets and click any switch
    // that moved. `switches` are the dashboard source's.
    update(state, switches) {
      const now = engine.now()
      const revTarget = engineRevTarget(state)
      // The first frame, and a stopped engine, have no revs to carry over.
      rev = rev === null || !state.truck.engineOn ? revTarget : slewRev(rev, revTarget, now - revAt)
      revAt = now
      const targets = audioTargets(state, { capacityKg, rev })
      if (now < engineCatchAt) {
        targets.engineIdle.gain = 0
        targets.engineHigh.gain = 0
      }
      for (const name of LOOP_NAMES) {
        const timeConstant = LOOP_TIME_CONSTANTS[name]
        loops[name].setGain(targets[name].gain, timeConstant)
        loops[name].setRate(targets[name].rate, timeConstant)
      }

      const current = { key: switches.key, seatbelt: switches.seatbelt, parkingBrake: switches.parkingBrake }
      switchSounds(lastSwitches, current).forEach((name) => engine.playOneShot(name))
      lastSwitches = current
    },

    // A sim core event, as drained from the core.
    handleEvent(event) {
      if (event.type === 'engine') engineCatchAt = event.on ? engine.now() + SOUND_BANK.engineStart.catchAt : 0
      eventSounds(event).forEach((name) => engine.playOneShot(name))
    },

    // Safety signs that came up since the last frame.
    handleAlerts(edges) {
      alertSounds(edges).forEach((name) => engine.playOneShot(name))
    },

    horn() {
      engine.playOneShot('horn')
    },

    dispose() {
      LOOP_NAMES.forEach((name) => loops[name].stop())
    },
  }
}
