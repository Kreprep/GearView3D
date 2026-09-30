// Rapier, loaded before any test builds a simulation core: createSimCore() is
// synchronous and reads the engine lib/physics/rapier.js has already loaded.
// Import this file for its effect.
import { loadRapier } from '../lib/physics/rapier.js'

export const RAPIER = await loadRapier()
