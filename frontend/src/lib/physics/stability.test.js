import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STABILITY_DEFAULTS } from '../../data/vehicleProfile.js'
import { deratedCapacityKg, isOverCapacity, loadChartPoints, RATED_LOAD_CENTRE } from './loadChart.js'
import { rollRateOver, stabilityMargins, stabilityModel } from './stability.js'

const G = 9.81
const { ratedCapacityKg, ratedLoadCentre, frontOverhang, travelLoadHeight, ratingDecel, wheelbase } = STABILITY_DEFAULTS
const truck = stabilityModel()

// A load seated at the rated load centre, in the travel position.
const ratedLoad = (factor = 1, overrides = {}) => ({
  massKg: ratedCapacityKg * factor,
  forward: frontOverhang + ratedLoadCentre,
  height: travelLoadHeight,
  lateral: 0,
  ...overrides,
})
const RATING = { decel: ratingDecel * G }

// --- The rating ---------------------------------------------------------------

test('the rated load at the rated load centre is stable under the rating condition; 115% of it is not', () => {
  const rated = stabilityMargins(truck, ratedLoad(), RATING)
  assert.equal(rated.tipping, null)
  assert.ok(rated.longitudinalMargin > 0.05 && rated.longitudinalMargin < 0.15, `reserve ${rated.longitudinalMargin}`)

  const over = stabilityMargins(truck, ratedLoad(1.15), RATING)
  assert.equal(over.tipping, 'forward')
  assert.ok(over.longitudinalMargin < 0)
})

test('the centre of gravity the rating implies sits behind the middle of the wheelbase', () => {
  const share = truck.cgBehindFrontAxle / wheelbase
  assert.ok(share > 0.5 && share < 0.7, `${share}`)
})

test('standing still, the truck holds the rated load and goes over at about 1.4 times it', () => {
  assert.equal(stabilityMargins(truck, ratedLoad()).tipping, null)
  assert.ok(stabilityMargins(truck, ratedLoad()).longitudinalMargin > 0.3)
  assert.equal(stabilityMargins(truck, ratedLoad(1.3)).tipping, null)
  assert.equal(stabilityMargins(truck, ratedLoad(1.5)).tipping, 'forward')
})

test('a course that rates its truck lower gets the same margins for the same fraction of the rating', () => {
  const small = stabilityModel(1000)
  const scaled = { ...ratedLoad(), massKg: 1000 }
  const a = stabilityMargins(truck, ratedLoad(), { decel: 2, lateralAccel: 1.5 })
  const b = stabilityMargins(small, scaled, { decel: 2, lateralAccel: 1.5 })
  assert.ok(Math.abs(a.longitudinalMargin - b.longitudinalMargin) < 1e-12)
  assert.ok(Math.abs(a.lateralMargin - b.lateralMargin) < 1e-12)
})

// --- Forward -------------------------------------------------------------------

test('unladen and standing, both margins are whole', () => {
  assert.deepEqual(stabilityMargins(truck, null), {
    longitudinalMargin: 1,
    lateralMargin: 1,
    tipping: null,
    tipAcceleration: 0,
    centreOfGravityHeight: STABILITY_DEFAULTS.cgHeight,
  })
})

test('past the point of tipping the truck starts to rotate, faster the further past', () => {
  assert.equal(stabilityMargins(truck, ratedLoad()).tipAcceleration, 0)
  const forward = (factor) => stabilityMargins(truck, ratedLoad(factor)).tipAcceleration
  assert.ok(forward(1.5) > 0 && forward(2) > forward(1.5))
  const sideways = (g) => stabilityMargins(truck, null, { lateralAccel: g * G }).tipAcceleration
  assert.ok(sideways(0.9) > 0 && sideways(1.2) > sideways(0.9))
  assert.equal(sideways(0.2), 0)
})

test('the roll rate that puts a truck on its side: energy to lift its centre of gravity over the edge', () => {
  // A centre of gravity 0.45 m up and 0.6 m in from the edge rises 0.3 m to
  // get over it.
  const rate = rollRateOver(0.6, 0.45)
  const rise = Math.hypot(0.6, 0.45) - 0.45
  assert.ok(Math.abs(0.5 * (rate * Math.hypot(0.6, 0.45)) ** 2 - G * rise) < 1e-9)
  assert.ok(rate > 3 && rate < 3.5, `${rate} rad/s`)
  // A higher centre of gravity, or one nearer the edge, needs less.
  assert.ok(rollRateOver(0.6, 1.2) < rate)
  assert.ok(rollRateOver(0.3, 0.45) < rate)
  // A load carried high raises the combined centre of gravity.
  assert.ok(stabilityMargins(truck, ratedLoad(0.5, { height: 3.3 })).centreOfGravityHeight > 1)
})

