// A tiny external store the driving simulation publishes its readouts to
// (docs/revisions/post-defense-plan.md, section 3.5). The frame loop must
// never setState per frame, so it publishes a snapshot at TELEMETRY_HZ (and
// at once whenever a discrete event changes something the HUD shows), and
// components read it through hooks/useTelemetry.js. Pure, no React.
//
// Audio will read the per-step SimState directly instead, since it must not
// lag by up to one publish interval.

export const TELEMETRY_HZ = 15
export const TELEMETRY_INTERVAL = 1 / TELEMETRY_HZ

export function createTelemetryStore(initial) {
  let snapshot = initial
  const listeners = new Set()

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    // Publishing a snapshot whose fields all equal the current one is a
    // no-op, so a 15 Hz publish of an idle truck re-renders nothing.
    publish(next) {
      if (shallowEqual(snapshot, next)) return
      snapshot = next
      listeners.forEach((listener) => listener())
    },
  }
}

function shallowEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => Object.is(a[key], b[key]))
}
