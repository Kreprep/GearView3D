import '../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FOOTPRINT, DEFAULT_VEHICLE_MODEL_URL } from '../data/vehicleProfile.js'
import { resolveVehicleProfile } from './vehicleProfile.js'

const backhoe = {
  id: 'backhoe',
  modelUrl: '/models/backhoe.glb',
  modelScale: 8,
  modelOffsetY: -0.025,
  simConfig: { hasForks: false },
}

test('forklift.glb drives as authored, with its coded footprint, whatever the row\'s scale', () => {
  const profile = resolveVehicleProfile({ id: 'forklift', modelUrl: DEFAULT_VEHICLE_MODEL_URL, modelScale: 3, modelOffsetY: 0.1 })

  assert.equal(profile.placement, null)
  assert.equal(profile.parkedPlacement, null)
  assert.deepEqual(profile.footprint, DEFAULT_FOOTPRINT)
})

test('an equipment with no model of its own falls back to forklift.glb, drawn as authored', () => {
  const profile = resolveVehicleProfile({ id: 'crane', modelUrl: '', modelScale: 4 })

  assert.equal(profile.modelUrl, DEFAULT_VEHICLE_MODEL_URL)
  assert.equal(profile.placement, null)
})

test('an equipment\'s own model takes its Equipment Settings scale and height offset', () => {
  const profile = resolveVehicleProfile(backhoe)

  assert.deepEqual(profile.placement, { scale: 8, offsetY: -0.025 })
  assert.deepEqual(profile.parkedPlacement, { scale: 8, offsetY: -0.025 })
})

test('any other model keeps only the footprint an admin set - the rest is measured', () => {
  assert.deepEqual(resolveVehicleProfile(backhoe).footprint, {})
  assert.deepEqual(
    resolveVehicleProfile({ ...backhoe, simConfig: { footprint: { halfWidth: 0.3 } } }).footprint,
    { halfWidth: 0.3 },
  )
})

test('a driving model other than the equipment\'s own does not borrow its scale', () => {
  const profile = resolveVehicleProfile({ ...backhoe, simConfig: { modelUrl: '/models/excavator.glb' } })

  assert.deepEqual(profile.placement, { scale: 1, offsetY: 0 })
})

test('a parked model is placed by its own rule, not the driven one\'s', () => {
  const profile = resolveVehicleProfile({ ...backhoe, simConfig: { parkedModelUrl: DEFAULT_VEHICLE_MODEL_URL } })

  assert.deepEqual(profile.placement, { scale: 8, offsetY: -0.025 })
  assert.equal(profile.parkedPlacement, null)
})

test('a blank, zero or negative scale reads as 1x', () => {
  for (const modelScale of [null, undefined, 0, -2, '']) {
    assert.equal(resolveVehicleProfile({ ...backhoe, modelScale }).placement.scale, 1, `modelScale ${modelScale}`)
  }
})
