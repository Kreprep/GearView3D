import { TILT_RELEASE_ANGLE } from '../../data/palletProfile.js'
import { RATED_LOAD_CENTRE } from '../physics/loadChart.js'
import { resolveCapacityKg } from '../courseGoals.js'
import { STOP_SPEED_EPSILON, tiltStateName } from './constants.js'
import { startInterlockMissing } from './interlock.js'
import { proximityTelemetry } from './proximity.js'
import { toKmh, toMetres } from './units.js'

// What the driving screen shows, as one flat snapshot for the telemetry store
// (lib/driving/telemetry.js): the HUD's course progress, the operator
// dashboard's meter, lamps and switch positions, and the proximity inset's
// readout. Flat primitives only, rounded to what is displayed, so the store's
// shallow comparison skips a publish that would draw the same thing. Pure.
//
// `controls` are the merged controls of the last sim step, `switches` the
// dashboard source's (dashboardSource.js), `gauges` the cab gauges
// (cabGauges.js), `proximity` a proximityReadout(), or null before the
// first one, and `wheel` a wheel source's status() (wheelSource.js).

const round = (value, places) => {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

// What the direction indicator shows. A lever - a shifter's or the one the
// learner set on the dashboard - is exact. With the keyboard's automatic
// direction it is the direction being driven, or the way the truck is
// rolling once the key is let go, and N at rest.
export function displayedDirection(state, controls, switches) {
  if (controls.explicitDirection) return controls.direction
  if (switches.lever) return switches.lever
  if (controls.direction !== 'N') return controls.direction
  if (state.truck.speed > STOP_SPEED_EPSILON) return 'F'
  if (state.truck.speed < -STOP_SPEED_EPSILON) return 'R'
  return 'N'
}

const NO_WHEEL = { steering: false, shifter: false }

export function cockpitSnapshot(state, course, { controls, switches, gauges, proximity, wheel = NO_WHEEL }) {
  const { truck, forks } = state
  // After the interlock refused a start, the items still unmet are pointed
  // out on the cluster until the engine starts.
  const unmet = state.interlock.at !== null && !truck.engineOn ? startInterlockMissing(controls) : []
  return {
    // Engine and switches.
    engineOn: truck.engineOn,
    keyPosition: truck.engineOn ? 'on' : switches.key,
    leverEngaged: switches.lever !== null || wheel.shifter,
    shifterActive: wheel.shifter,
    wheelActive: wheel.steering,
    needSeatbelt: unmet.includes('seatbelt'),
    needParkingBrake: unmet.includes('parkingBrake'),
    needNeutral: unmet.includes('neutral'),
    direction: displayedDirection(state, controls, switches),
    seatbelt: switches.seatbelt,
    parkingBrake: switches.parkingBrake,
    lights: switches.lights,
    // Hydraulic lever deflection, -1..1.
    liftInput: round(controls.lift, 1),
    tiltInput: round(controls.tilt, 1),
    // Meter.
    speedKmh: Math.round(toKmh(Math.abs(truck.speed))),
    forkHeightM: round(toMetres(forks.height), 2),
    // Negative is tilted back, toward the operator.
    tiltDeg: round((forks.tilt * 180) / Math.PI, 1),
    tilt: tiltStateName(forks.tilt, TILT_RELEASE_ANGLE),
    grip: state.grip,
    palletState: state.hud.palletState,
    carriedLoadKg: state.hud.carriedLoadKg,
    // The capacity plate: the truck's rating, and the load the forks are in
    // or under against the load chart (lib/physics/loadChart.js). With no
    // load the plate shows the rating at the rated load centre.
    ratedCapacityKg: resolveCapacityKg(course),
    ratedLoadCentreM: RATED_LOAD_CENTRE,
    plateLoadKg: state.load ? state.load.kg : null,
    plateLoadCentreM: state.load ? round(state.load.centre, 2) : null,
    plateLimitKg: state.load ? Math.round(state.load.deratedKg / 10) * 10 : null,
    plateOverCapacity: Boolean(state.load?.overCapacity),
    fuel: round(gauges.fuel, 3),
    temp: round(gauges.temp, 2),
    hours: round(gauges.hours, 1),
    // Course progress.
    checkpointIndex: state.checkpointIndex,
    // A catalog key, set by lib/driving/stepGoals.js. Before the first sim
    // step it has not been worked out yet.
    parkingStatus: state.parking.status || (course.parkingBay ? 'driving.parking.enterBay' : null),
    parked: state.parking.parked,
    // Proximity inset.
    ...proximityTelemetry(proximity || {}),
  }
}
