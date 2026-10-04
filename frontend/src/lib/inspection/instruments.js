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

// Lamp faults: lit whenever the cab is powered, or never lit (a dead bulb,
// which the bulb check gives away).
export const LAMP_FAULTS = ['stays-lit', 'dead']
// A gauge fault moves the needle from its normal reading to `value` over
// `rampS` seconds from `after` (the key turned ON, or the engine started),
// so a fault can develop while the learner watches.
export const FAULT_TRIGGERS = ['start', 'key']
export const DEFAULT_FAULT_RAMP_S = 20

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
