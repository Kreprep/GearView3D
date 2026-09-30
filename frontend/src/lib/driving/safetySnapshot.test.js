import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RACK_FOOTPRINT, RACK_LEVEL_HEIGHTS } from '../../data/rackProfile.js'
import { LOOK_AHEAD_HALF_ANGLE, PATH_MARGIN } from '../../data/safetyThresholds.js'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import { GLANCE_YAW, glanceTargetYaw } from './cameraModes.js'
import { CONE_RADIUS, MAX_STEER_ANGLE, WALL_HALF_THICKNESS } from './constants.js'
import { neutralControls } from './controls.js'
import { pathClearance } from './proximity.js'
import { buildSafetySnapshot } from './safetySnapshot.js'
import { createSimState, createSimWorld } from './simState.js'
import { kmh } from './units.js'

const profile = defaultVehicleProfile('en')
const { halfWidth, halfLength } = profile.footprint
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)

// A course with the truck at the origin facing +Z; at heading 0 the
// operator's left is +X.
function setup(course = {}, { truck = {}, controls = {} } = {}) {
  const full = { start: { position: [0, 0, 0], heading: 0 }, ...course }
  const world = createSimWorld(full, profile)
  const state = createSimState(full)
  Object.assign(state.truck, truck)
  state.frame.controls = { ...neutralControls(), ...controls }
  return { state, world }
}

const SEATED = { firstPerson: true, lookYaw: 0 }
const snapshotOf = ({ state, world }, options = {}) => buildSafetySnapshot(state, world, { view: SEATED, speedLimitKmh: 8, ...options })

const cone = (x, z) => ({ type: 'cone', position: [x, 0, z] })
const wallAcross = (z) => ({ type: 'wall', position: [0, 0, z], rotation: Math.PI / 2, length: 3 })
const rack = (z, id = 'rack-1') => ({ id, position: [0, 0, z], rotation: 0 })

// --- pathClearance -----------------------------------------------------------

test('the path ahead is measured from the fork tips, the path behind from the body', () => {
  const sim = setup({ decorations: [wallAcross(3), wallAcross(-3)] })
  const ahead = pathClearance(sim.state, sim.world, 1)
  close(ahead.distance, 3 - WALL_HALF_THICKNESS - sim.world.geometry.forkTipOffset)
  assert.equal(ahead.kind, 'wall')
  close(pathClearance(sim.state, sim.world, -1).distance, 3 - WALL_HALF_THICKNESS - halfLength)
})

test('a cone beside the lane is not in the path; one in it is', () => {
  const beside = setup({ decorations: [cone(halfWidth + CONE_RADIUS + 0.2, 2)] })
  assert.equal(pathClearance(beside.state, beside.world, 1, PATH_MARGIN), null)

  const inLane = setup({ decorations: [cone(0.05, 2)] })
  close(pathClearance(inLane.state, inLane.world, 1, PATH_MARGIN).distance, 2 - CONE_RADIUS - inLane.world.geometry.forkTipOffset)
  assert.equal(pathClearance(inLane.state, inLane.world, -1, PATH_MARGIN), null)
})

test('the path follows the truck’s heading', () => {
  // Facing +X: a cone out along +X is ahead, one along +Z is not.
  const sim = setup({ decorations: [cone(2, 0), cone(0, 2)] }, { truck: { heading: Math.PI / 2 } })
  close(pathClearance(sim.state, sim.world, 1).distance, 2 - CONE_RADIUS - sim.world.geometry.forkTipOffset)
})

test('a pallet on the floor ahead is where the forks go, not an obstacle; behind, it is', () => {
  const ahead = setup({ pallets: [{ id: 'p', position: [0, 0, 2], rotation: 0 }] })
  assert.equal(pathClearance(ahead.state, ahead.world, 1), null)

  const behind = setup({ pallets: [{ id: 'p', position: [0, 0, -2], rotation: 0 }] })
  const clearance = pathClearance(behind.state, behind.world, -1)
  assert.equal(clearance.kind, 'pallet')
  close(clearance.distance, 2 - behind.state.pallets[0].footprint.halfDepth - halfLength)
})

test('racking ahead is measured from the truck body, since the forks reach into a bay', () => {
  const sim = setup({ racks: [rack(3)] })
  const clearance = pathClearance(sim.state, sim.world, 1)
  assert.equal(clearance.kind, 'rack')
  close(clearance.distance, 3 - RACK_FOOTPRINT.halfDepth - halfLength)
})

