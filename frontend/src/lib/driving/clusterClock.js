// The combination meter's own timing, view-side like the cab gauges
// (cabGauges.js): the bulb check, and how long the key has been on and the
// engine running, which scripted instrument faults (lib/inspection/
// instruments.js) are timed from. Not part of SimState. Pure.

// At key ON every warning lamp lights for this long, as on a real cluster,
// so the operator can see none is dead.
export const BULB_CHECK_SECONDS = 2

export function createClusterClock() {
  return { lastPowered: false, bulbCheck: 0, sinceKeyOn: null, sinceStart: null }
}

// Advance by `dt` seconds. `powered` is the key at ON or the engine running
// (dashboardSource.js's cabPowered()).
export function stepClusterClock(clock, { powered, engineOn }, dt) {
  if (powered && !clock.lastPowered) {
    clock.bulbCheck = BULB_CHECK_SECONDS
    clock.sinceKeyOn = 0
  } else if (powered) {
    clock.bulbCheck = Math.max(clock.bulbCheck - dt, 0)
    clock.sinceKeyOn += dt
  } else {
    clock.bulbCheck = 0
    clock.sinceKeyOn = null
  }
  clock.sinceStart = engineOn ? (clock.sinceStart ?? -dt) + dt : null
  clock.lastPowered = powered
  return clock
}
