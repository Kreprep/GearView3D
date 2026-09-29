import { test } from 'node:test'
import assert from 'node:assert/strict'
import { G, kmh } from '../driving/units.js'
import { FRICTION } from '../../data/physicsProfile.js'
import { createForkSpike, createScenarioRunner, FORK_SPIKE_SCENARIOS, HARD_BRAKE, slideThreshold } from './forkSpike.js'
import { loadRapier } from './rapier.js'

// The Phase 2 physics spike's pass criteria (docs/revisions/post-defense-plan.md,
// section 5): a seated pallet rests without jitter at full lift, slides under
// hard braking with the mast level, holds when the mast is tilted back, and a
// single-tine pickup tips it. The numbers the spike measured are in the plan.

const RAPIER = await loadRapier()
const PALLET_Z = 1
const HOLD_WINDOW_STEPS = 120 // the last 2 s of a hold

function run(id, options) {
  const spike = createForkSpike(RAPIER, options)
  const scenario = FORK_SPIKE_SCENARIOS[id]
  const runner = createScenarioRunner(spike, scenario, PALLET_Z)
  const samples = []
  while (runner.next()) samples.push({ segment: runner.segment, ...spike.palletOnForks() })
  const result = {
    samples,
    marks: runner.marks,
    end: spike.palletOnForks(),
    palletHeight: spike.palletBody.translation().y,
    forks: spike.forks,
  }
  spike.dispose()
  return result
}

const peakToPeak = (samples, axis) => {
  const values = samples.map((sample) => sample.position[axis])
  return Math.max(...values) - Math.min(...values)
}

test('Rapier loads under node --test', () => {
  assert.equal(typeof RAPIER.World, 'function')
  assert.equal(RAPIER.version(), '0.19.3', 'see the Rapier version note in the plan before changing this')
})

test('a seated pallet rests on the tines at full lift without jitter', () => {
  const { samples, end, palletHeight, forks } = run('full-lift-hold')
  assert.equal(forks.height, 0.8)
  // Carried, not left behind: the pallet's underside is a pocket's height
  // below the tine tops, 0.8 up.
  assert.ok(Math.abs(palletHeight - 0.781) < 0.002, `pallet at y ${palletHeight}`)
  const window = samples.slice(-HOLD_WINDOW_STEPS)
  for (const axis of ['x', 'y', 'z']) {
    // 1e-5 units is 0.04 mm: far below a pixel at any camera distance.
    assert.ok(peakToPeak(window, axis) < 1e-5, `${axis} jitter ${peakToPeak(window, axis)}`)
  }
  assert.ok(Math.max(...window.map((sample) => sample.relativeSpeed)) < 1e-3)
  assert.ok(end.lean < 0.002)
})

test('the pallet holds at full lift with the mast tilted back', () => {
  const { samples, marks, end } = run('tilt-back-hold')
  const window = samples.slice(-HOLD_WINDOW_STEPS)
  assert.ok(peakToPeak(window, 'z') < 1e-5, `creep ${peakToPeak(window, 'z')}`)
  // It settles back against the load backrest, never towards the tips.
  assert.ok(end.position.z <= marks.tilt.z + 1e-4)
  assert.ok(Math.abs(end.lean - 0.1933) < 0.005, `lean ${end.lean}`)
})

// Friction theory for a rigid load on level tines: while the truck brakes
// harder than mu*g the load slides, then friction stops it.
function predictedSlide(mu, speed, decel) {
  const relative = decel - mu * G
  const brakingTime = speed / decel
  const duringBraking = 0.5 * relative * brakingTime ** 2
  const slideSpeed = relative * brakingTime
  return duringBraking + slideSpeed ** 2 / (2 * mu * G)
}

test('hard braking with the mast level slides the load as friction predicts', () => {
  const { marks, end } = run('brake-level')
  const slide = end.position.z - marks.brake.z
  const predicted = predictedSlide(FRICTION.steelOnWood, kmh(10), HARD_BRAKE)
  assert.ok(HARD_BRAKE > slideThreshold(FRICTION.steelOnWood))
  assert.ok(Math.abs(slide - predicted) / predicted < 0.15, `slid ${slide}, predicted ${predicted}`)
})

// Rapier's friction lets a stuck load creep a little (about 0.0035 units,
// 1.4 cm, over a full stop). Anything under 0.01 counts as holding.
const HOLDING_CREEP = 0.01

test('the same hard braking with the mast tilted back does not slide the load', () => {
  // Tilted back 11 degrees, the load holds up to about 0.58 g: past the 0.5 g stop.
  assert.ok(HARD_BRAKE < slideThreshold(FRICTION.steelOnWood, 0.1933))
  const { marks, end } = run('brake-tilted-back')
  const slide = end.position.z - marks.brake.z
  // Rapier.js 0.20 and 0.21 fail this (about 0.029 units): a contact made
  // before the mast tilts keeps under-applying friction afterwards. See the
  // Rapier version note in the plan.
  assert.ok(slide < HOLDING_CREEP, `slid ${slide}`)
})

test('service braking with the mast level does not slide the load', () => {
  const { marks, end } = run('brake-gentle')
  assert.ok(end.position.z - marks.brake.z < HOLDING_CREEP)
})

test('a pallet lifted on one tine tips off it', () => {
  const { samples } = run('one-pocket')
  const maxLean = Math.max(...samples.map((sample) => sample.lean))
  assert.ok(maxLean > Math.PI / 4, `leaned ${(maxLean * 180) / Math.PI} degrees`)
})