test('the rack the carried pallet is going to is not an obstacle ahead; any other rack is', () => {
  const course = {
    racks: [rack(3, 'target'), rack(6, 'other')],
    pallets: [{ id: 'p', position: [0, 0, 0.5], rotation: 0, targetRack: 'target', targetLevel: 'middle' }],
  }
  const sim = setup(course)
  assert.equal(pathClearance(sim.state, sim.world, 1).distance < 3, true)

  sim.state.pallets[0].state = 'carried'
  sim.state.carriedIndex = 0
  const carrying = pathClearance(sim.state, sim.world, 1)
  close(carrying.distance, 6 - RACK_FOOTPRINT.halfDepth - halfLength)
})

// --- buildSafetySnapshot -----------------------------------------------------

test('a fresh attempt reads as stopped, engine off, nothing near, nothing asked for', () => {
  const s = snapshotOf(setup())
  assert.equal(s.live, true)
  assert.equal(s.engineOn, false)
  assert.equal(s.speed, 0)
  assert.equal(s.lever, null)
  assert.deepEqual(s.interlockMissing, [])
  assert.deepEqual([s.ahead, s.behind, s.rearLeft, s.rearRight], [null, null, null, null])
  assert.deepEqual([s.carrying, s.loadLanded, s.overCapacity, s.atStack], [false, false, false, false])
  close(s.speedLimit, kmh(8))
  assert.equal(s.speedLimitKmh, 8)
})

test('a failed attempt is not live', () => {
  const sim = setup()
  sim.state.failed = true
  assert.equal(snapshotOf(sim).live, false)
})

test('what a refused start still wants is listed until the engine starts', () => {
  const sim = setup({}, { controls: { seatbelt: true } })
  assert.deepEqual(snapshotOf(sim).interlockMissing, [])
  // The core refused a start.
  sim.state.interlock = { missing: ['seatbelt', 'parkingBrake'], at: 0 }
  assert.deepEqual(snapshotOf(sim).interlockMissing, ['parkingBrake'])
  sim.state.frame.controls.parkingBrake = true
  assert.deepEqual(snapshotOf(sim).interlockMissing, [])
  sim.state.frame.controls.parkingBrake = false
  sim.state.truck.engineOn = true
  assert.deepEqual(snapshotOf(sim).interlockMissing, [])
})

test('only a lever the operator set counts as the lever', () => {
  assert.equal(snapshotOf(setup({}, { controls: { direction: 'F' } })).lever, null)
  assert.equal(snapshotOf(setup({}, { controls: { direction: 'R', explicitDirection: true } })).lever, 'R')
})

test('steer is the rear wheels as a fraction of lock, and yaw the way the truck turns', () => {
  // Steering left turns the rear wheels the other way (STEER_SIGN).
  const left = snapshotOf(setup({}, { truck: { speed: 0.3, steer: -MAX_STEER_ANGLE / 2 } }))
  close(left.steer, 0.5)
  assert.equal(left.yaw, 1)
  // The same wheels in reverse turn the truck the other way.
  assert.equal(snapshotOf(setup({}, { truck: { speed: -0.3, steer: -MAX_STEER_ANGLE / 2 } })).yaw, -1)
  assert.equal(snapshotOf(setup({}, { truck: { speed: 0, steer: -MAX_STEER_ANGLE / 2 } })).yaw === 0, true)
})

test('steerRate is how fast the steering input moved since the previous snapshot', () => {
  const sim = setup({}, { controls: { steer: 0.2 } })
  const first = snapshotOf(sim)
  assert.equal(first.steerRate, 0)
  sim.state.time = 0.1
  sim.state.frame.controls.steer = 0.5
  close(snapshotOf(sim, { previous: first }).steerRate, 3)
})

test('the rear corners come from the proximity readout', () => {
  const s = snapshotOf(setup({ decorations: [cone(halfWidth + 0.1, -halfLength + 0.02)] }))
  close(s.rearLeft, 0.1 - CONE_RADIUS)
  assert.equal(s.rearRight, null)
})

test('a pallet over the rated capacity counts once the forks are in it, or carrying it', () => {
  const course = { capacityKg: 1000, pallets: [{ id: 'heavy', position: [0, 0, 1], rotation: 0, weightKg: 1500 }] }
  const sim = setup(course)
  assert.equal(snapshotOf(sim).overCapacity, false)
  sim.state.pallets[0].engaged = true
  assert.equal(snapshotOf(sim).overCapacity, true)

  const light = setup({ ...course, pallets: [{ ...course.pallets[0], weightKg: 800 }] })
  light.state.pallets[0].engaged = true
  assert.equal(snapshotOf(light).overCapacity, false)
  // A course with no rated capacity has nothing to be over.
  const unrated = setup({ pallets: course.pallets })
  unrated.state.pallets[0].engaged = true
  assert.equal(snapshotOf(unrated).overCapacity, false)
})

