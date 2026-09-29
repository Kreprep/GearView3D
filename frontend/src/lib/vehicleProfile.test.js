import '../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FOOTPRINT, DEFAULT_RIG, defaultVehicleProfile } from '../data/vehicleProfile.js'
import { DEFAULT_LANGUAGE } from './language.js'
import { resolveVehicleProfile } from './vehicleProfile.js'

const DEFAULTS = defaultVehicleProfile(DEFAULT_LANGUAGE)

test('a row with no simConfig resolves to the coded defaults', () => {
  for (const equipment of [null, { id: 'forklift' }, { id: 'forklift', simConfig: null }]) {
    assert.deepEqual(resolveVehicleProfile(equipment), DEFAULTS)
  }
})

test('footprint overrides merge over the coded half-extents', () => {
  const profile = resolveVehicleProfile({ simConfig: { footprint: { halfWidth: 0.2 } } })

  assert.deepEqual(profile.footprint, { halfWidth: 0.2, halfLength: DEFAULT_FOOTPRINT.halfLength })
})

test('a blank, zero or negative footprint override keeps the default', () => {
  for (const halfWidth of [null, '', 0, -1, 'wide']) {
    const profile = resolveVehicleProfile({ simConfig: { footprint: { halfWidth } } })
    assert.equal(profile.footprint.halfWidth, DEFAULT_FOOTPRINT.halfWidth, `halfWidth ${halfWidth}`)
  }
})

test('the seat override merges into the coded rig', () => {
  const profile = resolveVehicleProfile({ simConfig: { rig: { cabin: { seatOffset: [0, 0.5, -0.1] } } } })

  assert.deepEqual(profile.rig.cabin.seatOffset, [0, 0.5, -0.1])
  assert.deepEqual(profile.rig.wheels, DEFAULT_RIG.wheels)
  assert.equal(profile.rig.mast, DEFAULT_RIG.mast)
})

test('keys stored before the app was narrowed to the forklift have no effect', () => {
  const profile = resolveVehicleProfile({
    simConfig: {
      modelUrl: '/models/backhoe.glb',
      parkedModelUrl: '/models/backhoe.glb',
      hasForks: false,
      rig: { wheels: { FL: 'Front_Left' }, mast: 'Boom', carriage: 'Bucket', mastFoot: [1, 1, 1] },
    },
  })

  assert.deepEqual(profile, DEFAULTS)
  assert.equal('modelUrl' in profile, false)
  assert.equal('hasForks' in profile, false)
})

test('the key legend always shows the fork and tilt keys', () => {
  const keys = resolveVehicleProfile(null).keyLegend.map((entry) => entry.key)

  assert.deepEqual(keys, ['w', 'a', 's', 'd', 'e', 'r', 'f', 't', 'g'])
})

test('a stored key legend and fail messages still override the defaults', () => {
  const keyLegend = [{ key: 'w', caption: 'Go' }]
  const profile = resolveVehicleProfile({
    simConfig: { keyLegend, failMessages: { cone: { title: 'Cone hit' } } },
  })

  assert.deepEqual(profile.keyLegend, keyLegend)
  assert.equal(profile.failMessages.cone.title, 'Cone hit')
  assert.equal(profile.failMessages.cone.message, DEFAULTS.failMessages.cone.message)
})
