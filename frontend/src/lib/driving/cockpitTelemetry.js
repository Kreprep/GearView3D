import { TILT_RELEASE_ANGLE } from '../../data/palletProfile.js'
import { RATED_LOAD_CENTRE } from '../physics/loadChart.js'
import { resolveCapacityKg } from '../courseGoals.js'
import { applyInstrumentFaults, WARNING_LAMPS } from '../inspection/instruments.js'
import { STOP_SPEED_EPSILON, tiltStateName } from './constants.js'
import { cabPowered } from './dashboardSource.js'
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
// `clock` is the cluster clock (clusterClock.js): while its bulb check runs
// every warning lamp is lit. `faults` are scripted instrument faults
// ({ [instrumentId]: fault }, lib/inspection/instruments.js), applied over
// the readings; without them the cluster reads true.

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
const NO_CLOCK = { bulbCheck: 0, sinceKeyOn: null, sinceStart: null }

// The warning lamps and the readings they are judged against, before and
// after the bulb check and any faults.
function clusterReadings(state, { switches, gauges, clock, faults }) {
  const { engineOn } = state.truck
  const powered = cabPowered(switches, engineOn)
  const keyOnStopped = switches.key === 'on' && !engineOn
  const lamps = {
    parkingBrake: powered && switches.parkingBrake,
    seatbelt: powered && !switches.seatbelt,
    // Lit with the key on and the engine stopped, as a real cluster's are.
    oil: keyOnStopped,
    charge: keyOnStopped,
    overload: powered && Boolean(state.load?.overCapacity),
    loadInsecure: powered && state.hud.palletState === 'carried' && state.grip !== 'secure',
  }
  if (powered && clock.bulbCheck > 0) for (const lamp of WARNING_LAMPS) lamps[lamp] = true
  const readings = { lamps, fuel: gauges.fuel, temp: gauges.temp, hours: gauges.hours }
  return applyInstrumentFaults(readings, faults, { powered, sinceKeyOn: clock.sinceKeyOn, sinceStart: clock.sinceStart })
}

export function cockpitSnapshot(state, course, { controls, switches, gauges, proximity, wheel = NO_WHEEL, clock = NO_CLOCK, faults = null }) {
  const { truck, forks } = state
  // After the interlock refused a start, the items still unmet are pointed
  // out on the cluster until the engine starts.
  const unmet = state.interlock.at !== null && !truck.engineOn ? startInterlockMissing(controls) : []
  const powered = cabPowered(switches, truck.engineOn)
  const cluster = clusterReadings(state, { switches, gauges, clock, faults })
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
    beacon: switches.beacon,
    turnSignal: switches.turnSignal,
    // Lamps, lit or not: the warning row (with the bulb check and any
    // faults) and the indicators for the lights, beacon and turn signals.
    lampParkingBrake: cluster.lamps.parkingBrake,
    lampSeatbelt: cluster.lamps.seatbelt,
    lampOil: cluster.lamps.oil,
    lampCharge: cluster.lamps.charge,
    lampOverload: cluster.lamps.overload,
    lampLoadInsecure: cluster.lamps.loadInsecure,
    lampLights: powered && switches.lights,
    lampBeacon: powered && switches.beacon,
    lampTurnLeft: powered && switches.turnSignal === 'left',
    lampTurnRight: powered && switches.turnSignal === 'right',
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
    fuel: round(cluster.fuel, 3),
    temp: round(cluster.temp, 2),
    hours: round(cluster.hours, 1),
    // Course progress.
    checkpointIndex: state.checkpointIndex,
    // A mission's active task (lib/driving/stepMission.js), or null.
    missionIndex: state.mission ? state.mission.index : null,
    // The ids of the pallets delivered so far, joined, so a selector over it
    // only changes when a delivery does.
    deliveredPallets: state.pallets
      .filter((pallet) => pallet.state === 'delivered')
      .map((pallet) => pallet.def.id)
      .join(','),
    // A catalog key, set by lib/driving/stepGoals.js. Before the first sim
    // step it has not been worked out yet.
    parkingStatus: state.parking.status || (course.parkingBay ? 'driving.parking.enterBay' : null),
    parked: state.parking.parked,
    // Proximity inset.
    ...proximityTelemetry(proximity || {}),
  }
}