test('braking, a load further out and a load further forward all cost forward stability', () => {
  const still = stabilityMargins(truck, ratedLoad(0.5)).longitudinalMargin
  assert.ok(stabilityMargins(truck, ratedLoad(0.5), { decel: 0.35 * G }).longitudinalMargin < still)
  // Out at the fork tips, the same load has twice the lever.
  assert.ok(stabilityMargins(truck, ratedLoad(0.5, { forward: frontOverhang + 2 * ratedLoadCentre })).longitudinalMargin < still)
  // Pulling away does not throw the load forward.
  assert.equal(stabilityMargins(truck, ratedLoad(0.5), { decel: -3 }).longitudinalMargin, still)
})

test('the rated load, braked at full pedal, goes over forward', () => {
  assert.equal(stabilityMargins(truck, ratedLoad(), { decel: 0.5 * G }).tipping, 'forward')
  // Half the rating rides the same stop out, as does the unladen truck.
  assert.equal(stabilityMargins(truck, ratedLoad(0.5), { decel: 0.5 * G }).tipping, null)
  assert.equal(stabilityMargins(truck, null, { decel: 0.5 * G }).tipping, null)
})

// --- Sideways -------------------------------------------------------------------

test('a left turn throws the truck to the right, and the other way about', () => {
  assert.equal(stabilityMargins(truck, null, { lateralAccel: 0.9 * G }).tipping, 'right')
  assert.equal(stabilityMargins(truck, null, { lateralAccel: -0.9 * G }).tipping, 'left')
  // Symmetric for a load on the centreline.
  const left = stabilityMargins(truck, ratedLoad(0.5), { lateralAccel: 2 }).lateralMargin
  const right = stabilityMargins(truck, ratedLoad(0.5), { lateralAccel: -2 }).lateralMargin
  assert.ok(Math.abs(left - right) < 1e-12)
})

test('a raised load tips sideways in a turn the same load rides out lowered', () => {
  const turn = { lateralAccel: 0.35 * G }
  const lowered = stabilityMargins(truck, ratedLoad(0.5), turn)
  const raised = stabilityMargins(truck, ratedLoad(0.5, { height: 3.3 }), turn)
  assert.equal(lowered.tipping, null)
  assert.ok(lowered.lateralMargin > 0.3)
  assert.equal(raised.tipping, 'right')
})

test('a load off to one side is closer to tipping that way', () => {
  const turn = { lateralAccel: 0.2 * G }
  const centred = stabilityMargins(truck, ratedLoad(0.8, { height: 2 }), turn).lateralMargin
  // Thrown right by a left turn: a load already off to the right is worse.
  assert.ok(stabilityMargins(truck, ratedLoad(0.8, { height: 2, lateral: -0.2 }), turn).lateralMargin < centred)
  assert.ok(stabilityMargins(truck, ratedLoad(0.8, { height: 2, lateral: 0.2 }), turn).lateralMargin > centred)
})

// --- The load chart --------------------------------------------------------------

test('the load chart derates by load centre, and never up-rates', () => {
  assert.equal(RATED_LOAD_CENTRE, 0.61)
  assert.equal(deratedCapacityKg(2270, 0.61), 2270)
  assert.equal(deratedCapacityKg(2270, 0.4), 2270)
  assert.ok(Math.abs(deratedCapacityKg(2270, 1.22) - 1135) < 1e-9)
  assert.ok(Math.abs(deratedCapacityKg(1000, 0.915) - 1000 * (0.61 / 0.915)) < 1e-9)
})

test('a load within the rating is over capacity once it sits far enough out', () => {
  assert.equal(isOverCapacity(500, 1000, 0.6), false)
  assert.equal(isOverCapacity(500, 1000, 1.2), false)
  assert.equal(isOverCapacity(500, 1000, 1.3), true)
  assert.equal(isOverCapacity(1500, 1000, 0.6), true)
})

test('the chart\'s points run flat to the rated centre and fall beyond it', () => {
  const points = loadChartPoints(1000, { from: 0.4, to: 1.4, steps: 10 })
  assert.equal(points.length, 11)
  assert.deepEqual([points[0].loadCentre, points[0].capacityKg], [0.4, 1000])
  assert.equal(points[2].capacityKg, 1000)
  for (let i = 3; i < points.length; i += 1) assert.ok(points[i].capacityKg < points[i - 1].capacityKg)
})
