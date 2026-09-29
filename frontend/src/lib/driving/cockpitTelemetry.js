import { TILT_RELEASE_ANGLE } from '../../data/palletProfile.js'
import { STOP_SPEED_EPSILON, tiltStateName } from './constants.js'
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
// (cabGauges.js) and `proximity` a proximityReadout(), or null before the
// first one.

const round = (value, places) => {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

// What the direction indicator shows. A lever the learner set is exact. With
// the keyboard's automatic direction it is the direction being driven, or the
// way the truck is rolling once the key is let go, and N at rest.
export function displayedDirection(state, controls, switches) {
  if (switches.lever) return switches.lever
  if (controls.direction !== 'N') return controls.direction
  if (state.truck.speed > STOP_SPEED_EPSILON) return 'F'
  if (state.truck.speed < -STOP_SPEED_EPSILON) return 'R'
  return 'N'
}

export function cockpitSnapshot(state, course, { controls, switches, gauges, proximity }) {
  const { truck, forks } = state
  return {
    // Engine and switches.
    engineOn: truck.engineOn,
    keyPosition: truck.engineOn ? 'on' : switches.key,
    leverEngaged: switches.lever !== null,
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
