import {
  DEFAULT_VEHICLE_MODEL_URL,
  defaultVehicleProfile,
} from '../data/vehicleProfile.js'

// Reader for Equipment.simConfig, the same shape as lib/hubContent.js is for
// Equipment.content: overrides merged over the coded defaults, so a blank or
// missing key keeps the default.

function mergeMessages(defaults, overrides) {
  const merged = { ...defaults }
  for (const [key, value] of Object.entries(overrides || {})) {
    if (value?.title || value?.message) merged[key] = { ...defaults[key], ...value }
  }
  return merged
}

export function resolveVehicleProfile(equipment) {
  const defaults = defaultVehicleProfile()
  const overrides = equipment?.simConfig || {}
  const legend = Array.isArray(overrides.keyLegend) && overrides.keyLegend.length
    ? overrides.keyLegend
    : defaults.keyLegend

  const profile = {
    ...defaults,
    ...overrides,
    footprint: { ...defaults.footprint, ...(overrides.footprint || {}) },
    rig: {
      ...defaults.rig,
      ...(overrides.rig || {}),
      wheels: { ...defaults.rig.wheels, ...(overrides.rig?.wheels || {}) },
    },
    keyLegend: legend,
    failMessages: mergeMessages(defaults.failMessages, overrides.failMessages),
  }

  // The vehicle model: the sim override wins, then the equipment's own model,
  // then forklift.glb - which is why an equipment with no model of its own
  // still gets a drivable course rather than an empty scene.
  profile.modelUrl = overrides.modelUrl || equipment?.modelUrl || DEFAULT_VEHICLE_MODEL_URL
  profile.parkedModelUrl = overrides.parkedModelUrl || profile.modelUrl
  profile.hasForks = overrides.hasForks !== undefined ? Boolean(overrides.hasForks) : defaults.hasForks

  // Fork controls are hidden entirely on a vehicle without them.
  profile.keyLegend = profile.keyLegend.filter((entry) => profile.hasForks || !entry.forks)

  return profile
}
