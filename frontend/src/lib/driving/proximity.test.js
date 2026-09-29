import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import { RACK_FOOTPRINT } from '../../data/rackProfile.js'
import { CONE_RADIUS, WALL_HALF_THICKNESS } from './constants.js'
import {
  PROXIMITY_BANDS,
  PROXIMITY_RANGE,
  PROXIMITY_SECTORS,
  proximityBand,
  proximityReadout,
  proximityTelemetry,
  truckOutline,
} from './proximity.js'
import { createSimState, createSimWorld } from './simState.js'
import { m, toMetres } from './units.js'

const profile = defaultVehicleProfile('en')
const { halfWidth, halfLength } = profile.footprint
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)

// A course with the truck at the origin facing +Z. At heading 0 the
// operator's left is +X (see CLAUDE.md, CourseCanvas).
function setup(course, truck = {}) {
  const full = { start: { position: [0, 0, 0], heading: 0 }, ...course }
  const world = createSimWorld(full, profile)
  const state = createSimState(full)
  Object.assign(state.truck, truck)
  return { state, world }
}

const cone = (x, z) => ({ type: 'cone', position: [x, 0, z] })

test('every sector is empty on an open course', () => {
  const { state, world } = setup({})
  const readout = proximityReadout(state, world)
  assert.deepEqual(Object.keys(readout).sort(), [...PROXIMITY_SECTORS].sort())
  for (const sector of PROXIMITY_SECTORS) assert.equal(readout[sector], null)
})

test('a wall across the path reads in front, measured from the fork tips', () => {
  // A wall's length runs along its own forward axis; a quarter turn lays it
  // across the truck's path.
  const { state, world } = setup({ decorations: [{ type: 'wall', position: [0, 0, 1.5], rotation: Math.PI / 2, length: 3 }] })
  const readout = proximityReadout(state, world)
  close(readout.front.distance, 1.5 - WALL_HALF_THICKNESS - world.geometry.forkTipOffset)
  assert.equal(readout.front.kind, 'wall')
  assert.equal(readout.rear, null)
})

test('cones beside the truck read left and right, left being +X at heading 0', () => {
  const { state, world } = setup({ decorations: [cone(1, 0), cone(-0.7, 0.1)] })
  const readout = proximityReadout(state, world)
  close(readout.left.distance, 1 - halfWidth - CONE_RADIUS)
  close(readout.right.distance, 0.7 - halfWidth - CONE_RADIUS)
  assert.equal(readout.left.kind, 'cone')
  assert.equal(readout.front, null)
})

test('a rack behind reads rear; something off the rear quarter reads as a rear corner', () => {
  const { state, world } = setup({
    racks: [{ id: 'r1', position: [0, 0, -1.2], rotation: 0 }],
    decorations: [cone(0.6, -halfLength - 0.3), cone(-0.4, -halfLength * 0.8)],
  })
  const readout = proximityReadout(state, world)
  close(readout.rear.distance, 1.2 - RACK_FOOTPRINT.halfDepth - halfLength)
  assert.equal(readout.rear.kind, 'rack')
  // Diagonally behind on the left: nearest to the rear-left corner.
  assert.equal(readout.rearLeft.kind, 'cone')
  // Beside the rearmost quarter of the right side: tail-swing territory.
  assert.equal(readout.rearRight.kind, 'cone')
  close(readout.rearRight.distance, 0.4 - halfWidth - CONE_RADIUS)
  assert.equal(readout.right, null)
})

test('sectors turn with the truck', () => {
  // Facing +X, a cone further along +X is ahead, and +Z is on the right.
  const { state, world } = setup({ decorations: [cone(1.5, 0), cone(0, -1)] }, { heading: Math.PI / 2 })
  const readout = proximityReadout(state, world)
  close(readout.front.distance, 1.5 - world.geometry.forkTipOffset - CONE_RADIUS)
  assert.ok(readout.left)
  assert.equal(readout.right, null)
})

test('each sector keeps its nearest obstacle', () => {
  const { state, world } = setup({ decorations: [cone(0, 1.2), cone(0, 0.9), cone(0.05, 1.6)] })
  close(proximityReadout(state, world).front.distance, 0.9 - world.geometry.forkTipOffset - CONE_RADIUS)
})

test('ground pallets count, a carried one and anything out of range do not', () => {
  const course = { pallets: [{ id: 'p1', position: [0, 0, 1.2], rotation: 0 }], decorations: [cone(0, -(PROXIMITY_RANGE + halfLength + 0.5))] }
  const { state, world } = setup(course)
  const readout = proximityReadout(state, world)
  assert.equal(readout.front.kind, 'pallet')
  assert.equal(readout.rear, null)

  state.pallets[0].state = 'carried'
  assert.equal(proximityReadout(state, world).front, null)
})

test('the forks are part of the outline: something beside the tines is in front', () => {
  const { state, world } = setup({ decorations: [cone(0.3, 0.55)] })
  const { forks } = truckOutline(state, world)
  const readout = proximityReadout(state, world)
  assert.equal(readout.front.kind, 'cone')
  close(readout.front.distance, 0.3 - forks.halfX - CONE_RADIUS)
})

test('proximityBand grades a distance against the 0.5 / 1 / 2 m rings', () => {
  close(PROXIMITY_BANDS.danger, m(0.5))
  assert.equal(proximityBand(null), 'clear')
  assert.equal(proximityBand(m(0.3)), 'danger')
  assert.equal(proximityBand(m(0.8)), 'caution')
  assert.equal(proximityBand(m(1.5)), 'notice')
  assert.equal(proximityBand(m(3)), 'clear')
})

test('proximityTelemetry flattens the readout into metres for the telemetry store', () => {
  const { state, world } = setup({ decorations: [cone(1, 0)] })
  const flat = proximityTelemetry(proximityReadout(state, world))
  assert.equal(flat.proximityFront, null)
  close(flat.proximityLeft, Math.round(toMetres(1 - halfWidth - CONE_RADIUS) * 100) / 100)
  for (const value of Object.values(flat)) assert.ok(value === null || typeof value === 'number')
})
