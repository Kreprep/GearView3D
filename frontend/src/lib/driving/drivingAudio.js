import { SOUND_BANK } from '../../data/soundBank.js'
import { clamp } from '../math.js'
import { displayedDirection } from './cockpitTelemetry.js'
import { FORK_MAX_HEIGHT, MAX_SPEED } from './constants.js'
import { neutralControls } from './controls.js'
import { tineGroundClearance } from './forkPose.js'
import { kmh, m } from './units.js'

// What the driving simulation sounds like (docs/revisions/
// post-defense-plan.md, section 4.4). Audio is view-side: it reads the sim
// state each frame, like syncView.js, and never writes it.
//
// - audioTargets(state) says how loud and at what pitch each loop should be
//   right now. Pure, and where the tests are. engineRevTarget(state) is the
//   engine speed it asks for, and slewRev() how fast a real engine gets there.
// - eventSounds(event) / switchSounds(previous, next) / alertSounds(edges)
//   name the one-shots a sim event, a moved cab switch or a safety sign
//   plays, and impactGain(event) how loud a knock is. Pure.
// - createDrivingAudio(engine) holds one attempt's loops and applies all of
//   the above to an audio engine (lib/audio/audioEngine.js). The engine is
//   passed in, so this file has no browser APIs.

export const LOOP_NAMES = ['engineIdle', 'engineHigh', 'reverseBeeper', 'hydraulicWhine', 'reliefStrain', 'chainRattle', 'forkScrape']

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

// The fork tips are on the floor when the tines are this close to it, and
// scrape when the truck travels faster than this. The scrape is at its
// loudest from SCRAPE_FULL_SPEED.
const SCRAPE_CLEARANCE = m(0.01)
const SCRAPE_MIN_SPEED = kmh(0.5)
const SCRAPE_FULL_SPEED = kmh(6)
// An impact (the sim's 'impact' event) at this speed or more plays at full
// volume; a gentler one is quieter, down to IMPACT_MIN_GAIN.
const IMPACT_FULL_SPEED = kmh(6)
const IMPACT_MIN_GAIN = 0.25

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
  forkScrape: MACHINE_TIME_CONSTANT,
}

const NO_CONTROLS = neutralControls()
// The dashboard's lever is already in the merged controls.
const NO_SWITCHES = { lever: null }

const silent = () => ({ gain: 0, rate: 1 })

// The forklift recording keeps sounding under the high-revs one, at this
// share of the power at full revs. The high-revs loop is a car holding its
// revs, close to a pure tone (about 82 Hz), which laptop speakers barely
// reproduce: faded out entirely, the forklift left full throttle a thin hum
// (team's listening check, 2026-10-01). Kept, pitched up with the revs, its
// rough firing carries the engine's character to the top of the range.
const IDLE_FLOOR = 0.6
// An engine is louder working than idling: the engine loops' gain at full
// revs, relative to idle (+1.9 dB, which with the forklift loop kept is
// +3.5 dB RMS in an offline render, peaks still 10 dB under full scale).
const FULL_REV_LOUDNESS = 1.25

