// Loads the Rapier physics engine once, on first use.
//
// The -compat build embeds its WASM as base64, so this works unchanged under
// Vite and under node --test, with no bundler plugin. The dynamic import
// keeps it (about 2 MB) in its own chunk that only pages with a driving step
// download.
let rapierPromise = null
let rapier = null

export function loadRapier() {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat')
      .then(async ({ default: RAPIER }) => {
        await RAPIER.init()
        rapier = RAPIER
        return RAPIER
      })
      .catch((error) => {
        // Let a later call retry, e.g. after a failed chunk download.
        rapierPromise = null
        throw error
      })
  }
  return rapierPromise
}

// Rapier once loadRapier() has resolved. The simulation core is built
// synchronously (lib/driving/simCore.js), so whoever builds one awaits
// loadRapier() first: the viewer before it mounts an attempt, a test at the
// top of its file.
export function loadedRapier() {
  if (!rapier) throw new Error('Rapier is not loaded yet: await loadRapier() before building a simulation core.')
  return rapier
}
