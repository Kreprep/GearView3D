import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RACK_LEVEL_HEIGHTS } from '../data/rackProfile.js'
import { courseDropZones, coursePallets, DEFAULT_DROP_ZONE_ID, palletStartPose, palletTarget } from './coursePallets.js'

// One reader for every shape a course's pallets, zones and targets have been
// stored in (module improvements Phase 5).

test('the older single drop zone reads as a zone with the default id, beside any listed ones', () => {
  const dropZone = { position: [0, 0, 5], radius: 0.9 }
  assert.deepEqual(courseDropZones({ dropZone }), [{ ...dropZone, id: DEFAULT_DROP_ZONE_ID }])
  const listed = [{ id: 'dock', position: [2, 0, 5], radius: 1 }]
  assert.deepEqual(courseDropZones({ dropZones: listed }), listed)
  assert.deepEqual(courseDropZones({ dropZones: listed, dropZone }).map((zone) => zone.id), ['dock', DEFAULT_DROP_ZONE_ID])
  assert.deepEqual(courseDropZones({}), [])
})

test("a pallet's target: its own, the older targetRack, or none (any zone)", () => {
  assert.deepEqual(palletTarget({ target: { zone: 'dock' } }), { zone: 'dock' })
  assert.deepEqual(palletTarget({ target: { rack: 'r1', level: 'top' } }), { rack: 'r1', level: 'top' })
  assert.deepEqual(palletTarget({ targetRack: 'r1', targetLevel: 'middle' }), { rack: 'r1', level: 'middle' })
  // A target wins over the older fields.
  assert.deepEqual(palletTarget({ target: { zone: 'dock' }, targetRack: 'r1', targetLevel: 'top' }), { zone: 'dock' })
  assert.equal(palletTarget({ targetRack: 'r1' }), null)
  assert.equal(palletTarget({}), null)
})

test('a pallet on the floor keeps the pose it was stored with', () => {
  const pallet = { id: 'p', position: [1, 0, 4], rotation: 0.3, weightKg: 400 }
  assert.deepEqual(coursePallets({ pallets: [pallet] }), [{ ...pallet, position: [1, 0, 4], rotation: 0.3 }])
  // The older singular `pallet`, with no rotation.
  assert.deepEqual(coursePallets({ pallet: { id: 'q', position: [0, 0, 2] } })[0].rotation, 0)
})

test('a pallet that starts on a shelf stands at the front of its rack\'s centre bay, at that level, turned with the rack', () => {
  const rack = { id: 'r1', position: [2, 0, 10], rotation: 0 }
  const def = { id: 'p', position: [0, 0, 0], weightKg: 400, startShelf: { rack: 'r1', level: 'middle' } }
  const { position, rotation } = palletStartPose(def, [rack])
  assert.equal(position[0], 2)
  assert.ok(position[2] < 10 && position[2] > 9.8, `z ${position[2]}`)
  assert.ok(Math.abs(position[1] - RACK_LEVEL_HEIGHTS.middle) < 0.001)
  assert.equal(rotation, 0)

  // Turned half round, the front is on the rack's +Z side.
  const turned = palletStartPose(def, [{ ...rack, rotation: Math.PI }])
  assert.ok(turned.position[2] > 10, `z ${turned.position[2]}`)
  assert.equal(turned.rotation, Math.PI)
})

test('a shelf start whose rack is missing, or whose level is unknown, starts on the floor', () => {
  const def = { id: 'p', position: [1, 0, 3], startShelf: { rack: 'gone', level: 'top' } }
  assert.deepEqual(palletStartPose(def, []), { position: [1, 0, 3], rotation: 0 })
  const badLevel = { ...def, startShelf: { rack: 'r1', level: 'attic' } }
  assert.deepEqual(palletStartPose(badLevel, [{ id: 'r1', position: [0, 0, 9] }]).position, [1, 0, 3])
})