test('carrying and landed follow the carried pallet', () => {
  const sim = setup({ pallets: [{ id: 'p', position: [0, 0, 1], rotation: 0 }] })
  sim.state.pallets[0].state = 'carried'
  sim.state.carriedIndex = 0
  assert.deepEqual([snapshotOf(sim).carrying, snapshotOf(sim).loadLanded], [true, false])
  sim.state.pallets[0].landed = true
  assert.equal(snapshotOf(sim).loadLanded, true)
})

test('a landed load is at its destination in the drop zone or on its target shelf, nowhere else', () => {
  const pallets = [{ id: 'p1', position: [0, 0, 2], rotation: 0, weightKg: 400, targetRack: 'rack-1', targetLevel: 'middle' }]
  const course = { pallets, racks: [rack(6)], dropZone: { position: [0, 0, 2], radius: 0.5 } }
  const carry = (patch, truck = {}) => {
    const sim = setup(course, { truck })
    sim.state.carriedIndex = 0
    Object.assign(sim.state.pallets[0], { state: 'carried', landed: true, restY: 0 }, patch)
    return snapshotOf(sim).loadAtDestination
  }
  // On the floor inside the zone; still in the air; on the floor outside it.
  assert.equal(carry({}), true)
  assert.equal(carry({ landed: false }), false)
  const outside = setup(course)
  outside.state.carriedIndex = 0
  Object.assign(outside.state.pallets[0], { state: 'carried', landed: true, restY: 0 })
  outside.state.pallets[0].position.set(3, 0, 2)
  assert.equal(snapshotOf(outside).loadAtDestination, false)

  // On the target shelf, the fork tips in the rack's bay; on another shelf.
  const atFace = { z: 6 - RACK_FOOTPRINT.halfDepth - halfLength - 0.05 }
  const shelf = (restY) => {
    const sim = setup(course, { truck: atFace })
    sim.state.carriedIndex = 0
    Object.assign(sim.state.pallets[0], { state: 'carried', landed: true, restY })
    sim.state.pallets[0].position.set(0, restY, 6)
    return snapshotOf(sim).loadAtDestination
  }
  assert.equal(shelf(RACK_LEVEL_HEIGHTS.middle), true)
  assert.equal(shelf(RACK_LEVEL_HEIGHTS.bottom), false)
  // No load at all.
  assert.equal(snapshotOf(setup(course)).loadAtDestination, false)
})

test('the forks are at the stack while their tips are in a rack’s bay, laden or not', () => {
  const course = { racks: [rack(5)] }
  assert.equal(snapshotOf(setup(course)).atStack, false)
  // Body stopped at the rack's face: the tips are inside the bay.
  const atFace = setup(course, { truck: { z: 5 - RACK_FOOTPRINT.halfDepth - halfLength - 0.05 } })
  assert.equal(snapshotOf(atFace).atStack, true)
  // Off to one side of the centre bay.
  const beside = setup(course, { truck: { x: 0.6, z: 5 - RACK_FOOTPRINT.halfDepth - halfLength - 0.05 } })
  assert.equal(snapshotOf(beside).atStack, false)
})

test('lookingAhead is only judged in first-person, and a side glance counts as looking round', () => {
  const sim = setup()
  const looking = (view) => snapshotOf(sim, { view }).lookingAhead
  assert.equal(looking({ firstPerson: false, lookYaw: 0 }), null)
  assert.equal(looking({ firstPerson: true, lookYaw: 0 }), true)
  assert.equal(looking({ firstPerson: true, lookYaw: LOOK_AHEAD_HALF_ANGLE / 2 }), true)
  assert.equal(looking({ firstPerson: true, lookYaw: Math.PI }), false)
  // The D-pad's glances, as the camera computes them from any starting yaw.
  for (const glance of ['left', 'right', 'behind']) {
    for (const from of [0, 0.3, -2, 5]) {
      assert.equal(looking({ firstPerson: true, lookYaw: glanceTargetYaw(glance, from) }), false, `${glance} from ${from}`)
    }
  }
  assert.equal(looking({ firstPerson: true, lookYaw: GLANCE_YAW.ahead }), true)
  // A full turn round is ahead again.
  assert.equal(looking({ firstPerson: true, lookYaw: 2 * Math.PI + 0.1 }), true)
})

test('building a snapshot leaves the simulation state untouched', () => {
  const sim = setup(
    { decorations: [cone(0, 2), wallAcross(-3)], racks: [rack(6)], pallets: [{ id: 'p', position: [1, 0, 1], rotation: 0 }] },
    { truck: { speed: 0.4, steer: 0.3 }, controls: { throttle: 1, direction: 'F' } },
  )
  const before = JSON.stringify(sim.state)
  snapshotOf(sim)
  assert.equal(JSON.stringify(sim.state), before)
})
