import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, Vector3 } from 'three'
import { FRICTION, TINE_HEEL_Z, TINE_REST_Y, WOODEN_PALLET, palletPhysics } from '../../data/physicsProfile.js'
import { RACK_LEVEL_HEIGHTS } from '../../data/rackProfile.js'
import { forkPose } from '../driving/forkPose.js'
import { FORKLIFT_RIG_GEOMETRY } from '../driving/rigGeometry.js'
import { SIM_DT } from '../driving/simLoop.js'
import { truckPoses } from '../driving/stepPhysics.js'
import { truckFeet } from './colliders.js'
import { G, kmh, m, mps2, toMetres } from '../driving/units.js'
import { loadRapier } from './rapier.js'
import { rollRateOver } from './stability.js'
import { createPhysicsWorld } from './world.js'

// The physics world on its own: a truck that is only a pose, moved by a
// script, and what the pallets do on its forks. These are the Phase 2
// spike's pass criteria (docs/revisions/post-defense-plan.md, section 5),
// moved onto the world the simulation uses: a seated pallet rests without
// jitter at full lift, slides under hard braking with the mast level, holds
// when the mast is tilted back, and a single-tine pickup tips it. The
// simulation's own scenarios, driven through the keyboard, are in
// lib/driving/physicsScenarios.test.js.

const RAPIER = await loadRapier()
const geometry = FORKLIFT_RIG_GEOMETRY
const PALLET_Z = 1
const PALLET = { id: 'test', position: [0, 0, PALLET_Z], rotation: 0, weightKg: 500 }
const HOLD_WINDOW_STEPS = 120 // the last 2 s of a hold

const FULL_LIFT = 0.8
const TRAVEL_HEIGHT = m(0.2)
const TILT_BACK_MAX = -0.192 // 11 degrees, the 8FGU25's back tilt
const LIFT_SPEED = m(0.6) // per second
const LIFT_RAMP = LIFT_SPEED / 0.2 // the valve's ramp (stepForks.js)
const TILT_SPEED = 0.1 // rad per second
const TRAVEL_SPEED = kmh(10)
const HARD_BRAKE = mps2(0.5 * 9.81)
const GENTLE_BRAKE = mps2(0.25 * 9.81)

// Truck z at which the tine heels are just short of the pallet's near face.
const seatedTruckZ = PALLET_Z - palletPhysics(PALLET).footprint.halfDepth - 0.004 - TINE_HEEL_Z

// A scenario is a list of segments. Each runs until its `until` holds or its
// `duration` passes, applying rates to the truck and forks: `speed` sets the
// truck's speed outright, `accel` changes it, `lift` and `tiltRate` move the
// forks. `mark` names the moment a segment starts, to measure from.
const insertAndLift = (height) => [
  { label: 'settle', duration: 0.5 },
  { label: 'insert', speed: 0.1, until: (s) => s.truck.z >= seatedTruckZ },
  { label: 'lift', speed: 0, lift: LIFT_SPEED, until: (s) => s.forks.height >= height },
  { label: 'ease', duration: 0.3 },
]

const brakeTest = ({ tilt, decel }) => [
  ...insertAndLift(TRAVEL_HEIGHT),
  ...(tilt ? [{ label: 'tilt', tiltRate: -TILT_SPEED, until: (s) => s.forks.tilt <= tilt }] : []),
  { label: 'accelerate', accel: mps2(1), until: (s) => s.speed >= TRAVEL_SPEED },
  { label: 'cruise', accel: 0, duration: 0.5 },
  { label: 'brake', mark: 'brake', accel: -decel, until: (s) => s.speed <= 0 },
  { label: 'stopped', speed: 0, duration: 1.5 },
]

const SCENARIOS = {
  'full-lift-hold': { segments: [...insertAndLift(FULL_LIFT), { label: 'hold', duration: 3 }] },
  'tilt-back-hold': {
    segments: [
      ...insertAndLift(FULL_LIFT),
      { label: 'tilt', mark: 'tilt', tiltRate: -TILT_SPEED, until: (s) => s.forks.tilt <= TILT_BACK_MAX },
      { label: 'hold', duration: 3 },
    ],
  },
  'brake-level': { segments: brakeTest({ tilt: 0, decel: HARD_BRAKE }) },
  'brake-tilted-back': { segments: brakeTest({ tilt: TILT_BACK_MAX, decel: HARD_BRAKE }) },
  'brake-gentle': { segments: brakeTest({ tilt: 0, decel: GENTLE_BRAKE }) },
  // Shifted so the left tine is in the right-hand pocket and the right tine
  // clears the pallet's edge.
  'one-pocket': { truckX: -0.105, segments: [...insertAndLift(m(1.2)), { label: 'hold', duration: 2 }] },
}

