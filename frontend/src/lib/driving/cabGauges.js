// The combination meter's hour meter, fuel gauge and coolant temperature
// (docs/revisions/post-defense-plan.md, section 4.2). The simulation has no
// fuel or thermal model, so these are illustrative and view-side only: they
// follow the engine's run time so the cluster reads like a real truck's, and
// nothing is graded on them. They are not part of SimState.

// A used truck: the hour meter starts part-way through its life, the tank
// most of the way full.
export const START_HOURS = 1287.4
export const START_FUEL = 0.78
// Coolant temperature as a fraction of the gauge. A cold engine starts low
// and settles in the middle (normal) band after about half a minute.
export const COLD_TEMP = 0.12
export const NORMAL_TEMP = 0.52
const WARM_TIME = 12 // time constant, s
const COOL_TIME = 120 // time constant, s
// About 2.5 L/h at idle and 5 L/h working from a 45 L LPG tank, sped up
// thirtyfold so a few minutes' training visibly moves the needle.
const FUEL_PER_SECOND_IDLE = (2.5 / 45 / 3600) * 30
const FUEL_PER_SECOND_FULL = (5 / 45 / 3600) * 30

export function createCabGauges() {
  return { hours: START_HOURS, fuel: START_FUEL, temp: COLD_TEMP }
}

// Advance the gauges by `dt` seconds. `throttle` is 0..1.
export function stepCabGauges(gauges, { engineOn, throttle = 0 }, dt) {
  if (engineOn) {
    gauges.hours += dt / 3600
    const burn = FUEL_PER_SECOND_IDLE + (FUEL_PER_SECOND_FULL - FUEL_PER_SECOND_IDLE) * throttle
    gauges.fuel = Math.max(gauges.fuel - burn * dt, 0)
    gauges.temp += (NORMAL_TEMP - gauges.temp) * (1 - Math.exp(-dt / WARM_TIME))
  } else {
    gauges.temp += (COLD_TEMP - gauges.temp) * (1 - Math.exp(-dt / COOL_TIME))
  }
  return gauges
}
