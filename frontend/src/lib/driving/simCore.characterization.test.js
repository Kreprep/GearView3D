import '../../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { drivingScenarios, runScenario, scenarioCourse } from '../../test-helpers/drivingScenarios.js'
import { createHeadlessDrive } from '../../test-helpers/headlessDrive.js'
import { traceSnapshot } from '../../test-helpers/drivingTrace.js'

// Parity with the driving simulation as last recorded.
//
// __golden__/characterization.json was first recorded by running every
// scenario in test-helpers/drivingScenarios.js through the pre-refactor frame
// loop (lib/driving/step*.js at 7b5763c, which read and wrote refs and three.js
// Object3Ds) at a fixed 1/60 s. Phase 4 changed the simulation on purpose (the
// 8FGU25 drive model in real units, the rear-wheel-steer bicycle model, the
// keyboard's virtual steering wheel, the pre-start interlock, the parking
// brake and the parking goal's brake-and-neutral check) and re-recorded it
// from the headless core; see the note in the file. Here the same scripts
// drive the core through the keyboard and dashboard sources and the
// fixed-step loop (test-helpers/headlessDrive.js), and every sampled frame
// and every event has to match.
//
// The golden file is the record of the old behaviour, so never regenerate it
// to make a failing refactor pass. When the sim is changed *on purpose* (a
// retune, the physics engine), re-record it from the new core in the same
// commit and say why, in the file's note as well as the commit:
//   RECORD_GOLDEN=1 RECORD_REASON="..." node --test src/lib/driving/simCore.characterization.test.js

const GOLDEN_URL = new URL('./__golden__/characterization.json', import.meta.url)
const RECORD = process.env.RECORD_GOLDEN === '1'
const golden = JSON.parse(readFileSync(GOLDEN_URL, 'utf8'))
const recorded = { ...golden, scenarios: {} }
const TOLERANCE = 1e-6

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

    const sim = createHeadlessDrive(scenarioCourse(scenario))
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
    assert.ok(process.env.RECORD_REASON, 'say why the trace is being re-recorded (RECORD_REASON)')
    recorded.note = `Re-recorded from the headless core on ${new Date().toISOString().slice(0, 10)}: ${process.env.RECORD_REASON} Earlier history: ${golden.note}`
    writeFileSync(GOLDEN_URL, JSON.stringify(recorded))
  })
}