const carriageInverse = new Matrix4()
const local = new Vector3()

function run(id, { scene = {}, options } = {}) {
  const scenario = SCENARIOS[id]
  const state = {
    truck: { x: scenario.truckX ?? 0, y: 0, z: 0, heading: 0 },
    forks: { height: 0, tilt: 0 },
    tip: { angle: 0 },
    speed: 0,
    liftRate: 0,
  }
  const physics = createPhysicsWorld(
    RAPIER,
    {
      footprint: { halfWidth: 0.15, halfLength: 0.29 },
      mastFoot: geometry.mastFoot,
      pallets: [{ def: PALLET, x: 0, z: PALLET_Z, rotation: 0 }],
      cones: [],
      racks: [],
      walls: [],
      vehicles: [],
      ...scene,
    },
    truckPoses(state, geometry),
    options,
  )
  const { body } = physics.pallets[0]

  // The pallet in the carriage's frame: what "resting on the forks" means,
  // wherever the truck is.
  const onForks = () => {
    carriageInverse.copy(forkPose(state, geometry)).invert()
    const { x, y, z } = local.copy(body.translation()).applyMatrix4(carriageInverse)
    const rotation = body.rotation()
    return { x, y, z, lean: Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (rotation.x ** 2 + rotation.z ** 2)))) }
  }

  const samples = []
  const marks = {}
  for (const segment of scenario.segments) {
    if (segment.mark) marks[segment.mark] = onForks()
    if ('speed' in segment) state.speed = segment.speed
    for (let time = 0; time < (segment.duration ?? 20); time += SIM_DT) {
      if (segment.until?.(state)) break
      state.speed = Math.max(0, state.speed + (segment.accel ?? 0) * SIM_DT)
      state.truck.z += state.speed * SIM_DT
      // The lift ramps, as stepForks' does.
      const wanted = segment.lift ?? 0
      state.liftRate = wanted > state.liftRate ? Math.min(state.liftRate + LIFT_RAMP * SIM_DT, wanted) : Math.max(state.liftRate - LIFT_RAMP * SIM_DT, wanted)
      state.forks.height = Math.min(FULL_LIFT, state.forks.height + state.liftRate * SIM_DT)
      state.forks.tilt += (segment.tiltRate ?? 0) * SIM_DT
      physics.step(truckPoses(state, geometry))
      samples.push(onForks())
    }
  }

  const result = { samples, marks, end: onForks(), palletHeight: body.translation().y, contacts: physics.contacts(), state }
  physics.dispose()
  return result
}

const peakToPeak = (samples, axis) => {
  const values = samples.map((sample) => sample[axis])
  return Math.max(...values) - Math.min(...values)
}

test('Rapier loads under node --test', () => {
  assert.equal(typeof RAPIER.World, 'function')
  assert.equal(RAPIER.version(), '0.19.3', 'see the Rapier version note in the plan before changing this')
})

test('a seated pallet rests on the tines at full lift without jitter', () => {
  const { samples, end, palletHeight, state } = run('full-lift-hold')
  assert.ok(Math.abs(state.forks.height - FULL_LIFT) < 1e-9)
  // Carried, not left behind: the pallet's underside is a pocket's height
  // below the tine tops.
  const expected = FULL_LIFT + TINE_REST_Y + 0.011 - 0.03
  assert.ok(Math.abs(palletHeight - expected) < 0.002, `pallet at y ${palletHeight}, expected ${expected}`)
  const window = samples.slice(-HOLD_WINDOW_STEPS)
  for (const axis of ['x', 'y', 'z']) {
    // 1e-5 units is 0.04 mm: far below a pixel at any camera distance.
    assert.ok(peakToPeak(window, axis) < 1e-5, `${axis} jitter ${peakToPeak(window, axis)}`)
  }
  assert.ok(end.lean < 0.002)
})

