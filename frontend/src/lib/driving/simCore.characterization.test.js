import '../../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import {
  drivingScenarios,
  measuredPalletFootprint,
  runScenario,
  SCENARIO_DT,
  scenarioCourse,
} from '../../test-helpers/drivingScenarios.js'
import { traceSnapshot } from '../../test-helpers/drivingTrace.js'
import { mergeControls } from './controls.js'
import { createKeyboardSource } from './keyboardSource.js'
import { createSimCore } from './simCore.js'
import { createSimLoop } from './simLoop.js'

// Parity with the driving simulation as it was before the headless refactor.
//
// __golden__/characterization.json was recorded by running every scenario in
// test-helpers/drivingScenarios.js through the pre-refactor frame loop
// (lib/driving/step*.js at 7b5763c, which read and wrote refs and three.js
// Object3Ds) at a fixed 1/60 s. Here the same scripts drive the headless core
// through the keyboard source and the fixed-step loop, and every sampled
// frame and every event has to match.
//
// The golden file is the record of the old behaviour, so never regenerate it
// to make a failing refactor pass. When the sim is changed *on purpose* (a
// retune, the physics engine), re-record it from the new core in the same
// commit and say why:
//   RECORD_GOLDEN=1 node --test src/lib/driving/simCore.characterization.test.js

const GOLDEN_URL = new URL('./__golden__/characterization.json', import.meta.url)
const RECORD = process.env.RECORD_GOLDEN === '1'
const golden = JSON.parse(readFileSync(GOLDEN_URL, 'utf8'))
const recorded = { ...golden, scenarios: {} }
const profile = defaultVehicleProfile('en')
const TOLERANCE = 1e-6

const KEY_BY_HELD = {
  forward: 'w',
  back: 's',
  left: 'a',
  right: 'd',
  raise: 'r',
  lower: 'f',
  tiltBack: 't',
  tiltForward: 'g',
}

// The core, driven the way the viewer drives it: key events into the
// keyboard source, commands into the core, one fixed step per 1/60 s frame.
function headlessAdapter(course) {
  const core = createSimCore(course, profile, { palletFootprint: measuredPalletFootprint })
  const keyboard = createKeyboardSource()
  const loop = createSimLoop((dt) => core.step(dt, mergeControls([keyboard.read(core.state)])))
  const events = []
  let frameNo = 0

  const view = () => {
    const { state } = core
    return {
      x: state.truck.x,
      z: state.truck.z,
      heading: state.truck.heading,
      speed: state.truck.speed,
      forkHeight: state.forks.height,
      tilt: state.forks.tilt,
      steer: state.truck.steer,
      grip: state.grip,
      checkpointIndex: state.checkpointIndex,
      failed: state.failed,
      tipAngle: state.tip.angle,
      carriedIndex: state.carriedIndex,
      deliveredCount: state.deliveredCount,
      parkingStatus: state.parking.status,
      parked: state.parking.parked,
      engineOn: state.truck.engineOn,
      pallets: state.pallets.map((pallet) => ({
        state: pallet.state,
        position: pallet.position,
        rotation: pallet.rotation,
        risk: pallet.risk,
        insertDepth: pallet.grip?.insertDepth ?? null,
        landed: Boolean(pallet.landed),
      })),
      cones: state.cones,
    }
  }

  // The old recorder logged events in the viewer's own vocabulary.
  const toRecorded = (event) => {
    if (event.type === 'engine') return { type: event.on ? 'engine-on' : 'engine-off' }
    if (event.type === 'fail') return { type: 'fail', reason: event.reason }
    if (event.type === 'checkpoint') return { type: event.isLast ? 'course-complete' : 'checkpoint', id: event.checkpoint.id }
    if (event.type === 'pallet') return { ...event.event, nextState: event.nextState }
    if (event.type === 'parking') return { type: 'parking', status: event.status, isParked: event.isParked }
    return event
  }

  return {
    core,
    view,
    events,
    get frameNo() {
      return frameNo
    },
    observe: () => {
      const v = view()
      return { ...v, palletStates: v.pallets.map((pallet) => pallet.state) }
    },
    frame(keys, { engineToggle }) {
      for (const [held, key] of Object.entries(KEY_BY_HELD)) {
        if (keys[held] && !keyboard.held[held]) keyboard.keyDown(key)
        if (!keys[held] && keyboard.held[held]) keyboard.keyUp(key)
      }
      if (engineToggle) keyboard.keyDown('e')
      keyboard.drainCommands().forEach((command) => core.command(command))
      const { steps } = loop.advance(SCENARIO_DT)
      assert.equal(steps, 1, 'one fixed step per 1/60 s frame')
      for (const event of core.drainEvents()) events.push({ f: frameNo, ...toRecorded(event) })
      frameNo += 1
    },
  }
}

function assertMatches(actual, expected, path) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    assert.ok(Math.abs(actual - expected) <= TOLERANCE, `${path}: expected ${expected}, got ${actual}`)
    return
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: expected an array`)
    assert.equal(actual.length, expected.length, `${path}: length`)
    expected.forEach((item, index) => assertMatches(actual[index], item, `${path}[${index}]`))
    return
  }
  if (expected && typeof expected === 'object') {
    for (const key of Object.keys(expected)) assertMatches(actual?.[key], expected[key], `${path}.${key}`)
    return
  }
  assert.equal(actual, expected, path)
}

for (const scenario of drivingScenarios) {
  test(`parity with the pre-refactor sim: ${scenario.id}`, () => {
    const expected = golden.scenarios[scenario.id]
    if (!RECORD) assert.ok(expected, `no golden trace for ${scenario.id}`)

    const sim = headlessAdapter(scenarioCourse(scenario))
    if (scenario.setup) sim.core.debugSet(scenario.setup)
    const samples = []
    const adapter = {
      observe: sim.observe,
      frame(keys, options) {
        sim.frame(keys, options)
        if (sim.frameNo % golden.sampleEvery === 0) samples.push(traceSnapshot(sim.frameNo, sim.view()))
      },
    }
    const { frames, phaseLog } = runScenario(scenario, adapter)
    const final = traceSnapshot(frames, sim.view())

    if (RECORD) {
      recorded.scenarios[scenario.id] = { frames, phaseLog, events: sim.events, samples, final }
      return
    }
    assert.deepEqual(phaseLog, expected.phaseLog, 'the script took the same path')
    assert.equal(frames, expected.frames)
    assertMatches(sim.events, expected.events, 'events')
    assertMatches(samples, expected.samples, 'samples')
    assertMatches(final, expected.final, 'final')
  })
}

if (RECORD) {
  test('write the re-recorded golden trace', () => {
    recorded.note = `Re-recorded from the headless core on ${new Date().toISOString().slice(0, 10)}. Earlier history: ${golden.note}`
    writeFileSync(GOLDEN_URL, JSON.stringify(recorded))
  })
}
