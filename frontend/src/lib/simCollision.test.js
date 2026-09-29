import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closestPointOnOrientedRect, rectRectClosest, rectRectDistance } from './simCollision.js'

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
const rect = (x, z, halfX, halfZ, rotation = 0) => ({ x, z, rotation, halfX, halfZ })

test('closestPointOnOrientedRect clamps an outside point onto the surface and keeps an inside one', () => {
  const box = rect(0, 0, 1, 2)
  assert.deepEqual(closestPointOnOrientedRect(3, 0, box), { x: 1, z: 0 })
  assert.deepEqual(closestPointOnOrientedRect(3, 5, box), { x: 1, z: 2 })
  assert.deepEqual(closestPointOnOrientedRect(0.5, -1, box), { x: 0.5, z: -1 })

  // Rotated a quarter turn, the long axis lies along X.
  const turned = closestPointOnOrientedRect(0, 3, rect(0, 0, 1, 2, Math.PI / 2))
  close(turned.x, 0)
  close(turned.z, 1)
})

test('rectRectDistance is the gap between two axis-aligned boxes', () => {
  close(rectRectDistance(rect(0, 0, 1, 1), rect(3, 0, 1, 1)), 1)
  close(rectRectDistance(rect(0, 0, 1, 1), rect(0, -4.5, 1, 1)), 2.5)
  // Diagonal: corner to corner.
  close(rectRectDistance(rect(0, 0, 1, 1), rect(3, 3, 1, 1)), Math.SQRT2)
})

test('rectRectDistance is zero for touching or overlapping boxes', () => {
  assert.equal(rectRectDistance(rect(0, 0, 1, 1), rect(2, 0, 1, 1)), 0)
  assert.equal(rectRectDistance(rect(0, 0, 1, 1), rect(0.5, 0.5, 1, 1)), 0)
  assert.equal(rectRectDistance(rect(0, 0, 1, 1), rect(0, 0, 0.2, 0.2)), 0)
})

test('rectRectDistance handles rotated boxes, corner against face', () => {
  // A unit box turned 45 degrees points a corner at the other box's face:
  // the corner reaches sqrt(2) from its centre.
  close(rectRectDistance(rect(0, 0, 1, 1), rect(4, 0, 1, 1, Math.PI / 4)), 3 - Math.SQRT2)
  // And the same the other way round.
  close(rectRectDistance(rect(4, 0, 1, 1, Math.PI / 4), rect(0, 0, 1, 1)), 3 - Math.SQRT2)
})

test('rectRectDistance is symmetric for arbitrary rotations', () => {
  const a = rect(0.3, -0.2, 0.15, 0.29, 0.7)
  const b = rect(1.1, 0.9, 0.4, 0.05, -1.2)
  close(rectRectDistance(a, b), rectRectDistance(b, a), 1e-12)
  assert.ok(rectRectDistance(a, b) > 0)
})

test('rectRectClosest returns the nearest point on the first box', () => {
  const found = rectRectClosest(rect(0, 0, 1, 1), rect(3, 0.5, 1, 1))
  close(found.distance, 1)
  close(found.x, 1)
  // Faces are parallel: any point of a's face across from b is nearest.
  assert.ok(found.z >= -0.5 && found.z <= 1)

  // Corner-on: the nearest point is a's corner.
  const corner = rectRectClosest(rect(0, 0, 1, 1), rect(3, -3, 1, 1))
  close(corner.x, 1)
  close(corner.z, -1)
})

test('rectRectClosest on overlapping boxes points toward the other box', () => {
  const found = rectRectClosest(rect(0, 0, 1, 1), rect(0, 1.5, 1, 1))
  assert.equal(found.distance, 0)
  close(found.x, 0)
  close(found.z, 1)
})