test('the pallet holds at full lift with the mast tilted back', () => {
  const { samples, marks, end } = run('tilt-back-hold')
  const window = samples.slice(-HOLD_WINDOW_STEPS)
  assert.ok(peakToPeak(window, 'z') < 1e-5, `creep ${peakToPeak(window, 'z')}`)
  // It settles back against the load backrest, never towards the tips.
  assert.ok(end.z <= marks.tilt.z + 1e-4)
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

// Friction-limited deceleration: a load on tines tilted back by `backTilt`
// (radians) starts to slide forward above this, in scene units.
function slideThreshold(mu, backTilt = 0) {
  const tan = Math.tan(backTilt)
  return (G * (mu + tan)) / (1 - mu * tan)
}

test('hard braking with the mast level slides the load as friction predicts', () => {
  const { marks, end } = run('brake-level')
  const slide = end.z - marks.brake.z
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
  const slide = end.z - marks.brake.z
  // Rapier.js 0.20 and 0.21 fail this (about 0.029 units): a contact made
  // before the mast tilts keeps under-applying friction afterwards. See the
  // Rapier version note in the plan.
  assert.ok(slide < HOLDING_CREEP, `slid ${slide}`)
})

test('a seated load survives gentle braking', () => {
  const { marks, end } = run('brake-gentle')
  assert.ok(end.z - marks.brake.z < HOLDING_CREEP)
})

test('a pallet lifted on one tine tips off it', () => {
  const { samples } = run('one-pocket')
  const maxLean = Math.max(...samples.map((sample) => sample.lean))
  assert.ok(maxLean > Math.PI / 4, `leaned ${(maxLean * 180) / Math.PI} degrees`)
})

// --- What the world reports ------------------------------------------------

const kinds = (contacts) => new Set(contacts.map(({ a, b }) => `${a.kind}>${b.kind}`))

test('contacts() says a carried pallet is on the tines and nothing else', () => {
  const { contacts } = run('full-lift-hold')
  assert.deepEqual([...kinds(contacts)], ['tine>pallet'])
  // The normal points from the tine toward the pallet: up.
  assert.ok(contacts.every(({ ny }) => ny > 0.99))
})

test('a pallet left alone reports the floor under it', () => {
  const physics = createPhysicsWorld(
    RAPIER,
    { footprint: { halfWidth: 0.15, halfLength: 0.29 }, mastFoot: geometry.mastFoot, pallets: [{ def: PALLET, x: 0, z: 3, rotation: 0 }], cones: [{ x: 1, z: 3 }], racks: [], walls: [], vehicles: [] },
    truckPoses({ truck: { x: 0, y: 0, z: 0, heading: 0 }, forks: { height: 0, tilt: 0 }, tip: { angle: 0 } }, geometry),
  )
  const still = truckPoses({ truck: { x: 0, y: 0, z: 0, heading: 0 }, forks: { height: 0, tilt: 0 }, tip: { angle: 0 } }, geometry)
  for (let step = 0; step < 120; step += 1) physics.step(still)
  const contacts = physics.contacts()
  assert.deepEqual([...kinds(contacts)], ['pallet>floor'])
  // From the pallet toward the floor: down.
  assert.ok(contacts.every(({ ny }) => ny < -0.99))
  // It has not moved, and neither has the cone standing beside it.
  assert.ok(Math.abs(physics.pallets[0].body.translation().y) < 0.001)
  const cone = physics.cones[0].body.translation()
  assert.ok(Math.hypot(cone.x - 1, cone.z - 3) < 1e-4 && Math.abs(cone.y) < 0.001, `cone at ${cone.x}, ${cone.y}, ${cone.z}`)
  physics.dispose()
})

test('the body of the truck knocks a cone over and reports touching it', () => {
  const at = (z) => truckPoses({ truck: { x: 0, y: 0, z, heading: 0 }, forks: { height: 0.3, tilt: 0 }, tip: { angle: 0 } }, geometry)
  const physics = createPhysicsWorld(
    RAPIER,
    { footprint: { halfWidth: 0.15, halfLength: 0.29 }, mastFoot: geometry.mastFoot, pallets: [], cones: [{ x: 0.1, z: 1 }], racks: [], walls: [], vehicles: [] },
    at(0),
  )
  const { body } = physics.cones[0]
  let touched = false
  // Eight kilometres an hour, straight at it, forks up out of the way.
  for (let z = 0; z < 1.2; z += kmh(8) * SIM_DT) {
    physics.step(at(z))
    touched ||= physics.contacts().some(({ a, b }) => a.kind === 'chassis' && b.kind === 'cone')
  }
  assert.ok(touched)
  const { z } = body.translation()
  assert.ok(z > 1.3, `cone at z ${z}`)
  physics.dispose()
})

// --- A truck that has gone over ---------------------------------------------

// A truck standing at the origin, released as a dynamic body turning at
// `rate` rad/s about its right-hand edge. Returns how far off upright it is
// after three seconds.
function releasedTruck(rate) {
  const standing = { truck: { x: 0, y: 0, z: 0, heading: 0 }, forks: { height: 0.1, tilt: 0 }, tip: { pose: null } }
  const physics = createPhysicsWorld(
    RAPIER,
    { footprint: { halfWidth: 0.15, halfLength: 0.29 }, mastFoot: geometry.mastFoot, feet: truckFeet(geometry), pallets: [], cones: [], racks: [], walls: [], vehicles: [] },
    truckPoses(standing, geometry),
  )
  assert.equal(physics.fallenTruck(), null)
  // The right-hand side of the stability triangle, pointing forward: a
  // positive turn about it lays the truck onto its right side (-X).
  const edge = new Vector3(-geometry.frontTrackHalf, 0, geometry.frontAxleZ - geometry.rearAxleZ).normalize()
  const centreOfMass = [0, 0.1125, geometry.frontAxleZ - 0.243]
  const angvel = edge.clone().multiplyScalar(rate)
  const about = new Vector3(0, 0, geometry.rearAxleZ)
  physics.releaseTruck({
    massKg: 3560,
    centreOfMass,
    inertia: [500, 500, 300],
    carriage: { position: new Vector3(...geometry.mastFoot).setY(geometry.mastFoot[1] + 0.1), quaternion: { x: 0, y: 0, z: 0, w: 1 } },
    linvel: angvel.clone().cross(new Vector3(...centreOfMass).sub(about)),
    angvel,
    tip: { angvel, about },
  })
  for (let step = 0; step < 180; step += 1) physics.step(truckPoses(standing, geometry))
  const { position, quaternion } = physics.fallenTruck()
  const lean = new Vector3(0, 1, 0).angleTo(new Vector3(0, 1, 0).applyQuaternion(quaternion))
  const kinds = new Set(physics.contacts().map(({ a, b }) => `${a.kind}>${b.kind}`))
  physics.dispose()
  return { lean, position, kinds }
}

test('a released truck stands on its three feet', () => {
  const { lean, position, kinds } = releasedTruck(0)
  assert.ok(lean < 0.01, `leaning ${lean}`)
  assert.ok(Math.abs(position.y) < 0.002 && Math.hypot(position.x, position.z) < 0.01)
  assert.deepEqual([...kinds], ['wheel>floor'])
})

test('a released truck rocked a little drops back onto its wheels; rocked hard it ends on its side', () => {
  assert.ok(releasedTruck(0.6).lean < 0.02)
  const over = releasedTruck(rollRateOver(toMetres(0.15), toMetres(0.1125)) * 1.1)
  assert.ok(Math.abs(over.lean - Math.PI / 2) < 0.1, `lean ${over.lean}`)
  // Onto its right side, the body on the floor.
  assert.ok(over.kinds.has('chassis>floor'))
})

test('a pallet set on a rack rests on its decking and reports the shelf', () => {
  const height = RACK_LEVEL_HEIGHTS.middle
  const physics = createPhysicsWorld(
    RAPIER,
    {
      footprint: { halfWidth: 0.15, halfLength: 0.29 },
      mastFoot: geometry.mastFoot,
      pallets: [{ def: PALLET, x: 0, z: 5, rotation: 0 }],
      cones: [],
      racks: [{ id: 'rack-a', x: 0, z: 5, rotation: 0 }],
      walls: [],
      vehicles: [],
    },
    truckPoses({ truck: { x: 0, y: 0, z: 0, heading: 0 }, forks: { height: 0, tilt: 0 }, tip: { angle: 0 } }, geometry),
  )
  const still = truckPoses({ truck: { x: 0, y: 0, z: 0, heading: 0 }, forks: { height: 0, tilt: 0 }, tip: { angle: 0 } }, geometry)
  const { body } = physics.pallets[0]
  body.setTranslation({ x: 0, y: height + 0.01, z: 5 }, true)
  for (let step = 0; step < 120; step += 1) physics.step(still)
  assert.ok(Math.abs(body.translation().y - height) < 0.002, `resting at ${body.translation().y}, shelf at ${height}`)
  const shelf = physics.contacts().find(({ b }) => b.kind === 'rack')
  assert.deepEqual({ id: shelf.b.id, level: shelf.b.level }, { id: 'rack-a', level: 'middle' })
  assert.equal(WOODEN_PALLET.load.half.length, 3)
  physics.dispose()
})
