// The operator dashboard's instruments as the engine-on inspection names them
// (docs/modules/module-improvements-plan.md, section 3.3), and how a scripted
// fault changes what they read. Pure and backend-importable: no three.js,
// React, i18n catalog or browser APIs.
//
// Faults are view-side. lib/driving/cockpitTelemetry.js applies them to the
// cockpit snapshot, so the dashboard shows them; the simulation core never
// sees them and the characterization trace cannot depend on them.

// The warning lamps in the cluster's row, by the key the cockpit snapshot
// gives each (`lamp<Name>`). The bulb check lights all of them.
export const WARNING_LAMPS = ['parkingBrake', 'seatbelt', 'oil', 'charge', 'overload', 'loadInsecure']

// Each instrument a gauge row can point at, and what it is on the cluster:
// one lamp, the whole lamp row, or a reading of the cockpit snapshot.
export const INSTRUMENTS = {
  lamps: { kind: 'lamps' },
  'lamp.charge': { kind: 'lamp', lamp: 'charge' },
  'lamp.oil': { kind: 'lamp', lamp: 'oil' },
  'lamp.seatbelt': { kind: 'lamp', lamp: 'seatbelt' },
  'lamp.parkingBrake': { kind: 'lamp', lamp: 'parkingBrake' },
  'gauge.fuel': { kind: 'gauge', reading: 'fuel' },
  'gauge.temp': { kind: 'gauge', reading: 'temp' },
  hours: { kind: 'gauge', reading: 'hours' },
}
export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS)

// The stock engine-on gauges (data/inspectionScenarios.js) and the instrument
// each one is, for rows saved before gauges had an `instrument`.
export const STOCK_GAUGE_INSTRUMENTS = {
  'battery-charge-indicator': 'lamp.charge',
  'engine-temperature-gauge': 'gauge.temp',
  'lpg-level-gauge': 'gauge.fuel',
  'hour-meter': 'hours',
  'warning-lights': 'lamps',
}

// The instrument a gauge row is judged on, or null for one that maps to
// nothing on the dashboard (it is then judged from a card in the task panel).
export function gaugeInstrument(gauge) {
  if (INSTRUMENTS[gauge?.instrument]) return gauge.instrument
  return STOCK_GAUGE_INSTRUMENTS[gauge?.id] ?? null
}

// When an instrument can be judged: the lamp row on its bulb check, from key
// ON; everything else once the engine runs, since before that the charge and
// oil lamps are lit on any truck and the temperature needle is cold.
export const instrumentReadyAt = (instrument) => (INSTRUMENTS[instrument]?.kind === 'lamps' ? 'key' : 'start')

// Lamp faults: lit whenever the cab is powered, or never lit (a dead bulb,
// which the bulb check gives away).
export const LAMP_FAULTS = ['stays-lit', 'dead']
// A gauge fault moves the needle from its normal reading to `value` over
// `rampS` seconds from `after` (the key turned ON, or the engine started),
// so a fault can develop while the learner watches. With `alarmAbove` (0 to
// 1) the cluster's warning chime sounds once the reading passes it, and
// again every ALARM_REPEAT_S while it stays there (createFaultAlarm).
export const FAULT_TRIGGERS = ['start', 'key']
export const DEFAULT_FAULT_RAMP_S = 20

// The faults the stock abnormal gauges read, for rows saved before gauges
// had a `fault`: the charge lamp stays lit after the start, and the coolant
// temperature climbs into the red.
export const STOCK_GAUGE_FAULTS = {
  'battery-charge-indicator': { lamp: 'stays-lit' },
  'engine-temperature-gauge': { value: 0.97, after: 'start', rampS: 15 },
}

// Why a fault cannot apply to `instrument`, or null when it can (or when
// there is no fault). Lamp faults go on lamps, needle faults on gauges.
export function faultProblem(fault, instrument) {
  if (fault === null || fault === undefined) return null
  const target = INSTRUMENTS[instrument]
  if (!target) return 'A fault needs an instrument on the dashboard.'
  if (typeof fault !== 'object' || Array.isArray(fault)) return 'A fault must be an object.'
  if (target.kind === 'gauge') {
    if (typeof fault.value !== 'number' || fault.value < 0 || fault.value > 1) return 'A gauge fault needs a value from 0 to 1.'
    if (fault.after !== undefined && !FAULT_TRIGGERS.includes(fault.after)) return `A gauge fault starts after ${FAULT_TRIGGERS.join(' or ')}.`
    if (fault.rampS !== undefined && !(typeof fault.rampS === 'number' && fault.rampS >= 0)) return 'A gauge fault ramp must be zero or more seconds.'
    if (fault.alarmAbove !== undefined && !(typeof fault.alarmAbove === 'number' && fault.alarmAbove >= 0 && fault.alarmAbove <= 1)) {
      return 'A gauge alarm level must be from 0 to 1.'
    }
    return null
  }
  return LAMP_FAULTS.includes(fault.lamp) ? null : `A lamp fault is one of ${LAMP_FAULTS.join(', ')}.`
}

