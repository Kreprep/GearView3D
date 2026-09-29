import { defaultVehicleProfile } from '../data/vehicleProfile.js'
import { DEFAULT_LANGUAGE } from './language.js'

// Reader for Equipment.simConfig, the same shape as lib/hubContent.js is for
// Equipment.content: overrides merged over the coded defaults, so a blank or
// missing key keeps the default.
//
// Only the keys named below are read. A simConfig saved before the app was
// narrowed to the forklift can still hold model URLs, `hasForks` or rig node
// names; building the profile key by key, rather than spreading the row over
// the defaults, is what keeps those from having any effect.

function mergeMessages(defaults, overrides) {
  const merged = { ...defaults }
  for (const [key, value] of Object.entries(overrides || {})) {
    if (value?.title || value?.message) merged[key] = { ...defaults[key], ...value }
  }
  return merged
}

// A half-extent an admin set, or the coded one. Anything that is not a
// positive number - blank, null, a stray string - keeps the default rather
// than collapsing the collision body.
function mergeFootprint(defaults, overrides) {
  const pick = (key) => (Number(overrides?.[key]) > 0 ? Number(overrides[key]) : defaults[key])
  return { halfWidth: pick('halfWidth'), halfLength: pick('halfLength') }
}

export function resolveVehicleProfile(equipment, lang = DEFAULT_LANGUAGE) {
  const defaults = defaultVehicleProfile(lang)
  const overrides = equipment?.simConfig || {}

  return {
    footprint: mergeFootprint(defaults.footprint, overrides.footprint),
    // The wheel, mast and carriage node names and the mast foot are
    // forklift.glb's own and stay coded; only the seat is tunable.
    rig: {
      ...defaults.rig,
      cabin: { ...defaults.rig.cabin, ...(overrides.rig?.cabin || {}) },
    },
    keyLegend: Array.isArray(overrides.keyLegend) && overrides.keyLegend.length
      ? overrides.keyLegend
      : defaults.keyLegend,
    failMessages: mergeMessages(defaults.failMessages, overrides.failMessages),
  }
}
