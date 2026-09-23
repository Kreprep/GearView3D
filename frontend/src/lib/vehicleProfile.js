import {
  DEFAULT_VEHICLE_MODEL_URL,
  defaultVehicleProfile,
} from '../data/vehicleProfile.js'
import { DEFAULT_LANGUAGE } from './language.js'

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

// How the driving scene stands a model up. forklift.glb is drawn as authored,
// because every coded default in data/vehicleProfile.js - footprint, mast foot,
// seat - is measured against it at its own origin and scale; null says so. Any
// other model is placed the way the hotspot viewer places it: centred and stood
// on the floor by its bounding box (lib/driving/models.js fitVehicleModel),
// then scaled and nudged by Equipment.modelScale / modelOffsetY. Those are set
// against the equipment's own model in Equipment Settings, so they only apply
// when that is the model being drawn.
function modelPlacement(url, equipment) {
  if (url === DEFAULT_VEHICLE_MODEL_URL) return null
  const ownModel = Boolean(equipment?.modelUrl) && url === equipment.modelUrl
  const scale = Number(equipment?.modelScale)
  return {
    scale: ownModel && scale > 0 ? scale : 1,
    offsetY: ownModel ? Number(equipment.modelOffsetY) || 0 : 0,
  }
}

export function resolveVehicleProfile(equipment, lang = DEFAULT_LANGUAGE) {
  const defaults = defaultVehicleProfile(lang)
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
      cabin: { ...defaults.rig.cabin, ...(overrides.rig?.cabin || {}) },
    },
    keyLegend: legend,
    failMessages: mergeMessages(defaults.failMessages, overrides.failMessages),
  }

  // The vehicle model: the sim override wins, then the equipment's own model,
  // then forklift.glb - which is why an equipment with no model of its own
  // still gets a drivable course rather than an empty scene.
  profile.modelUrl = overrides.modelUrl || equipment?.modelUrl || DEFAULT_VEHICLE_MODEL_URL
  profile.parkedModelUrl = overrides.parkedModelUrl || profile.modelUrl
  profile.placement = modelPlacement(profile.modelUrl, equipment)
  profile.parkedPlacement = modelPlacement(profile.parkedModelUrl, equipment)
  profile.hasForks = overrides.hasForks !== undefined ? Boolean(overrides.hasForks) : defaults.hasForks

  // The coded footprint is forklift.glb's body, so it means nothing for another
  // model. That one is measured off its own outline in the scene instead, and
  // only the half-extents an admin set are kept here to override the measure.
  if (profile.placement) profile.footprint = { ...(overrides.footprint || {}) }

  // Fork controls are hidden entirely on a vehicle without them.
  profile.keyLegend = profile.keyLegend.filter((entry) => profile.hasForks || !entry.forks)

  return profile
}
