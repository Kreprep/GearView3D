import { PALLET_MODEL_TURN, palletKindForWeight } from '../../data/physicsProfile.js'
import { RACK_MODEL_SCALE, RACK_MODEL_URL } from '../../data/rackProfile.js'

export const CONE_MODEL_URL = '/models/traffic-cone.glb'
export const PALLET_MODEL_LIGHT_URL = '/models/wooden-pallet.glb'
export const PALLET_MODEL_MEDIUM_URL = '/models/plastic-pallet.glb'
export const PALLET_MODEL_HEAVY_URL = '/models/cement-bag-pallet.glb'
export const CARGO_BOX_MODEL_URL = '/models/cardboard-box.glb'
export const CARGO_BOX_STACK_MODEL_URL = '/models/cardboard-box-stack.glb'

// Source assets come from mismatched free-asset scales/origins - each entry
// normalizes one to real-world size at this scene's world-units-are-metres/4
// convention (see vehicleRig.js) and re-centers it over its own group origin
// (measured via a throwaway inspect-glb.mjs bounding-box script). `rotationY`
// turns a model from how it was modelled: the cement-bag pallet's fork
// pockets open along its X, so it is drawn a quarter turn round, the same
// turn its colliders are laid with (data/physicsProfile.js).
export const MODEL_TRANSFORM = {
  [CONE_MODEL_URL]: { scale: 0.00594, position: [0, 0, 0] }, // 0.7m cone
  [PALLET_MODEL_LIGHT_URL]: { scale: 0.15, position: [0.225, 0, 0] }, // 1.2m pallet
  [PALLET_MODEL_MEDIUM_URL]: { scale: 0.00245, position: [0, 0, 0] },
  [PALLET_MODEL_HEAVY_URL]: { scale: 0.25, position: [0, 0, 0], rotationY: PALLET_MODEL_TURN.heavy },
  [CARGO_BOX_MODEL_URL]: { scale: 0.25, position: [0, 0.0486, 0] },
  [CARGO_BOX_STACK_MODEL_URL]: { scale: 0.25, position: [0, 0, 0] },
  [RACK_MODEL_URL]: { scale: RACK_MODEL_SCALE, position: [0, 0, 0] },
}

// Deck height (world units) each pallet model's cargo box rests on top of.
export const PALLET_DECK_Y = {
  [PALLET_MODEL_LIGHT_URL]: 0.0364,
  [PALLET_MODEL_MEDIUM_URL]: 0.0343,
}

// Which pallet prop renders for a course pallet: the same weight bands the
// physics picks its colliders by (data/physicsProfile.js).
const PALLET_MODEL_BY_KIND = {
  light: PALLET_MODEL_LIGHT_URL,
  medium: PALLET_MODEL_MEDIUM_URL,
  heavy: PALLET_MODEL_HEAVY_URL,
}

export function palletModelForWeight(weightKg) {
  return PALLET_MODEL_BY_KIND[palletKindForWeight(weightKg)]
}

