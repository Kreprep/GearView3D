import { DEFAULT_RIG } from '../../data/vehicleProfile.js'
import { TIP_PIVOT_Y, TIP_PIVOT_Z } from './constants.js'

// forklift.glb's rig geometry as the simulation needs it, as constants, so
// the sim can run without the model loaded (headless, in node --test).
//
// forkTipOffset / forkReach / the wheel radii are what buildVehicleRig()
// (lib/vehicleRig.js) measures off the model at runtime, read back from
// window.__vehicleRig in the browser on 2026-09-29. The mast's parent node is
// unrotated in the model's own frame (the GLB's +/-90 degree root rotations
// cancel), so the tilt pivot sits at DEFAULT_RIG.mastFoot with no extra
// rotation - which is what makes forkPose() a short chain of transforms.
//
// If forklift.glb is re-exported, re-measure these. In development the
// viewer compares them with the live rig and warns on a mismatch
// (rigGeometryMismatches below).
export const FORKLIFT_RIG_GEOMETRY = {
  mastFoot: DEFAULT_RIG.mastFoot,
  tipPivot: [0, TIP_PIVOT_Y, TIP_PIVOT_Z],
  // Tine tip ahead of the truck origin, and the length of tine a load can
  // sit on (tip back to the carriage face).
  forkTipOffset: 0.6436886749311639,
  forkReach: 0.43905675060262617,
  wheelRadius: { FL: 0.07857618934745933, FR: 0.07857618934745933, RL: 0.0602971522630387, RR: 0.0602971522630387 },
}

const TOLERANCE = 1e-4

// Differences between the coded geometry and a rig buildVehicleRig() built,
// as readable strings. Empty when they agree.
export function rigGeometryMismatches(rig, geometry = FORKLIFT_RIG_GEOMETRY) {
  const mismatches = []
  const compare = (label, coded, measured) => {
    if (typeof measured === 'number' && Math.abs(coded - measured) > TOLERANCE) {
      mismatches.push(`${label}: coded ${coded}, model ${measured}`)
    }
  }
  compare('forkTipOffset', geometry.forkTipOffset, rig.forkTipOffset)
  compare('forkReach', geometry.forkReach, rig.forkReach)
  for (const [key, wheel] of Object.entries(rig.wheels || {})) {
    compare(`wheel ${key} radius`, geometry.wheelRadius[key], wheel.radius)
  }
  return mismatches
}