// The fault a gauge row reads: its own `fault` (null for none), else the
// stock one for its id when the row's answer is Abnormal. A stock gauge an
// admin turned Normal reads true.
export function gaugeFault(gauge) {
  if (gauge?.fault !== undefined) return gauge.fault
  return gauge?.answer === 'Abnormal' ? (STOCK_GAUGE_FAULTS[gauge.id] ?? null) : null
}

// The instrument faults ({ [instrumentId]: fault }) a step's gauge rows
// script, for the dashboard. The first row on an instrument wins.
export function gaugeInstrumentFaults(gauges = []) {
  const faults = {}
  for (const gauge of gauges) {
    const instrument = gaugeInstrument(gauge)
    const fault = gaugeFault(gauge)
    if (instrument && fault && !(instrument in faults) && !faultProblem(fault, instrument)) faults[instrument] = fault
  }
  return faults
}

// What a faulty gauge reads `normal` would have read, given the cluster
// clock's { sinceKeyOn, sinceStart } (lib/driving/clusterClock.js).
export function faultyReading(fault, normal, { sinceKeyOn = null, sinceStart = null } = {}) {
  if (typeof fault?.value !== 'number') return normal
  const elapsed = fault.after === 'key' ? sinceKeyOn : sinceStart
  if (elapsed === null) return normal
  const ramp = typeof fault.rampS === 'number' && fault.rampS >= 0 ? fault.rampS : DEFAULT_FAULT_RAMP_S
  if (elapsed >= ramp) return fault.value
  return normal + ((fault.value - normal) * elapsed) / ramp
}

const faultyLamp = (fault, lit, powered) => {
  if (fault?.lamp === 'dead') return false
  if (fault?.lamp === 'stays-lit') return powered
  return lit
}

// The cluster's readings with `faults` ({ [instrumentId]: fault }) applied.
// `readings` is { lamps: { [WARNING_LAMPS name]: lit }, fuel, temp, hours };
// returns a new object of the same shape. `powered` is the cab's electrics.
export function applyInstrumentFaults(readings, faults, { powered, ...timing } = {}) {
  if (!faults) return readings
  const lamps = { ...readings.lamps }
  const next = { ...readings, lamps }
  for (const [id, fault] of Object.entries(faults)) {
    const instrument = INSTRUMENTS[id]
    if (!instrument || !fault) continue
    if (instrument.kind === 'lamps') {
      for (const lamp of WARNING_LAMPS) lamps[lamp] = faultyLamp(fault, lamps[lamp], powered)
    } else if (instrument.kind === 'lamp') {
      lamps[instrument.lamp] = faultyLamp(fault, lamps[instrument.lamp], powered)
    } else {
      next[instrument.reading] = faultyReading(fault, readings[instrument.reading], timing)
    }
  }
  return next
}

export const ALARM_REPEAT_S = 4

// The warning chime of the gauge faults that set `alarmAbove`, for the cab
// (view-side, like the faults). update(readings, dt) takes the cluster's
// readings ({ fuel, temp, hours }, the cockpit snapshot's) and the seconds
// since the last call, and returns true when the chime should sound.
export function createFaultAlarm(faults) {
  const alarms = Object.entries(faults || {}).flatMap(([id, fault]) => {
    const instrument = INSTRUMENTS[id]
    return instrument?.kind === 'gauge' && typeof fault?.alarmAbove === 'number' ? [{ reading: instrument.reading, above: fault.alarmAbove, since: null }] : []
  })
  return {
    update(readings, dt) {
      let sound = false
      for (const alarm of alarms) {
        const value = readings?.[alarm.reading]
        if (typeof value !== 'number' || value < alarm.above) {
          alarm.since = null
          continue
        }
        if (alarm.since === null || alarm.since >= ALARM_REPEAT_S) {
          alarm.since = 0
          sound = true
        } else {
          alarm.since += dt
        }
      }
      return sound
    },
  }
}
