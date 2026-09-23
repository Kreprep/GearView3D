import { Box3, Matrix4 } from 'three'
import { DEFAULT_FOOTPRINT, DEFAULT_VEHICLE_MODEL_URL } from '../../data/vehicleProfile.js'
import { PALLET_FALLBACK_FOOTPRINT } from '../../data/palletProfile.js'
import { RACK_MODEL_SCALE, RACK_MODEL_URL } from '../../data/rackProfile.js'

export const DEFAULT_MODEL_URL = DEFAULT_VEHICLE_MODEL_URL

export const CONE_MODEL_URL = '/models/traffic-cone.glb'
export const PALLET_MODEL_LIGHT_URL = '/models/wooden-pallet.glb'
export const PALLET_MODEL_MEDIUM_URL = '/models/plastic-pallet.glb'
export const PALLET_MODEL_HEAVY_URL = '/models/cement-bag-pallet.glb'
export const CARGO_BOX_MODEL_URL = '/models/cardboard-box.glb'
export const CARGO_BOX_STACK_MODEL_URL = '/models/cardboard-box-stack.glb'

// Weight bands that pick which pallet prop renders for a course pallet.
export const PALLET_LIGHT_MAX_KG = 500
export const PALLET_HEAVY_MIN_KG = 1000

// Source assets come from mismatched free-asset scales/origins - each entry
// normalizes one to real-world size at this scene's world-units-are-metres/4
// convention (see vehicleRig.js) and re-centers it over its own group origin
// (measured via a throwaway inspect-glb.mjs bounding-box script).
export const MODEL_TRANSFORM = {
  [CONE_MODEL_URL]: { scale: 0.00594, position: [0, 0, 0] }, // 0.7m cone
  [PALLET_MODEL_LIGHT_URL]: { scale: 0.15, position: [0.225, 0, 0] }, // 1.2m pallet
  [PALLET_MODEL_MEDIUM_URL]: { scale: 0.00245, position: [0, 0, 0] },
  [PALLET_MODEL_HEAVY_URL]: { scale: 0.25, position: [0, 0, 0] },
  [CARGO_BOX_MODEL_URL]: { scale: 0.25, position: [0, 0.0486, 0] },
  [CARGO_BOX_STACK_MODEL_URL]: { scale: 0.25, position: [0, 0, 0] },
  [RACK_MODEL_URL]: { scale: RACK_MODEL_SCALE, position: [0, 0, 0] },
}

// Deck height (world units) each pallet model's cargo box rests on top of.
export const PALLET_DECK_Y = {
  [PALLET_MODEL_LIGHT_URL]: 0.0364,
  [PALLET_MODEL_MEDIUM_URL]: 0.0343,
}

export function palletModelForWeight(weightKg) {
  if (typeof weightKg !== 'number') return PALLET_MODEL_LIGHT_URL
  if (weightKg >= PALLET_HEAVY_MIN_KG) return PALLET_MODEL_HEAVY_URL
  if (weightKg > PALLET_LIGHT_MAX_KG) return PALLET_MODEL_MEDIUM_URL
  return PALLET_MODEL_LIGHT_URL
}

// Half-extents of a prop's model, in world units, measured off the source GLTF
// and scaled by its MODEL_TRANSFORM entry. Same idea as buildVehicleRig
// deriving forkTipOffset from the carriage's bounding box: the number that
// matters is the model's, so read it from the model rather than restating it
// as a constant that silently goes stale when the asset is swapped.
const footprintCache = new Map()

export function modelFootprint(url, scene) {
  if (footprintCache.has(url)) return footprintCache.get(url)
  const { scale } = MODEL_TRANSFORM[url] || {}
  const scaleX = Array.isArray(scale) ? scale[0] : (scale ?? 1)
  const scaleZ = Array.isArray(scale) ? scale[2] : (scale ?? 1)
  const box = new Box3().setFromObject(scene)
  const footprint = Number.isFinite(box.max.x) && Number.isFinite(box.max.z)
    ? {
        halfWidth: ((box.max.x - box.min.x) / 2) * scaleX,
        halfDepth: ((box.max.z - box.min.z) / 2) * scaleZ,
      }
    : { ...PALLET_FALLBACK_FOOTPRINT }
  footprintCache.set(url, footprint)
  return footprint
}

const toRoot = new Matrix4()
const meshToRoot = new Matrix4()
const meshBox = new Box3()

// A model's bounds in its own space, as authored. Taken mesh by mesh relative
// to the root rather than with Box3.setFromObject, because once the model is in
// the scene its world matrix carries the vehicle's position and heading - and
// an axis-aligned box around a turned vehicle is wider than the vehicle.
function authoredBounds(model) {
  model.updateWorldMatrix(true, true)
  toRoot.copy(model.matrixWorld).invert().premultiply(model.matrix)

  const box = new Box3()
  model.traverse((object) => {
    if (!object.isMesh) return
    // A skinned mesh's own box is taken through its skinning, as it renders;
    // its geometry's box is the unskinned rest data.
    if (object.isSkinnedMesh) {
      object.computeBoundingBox()
      meshBox.copy(object.boundingBox)
    } else {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
      meshBox.copy(object.geometry.boundingBox)
    }
    box.union(meshBox.applyMatrix4(meshToRoot.multiplyMatrices(toRoot, object.matrixWorld)))
  })
  return box
}

// Where the driving scene stands a vehicle model, and the body half-extents it
// measures off it. `placement` comes from the vehicle profile (lib/
// vehicleProfile.js): null for forklift.glb, which is drawn as authored and
// keeps its coded footprint, since its box also takes in the forks.
export function fitVehicleModel(model, placement) {
  if (!placement) return { scale: 1, position: [0, 0, 0] }

  const { scale, offsetY } = placement
  const box = authoredBounds(model)
  if (box.isEmpty()) return { scale, position: [0, offsetY, 0], ...DEFAULT_FOOTPRINT }

  return {
    scale,
    // Centred on the vehicle's origin - the point it steers about and its
    // collision rectangle is centred on - and stood on the floor, the same fit
    // drei's <Center top> gives it in the hotspot viewer.
    position: [
      -((box.min.x + box.max.x) / 2) * scale,
      -box.min.y * scale + offsetY,
      -((box.min.z + box.max.z) / 2) * scale,
    ],
    halfWidth: ((box.max.x - box.min.x) / 2) * scale,
    halfLength: ((box.max.z - box.min.z) / 2) * scale,
  }
}
