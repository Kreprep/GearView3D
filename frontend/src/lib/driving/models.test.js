import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh } from 'three'
import { DEFAULT_FOOTPRINT } from '../../data/vehicleProfile.js'
import { fitVehicleModel } from './models.js'

// A 2 x 1 x 4 box whose centre sits at (1, 0.2, -3) in the model's own space:
// off-centre and partly below its origin, like backhoe.glb.
function offsetBoxModel() {
  const model = new Group()
  const mesh = new Mesh(new BoxGeometry(2, 1, 4))
  mesh.position.set(1, 0.2, -3)
  model.add(mesh)
  return model
}

const close = (actual, expected) => actual.forEach((value, index) => {
  assert.ok(Math.abs(value - expected[index]) < 1e-9, `${actual} vs ${expected}`)
})

test('centres the model on the vehicle origin and stands it on the floor, after scale and offset', () => {
  const fit = fitVehicleModel(offsetBoxModel(), { scale: 2, offsetY: 0.1 })

  assert.equal(fit.scale, 2)
  // Centre x 1 and z -3 move to 0; the bottom (0.2 - 0.5 = -0.3) moves to the
  // floor, then up by the offset.
  close(fit.position, [-2, 0.7, 6])
  assert.equal(fit.halfWidth, 2)
  assert.equal(fit.halfLength, 4)
})

test('measures the model as authored even once it is placed, moved and turned in a scene', () => {
  const model = offsetBoxModel()
  const vehicle = new Group()
  vehicle.position.set(5, 0, 12)
  vehicle.rotation.y = 0.9
  vehicle.add(model)

  const fit = fitVehicleModel(model, { scale: 2, offsetY: 0.1 })

  close(fit.position, [-2, 0.7, 6])
  assert.equal(fit.halfWidth, 2)
  assert.equal(fit.halfLength, 4)
})

test('forklift.glb (no placement) is drawn as authored and measures nothing', () => {
  assert.deepEqual(fitVehicleModel(offsetBoxModel(), null), { scale: 1, position: [0, 0, 0] })
})

test('a model with no meshes still gets a body to collide with', () => {
  const fit = fitVehicleModel(new Group(), { scale: 3, offsetY: 0 })

  assert.equal(fit.halfWidth, DEFAULT_FOOTPRINT.halfWidth)
  assert.equal(fit.halfLength, DEFAULT_FOOTPRINT.halfLength)
})
