import { useSyncExternalStore } from 'react'

// Reads one value out of a driving telemetry store (lib/driving/telemetry.js).
// The store is passed in rather than taken from a context, because the app
// has no React contexts (see CLAUDE.md, Language). Select primitives: the
// selector's result is compared by identity to decide whether to re-render.
export function useTelemetry(store, selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()))
}