// The two engine loops for an engine speed of `rev` (0 idle .. 1 full
// throttle). Both are pitched to the same firing frequency, so the crossfade
// between the recordings is heard as one engine. Equal power, because the two
// recordings are not in phase, and the forklift loop never fades below
// IDLE_FLOOR of it; the whole engine then gets louder with the revs.
function engineLoops(rev) {
  const idleHz = SOUND_BANK.engineIdle.firingHz
  const highHz = SOUND_BANK.engineHigh.firingHz
  const firingHz = idleHz + rev * (highHz - idleHz)
  const high = Math.sqrt(1 - IDLE_FLOOR ** 2) * Math.sin((rev * Math.PI) / 2)
  const loudness = 1 + (FULL_REV_LOUDNESS - 1) * rev
  return {
    engineIdle: { gain: Math.sqrt(1 - high ** 2) * loudness, rate: firingHz / idleHz },
    engineHigh: { gain: high * loudness, rate: firingHz / highHz },
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

  // Steel on concrete: the fork tips on the floor while the truck moves,
  // engine running or not.
  const travel = Math.abs(truck.speed)
  if (travel > SCRAPE_MIN_SPEED && tineGroundClearance(state) <= SCRAPE_CLEARANCE) {
    targets.forkScrape.gain = clamp(travel / SCRAPE_FULL_SPEED, 0, 1)
  }

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

// What each kind of impact sounds like: a pallet struck or landing is wood,
// a cone hollow plastic, racking or a wall metal.
const IMPACT_SOUNDS = { pallet: 'palletDrop', landing: 'palletDrop', cone: 'coneKnock', structure: 'metalImpact' }

// The one-shots a sim core event (simCore.js) plays.
export function eventSounds(event) {
  if (event.type === 'engine') return [event.on ? 'engineStart' : 'engineStop']
  if (event.type === 'engine-blocked') return ['denied']
  if (event.type === 'impact' && IMPACT_SOUNDS[event.what]) return [IMPACT_SOUNDS[event.what]]
  return []
}

// How loud an impact plays (0..1 of the bank's gain): harder is louder.
export function impactGain(event) {
  return clamp(event.speed / IMPACT_FULL_SPEED, IMPACT_MIN_GAIN, 1)
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
// A defect scenario's sound rules (data/defectLibrary.js, `sounds`) in the
// cab: how loud each of its loops should be now. A loop plays while 'shown'
// (always), while the 'engine' runs, or while 'braking' (the service brake on
// with the truck moving). Pure.
const BRAKING_MIN_SPEED = kmh(0.5)
const BRAKING_MIN_PEDAL = 0.1

export function defectLoopTargets(rules, state) {
  const controls = state.frame.controls || NO_CONTROLS
  const braking = Math.abs(state.truck.speed) > BRAKING_MIN_SPEED && Math.max(controls.brake, controls.inching || 0) > BRAKING_MIN_PEDAL
  const targets = {}
  for (const rule of rules || []) {
    if (!rule.loop) continue
    const on = rule.while === 'engine' ? state.truck.engineOn : rule.while === 'braking' ? braking : true
    targets[rule.loop] = Math.max(targets[rule.loop] || 0, on ? 1 : 0)
  }
  return targets
}

// What a sample is replaced by under a defect's `{ replace, with }` rules (a
// dead horn clicks), or the sample itself.
export const replacedSound = (rules, name) => (rules || []).find((rule) => rule.replace === name)?.with || name

// `defectSounds` are a defect scenario's sound rules; a healthy truck has
// none.
export function createDrivingAudio(engine, { capacityKg, defectSounds = [] } = {}) {
  const loops = Object.fromEntries(LOOP_NAMES.map((name) => [name, engine.createLoop(name)]))
  const defectLoopNames = [...new Set(defectSounds.filter((rule) => rule.loop).map((rule) => rule.loop))]
  const defectLoops = Object.fromEntries(defectLoopNames.map((name) => [name, engine.createLoop(name)]))
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
      const defectTargets = defectLoopTargets(defectSounds, state)
      for (const name of defectLoopNames) defectLoops[name].setGain(defectTargets[name] || 0, ENGINE_TIME_CONSTANT)

      const current = { key: switches.key, seatbelt: switches.seatbelt, parkingBrake: switches.parkingBrake }
      switchSounds(lastSwitches, current).forEach((name) => engine.playOneShot(name))
      lastSwitches = current
    },

    // A sim core event, as drained from the core.
    handleEvent(event) {
      if (event.type === 'engine') engineCatchAt = event.on ? engine.now() + SOUND_BANK.engineStart.catchAt : 0
      const options = event.type === 'impact' ? { gain: impactGain(event) } : undefined
      eventSounds(event).forEach((name) => engine.playOneShot(name, options))
    },

    // Safety signs that came up since the last frame.
    handleAlerts(edges) {
      alertSounds(edges).forEach((name) => engine.playOneShot(name))
    },

    horn() {
      engine.playOneShot(replacedSound(defectSounds, 'horn'))
    },

    // A faulty gauge passing its alarm level (createFaultAlarm in
    // lib/inspection/instruments.js).
    faultAlarm() {
      engine.playOneShot('cautionChime')
    },

    dispose() {
      LOOP_NAMES.forEach((name) => loops[name].stop())
      defectLoopNames.forEach((name) => defectLoops[name].stop())
    },
  }
}
