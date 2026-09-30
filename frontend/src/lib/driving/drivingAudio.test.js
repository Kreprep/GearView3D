import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOUND_BANK } from '../../data/soundBank.js'
import { FORK_MAX_HEIGHT, TILT_BACK_MAX } from './constants.js'
import { neutralControls } from './controls.js'
import { alertSounds, audioTargets, createDrivingAudio, eventSounds, LOOP_NAMES, switchSounds } from './drivingAudio.js'
import { createSimState } from './simState.js'

const COURSE = { start: { position: [0, 0, 0], heading: 0 } }

// A sim state as the last step left it: `controls` are the merged controls
// that step ran with.
function simState({ engineOn = true, controls = {}, ...patch } = {}) {
  const state = createSimState(COURSE)
  state.truck.engineOn = engineOn
  state.frame.controls = { ...neutralControls(), ...controls }
  if (patch.speed !== undefined) state.truck.speed = patch.speed
  if (patch.forkHeight !== undefined) state.forks.height = patch.forkHeight
  if (patch.tilt !== undefined) state.forks.tilt = patch.tilt
  if (patch.failed) state.failed = true
  if (patch.carriedLoadKg !== undefined) state.hud.carriedLoadKg = patch.carriedLoadKg
  return state
}

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`)

// --- audioTargets: engine --------------------------------------------------

test('with the engine off every loop is silent', () => {
  const targets = audioTargets(simState({ engineOn: false, controls: { throttle: 1, lift: 1, direction: 'R' } }))
  assert.deepEqual(Object.keys(targets).sort(), [...LOOP_NAMES].sort())
  for (const name of LOOP_NAMES) assert.equal(targets[name].gain, 0, name)
})

test('before the first sim step there are no controls, and the loops are silent', () => {
  const state = createSimState(COURSE)
  for (const name of LOOP_NAMES) assert.equal(audioTargets(state)[name].gain, 0, name)
})

test('an idling engine plays the idle loop alone, at its recorded pitch', () => {
  const { engineIdle, engineHigh } = audioTargets(simState())
  close(engineIdle.gain, 1, 'idle gain')
  close(engineIdle.rate, 1, 'idle rate')
  close(engineHigh.gain, 0, 'high gain')
})

test('the throttle revs the engine in neutral too', () => {
  const { engineIdle, engineHigh } = audioTargets(simState({ controls: { throttle: 1, direction: 'N' } }))
  close(engineHigh.gain, 1, 'high gain')
  close(engineHigh.rate, 1, 'high rate')
  close(engineIdle.gain, 0, 'idle gain')
})

test('part throttle crossfades the two loops at one firing frequency', () => {
  const { engineIdle, engineHigh } = audioTargets(simState({ controls: { throttle: 0.5, direction: 'F' } }))
  assert.ok(engineIdle.gain > 0 && engineIdle.gain < 1)
  assert.ok(engineHigh.gain > 0 && engineHigh.gain < 1)
  // Equal power: the loudness holds across the crossfade.
  close(engineIdle.gain ** 2 + engineHigh.gain ** 2, 1, 'equal power')
  close(engineIdle.rate * SOUND_BANK.engineIdle.firingHz, engineHigh.rate * SOUND_BANK.engineHigh.firingHz, 'firing frequency')
  assert.ok(engineIdle.rate > 1 && engineHigh.rate < 1)
})

test('a failed attempt locks the controls, so the engine drops to idle', () => {
  const { engineIdle, engineHigh } = audioTargets(simState({ failed: true, controls: { throttle: 1, direction: 'F' } }))
  close(engineIdle.gain, 1, 'idle gain')
  close(engineHigh.gain, 0, 'high gain')
})

test('raising the forks loads the engine, so it revs a little without the throttle', () => {
  const { engineHigh } = audioTargets(simState({ forkHeight: 0.3, controls: { lift: 1 } }))
  assert.ok(engineHigh.gain > 0 && engineHigh.gain < 1)
})

// --- audioTargets: reverse beeper ------------------------------------------

test('the reverse beeper sounds in R with the engine on', () => {
  assert.equal(audioTargets(simState({ controls: { direction: 'R' } })).reverseBeeper.gain, 1)
  assert.equal(audioTargets(simState({ controls: { direction: 'F' } })).reverseBeeper.gain, 0)
  assert.equal(audioTargets(simState({ controls: { direction: 'N' } })).reverseBeeper.gain, 0)
  assert.equal(audioTargets(simState({ engineOn: false, controls: { direction: 'R' } })).reverseBeeper.gain, 0)
})

test('with the keyboard the beeper keeps sounding while the truck still rolls backwards', () => {
  // S released: the automatic direction reads N, but the dashboard shows R.
  assert.equal(audioTargets(simState({ speed: -0.3, controls: { direction: 'N' } })).reverseBeeper.gain, 1)
  // A real lever in N is N, whichever way the truck rolls.
  assert.equal(audioTargets(simState({ speed: -0.3, controls: { direction: 'N', explicitDirection: true } })).reverseBeeper.gain, 0)
})

// --- audioTargets: hydraulics ----------------------------------------------

test('raising the forks mid-travel runs the pump and the chain, not the relief valve', () => {
  const targets = audioTargets(simState({ forkHeight: 0.3, controls: { lift: 1 } }))
  assert.equal(targets.hydraulicWhine.gain, 1)
  assert.equal(targets.chainRattle.gain, 1)
  assert.equal(targets.reliefStrain.gain, 0)
})

test('holding the lift lever at either end stop strains the relief valve and stills the chain', () => {
  const top = audioTargets(simState({ forkHeight: FORK_MAX_HEIGHT, controls: { lift: 1 } }))
  assert.equal(top.reliefStrain.gain, 1)
  assert.equal(top.chainRattle.gain, 0)
  assert.equal(top.hydraulicWhine.gain, 1)

  const bottom = audioTargets(simState({ forkHeight: 0, controls: { lift: -1 } }))
  assert.equal(bottom.reliefStrain.gain, 1)
  assert.equal(bottom.chainRattle.gain, 0)

  // Lowering from the top, or raising from the floor, is ordinary travel.
  assert.equal(audioTargets(simState({ forkHeight: FORK_MAX_HEIGHT, controls: { lift: -1 } })).reliefStrain.gain, 0)
  assert.equal(audioTargets(simState({ forkHeight: 0, controls: { lift: 1 } })).chainRattle.gain, 1)
})

test('the hydraulic levers are analog: less lever, less sound', () => {
  const half = audioTargets(simState({ forkHeight: 0.3, controls: { lift: 0.5 } }))
  assert.equal(half.hydraulicWhine.gain, 0.5)
  assert.equal(half.chainRattle.gain, 0.5)
})

test('tilting runs the pump but not the chain', () => {
  const targets = audioTargets(simState({ controls: { tilt: -1 } }))
  assert.equal(targets.hydraulicWhine.gain, 1)
  assert.equal(targets.chainRattle.gain, 0)
  assert.equal(targets.reliefStrain.gain, 0)
  // The relief loop is the lift's: a tilt held against its stop only whines.
  const stalled = audioTargets(simState({ tilt: -TILT_BACK_MAX, controls: { tilt: -1 } }))
  assert.equal(stalled.hydraulicWhine.gain, 1)
  assert.equal(stalled.reliefStrain.gain, 0)
})

test('the hydraulics need the engine running and unlocked controls', () => {
  for (const state of [
    simState({ engineOn: false, forkHeight: 0.3, controls: { lift: 1, tilt: 1 } }),
    simState({ failed: true, forkHeight: 0.3, controls: { lift: 1, tilt: 1 } }),
  ]) {
    const targets = audioTargets(state)
    assert.equal(targets.hydraulicWhine.gain, 0)
    assert.equal(targets.chainRattle.gain, 0)
    assert.equal(targets.reliefStrain.gain, 0)
  }
})

test('the pump whine rises in pitch with the load on the forks', () => {
  const rate = (carriedLoadKg, capacityKg) =>
    audioTargets(simState({ forkHeight: 0.3, carriedLoadKg, controls: { lift: 1 } }), { capacityKg }).hydraulicWhine.rate
  assert.equal(rate(null, 1000), 1)
  assert.ok(rate(500, 1000) > 1)
  assert.ok(rate(1000, 1000) > rate(500, 1000))
  // An overload doesn't run the pitch away.
  assert.equal(rate(5000, 1000), rate(1000, 1000))
  // A course with no capacity is judged against the reference truck's.
  assert.ok(rate(1000, undefined) > 1)
})

// --- one-shots ---------------------------------------------------------------

test('sim events map to their one-shots', () => {
  assert.deepEqual(eventSounds({ type: 'engine', on: true }), ['engineStart'])
  assert.deepEqual(eventSounds({ type: 'engine', on: false }), ['engineStop'])
  assert.deepEqual(eventSounds({ type: 'engine-blocked', missing: ['seatbelt'] }), ['denied'])
  assert.deepEqual(eventSounds({ type: 'checkpoint', index: 0 }), [])
})

test('a cab switch that moved makes its sound', () => {
  const off = { key: 'off', seatbelt: false, parkingBrake: false, lights: false }
  assert.deepEqual(switchSounds(null, off), [])
  assert.deepEqual(switchSounds(off, off), [])
  assert.deepEqual(switchSounds(off, { ...off, key: 'on' }), ['keyClick'])
  assert.deepEqual(switchSounds(off, { ...off, seatbelt: true }), ['seatbelt'])
  assert.deepEqual(switchSounds({ ...off, parkingBrake: true }, off), ['parkingBrake'])
  assert.deepEqual(switchSounds(off, { ...off, lights: true }), [])
  assert.deepEqual(switchSounds(off, { key: 'on', seatbelt: true, parkingBrake: true }), ['keyClick', 'seatbelt', 'parkingBrake'])
})

// --- createDrivingAudio ------------------------------------------------------

// Stands in for lib/audio/audioEngine.js: records what it was asked to play.
function fakeEngine() {
  const engine = {
    time: 0,
    loops: {},
    shots: [],
    now: () => engine.time,
    createLoop(name) {
      const loop = { gain: 0, rate: 1, stopped: false }
      engine.loops[name] = loop
      return {
        setGain: (value) => {
          loop.gain = value
        },
        setRate: (value) => {
          loop.rate = value
        },
        stop: () => {
          loop.stopped = true
        },
      }
    },
    playOneShot(name) {
      engine.shots.push(name)
    },
  }
  return engine
}

const SWITCHES = { key: 'off', lever: null, seatbelt: false, parkingBrake: false, lights: false }

test('the driving audio opens one loop per loop sound and drives it from the state', () => {
  const engine = fakeEngine()
  const audio = createDrivingAudio(engine)
  assert.deepEqual(Object.keys(engine.loops).sort(), [...LOOP_NAMES].sort())

  audio.update(simState({ forkHeight: 0.3, controls: { lift: 1, direction: 'R' } }), SWITCHES)
  assert.equal(engine.loops.reverseBeeper.gain, 1)
  assert.equal(engine.loops.chainRattle.gain, 1)
  assert.ok(engine.loops.engineIdle.gain > 0)

  audio.update(simState({ engineOn: false }), SWITCHES)
  for (const name of LOOP_NAMES) assert.equal(engine.loops[name].gain, 0, name)
})

test('the engine loops wait for the starter before they take over', () => {
  const engine = fakeEngine()
  const audio = createDrivingAudio(engine)
  const running = simState()

  audio.handleEvent({ type: 'engine', on: true })
  assert.deepEqual(engine.shots, ['engineStart'])
  audio.update(running, SWITCHES)
  assert.equal(engine.loops.engineIdle.gain, 0)

  engine.time = SOUND_BANK.engineStart.catchAt + 0.01
  audio.update(running, SWITCHES)
  assert.equal(engine.loops.engineIdle.gain, 1)
})

test('switching off during the crank does not leave the loops waiting on the next start', () => {
  const engine = fakeEngine()
  const audio = createDrivingAudio(engine)
  audio.handleEvent({ type: 'engine', on: true })
  audio.handleEvent({ type: 'engine', on: false })
  assert.deepEqual(engine.shots, ['engineStart', 'engineStop'])
  // An engine set running directly (window.__drivingDebugSet) has no crank.
  audio.update(simState(), SWITCHES)
  assert.equal(engine.loops.engineIdle.gain, 1)
})

test('the horn, a refused start and the cab switches play their one-shots', () => {
  const engine = fakeEngine()
  const audio = createDrivingAudio(engine)
  audio.horn()
  audio.handleEvent({ type: 'engine-blocked', missing: ['seatbelt'] })
  assert.deepEqual(engine.shots, ['horn', 'denied'])

  // The switches as first seen make no sound; only a move does.
  const state = simState({ engineOn: false })
  audio.update(state, SWITCHES)
  audio.update(state, { ...SWITCHES, seatbelt: true })
  audio.update(state, { ...SWITCHES, seatbelt: true })
  assert.deepEqual(engine.shots, ['horn', 'denied', 'seatbelt'])
})

test('a caution sign chimes, a danger sounds the alarm, and an information sign is silent', () => {
  assert.deepEqual(alertSounds([{ id: 'overspeed', sound: 'cautionChime' }]), ['cautionChime'])
  assert.deepEqual(alertSounds([{ id: 'overload', sound: 'dangerAlarm' }]), ['dangerAlarm'])
  assert.deepEqual(alertSounds([{ id: 'parking-brake-on', sound: null }]), [])
  assert.deepEqual(alertSounds([]), [])
})

test('signs coming up together play only the most urgent sound', () => {
  const edges = [
    { id: 'overspeed', sound: 'cautionChime' },
    { id: 'overload', sound: 'dangerAlarm' },
    { id: 'turn-speed', sound: 'cautionChime' },
  ]
  assert.deepEqual(alertSounds(edges), ['dangerAlarm'])

  const engine = fakeEngine()
  const audio = createDrivingAudio(engine)
  audio.handleAlerts(edges)
  audio.handleAlerts([])
  assert.deepEqual(engine.shots, ['dangerAlarm'])
})

test('disposing stops every loop', () => {
  const engine = fakeEngine()
  createDrivingAudio(engine).dispose()
  for (const name of LOOP_NAMES) assert.equal(engine.loops[name].stopped, true, name)
})
