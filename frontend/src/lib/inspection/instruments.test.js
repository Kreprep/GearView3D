import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCabGauges } from '../driving/cabGauges.js'
import { cockpitSnapshot } from '../driving/cockpitTelemetry.js'
import { neutralControls } from '../driving/controls.js'
import { createDashboardSource } from '../driving/dashboardSource.js'
import { createSimState } from '../driving/simState.js'
import { applyInstrumentFaults, faultyReading, gaugeInstrument, INSTRUMENT_IDS, STOCK_GAUGE_INSTRUMENTS, WARNING_LAMPS } from './instruments.js'

// The dashboard's instruments as the engine-on inspection names them, and
// scripted faults over their readings (docs/modules/module-improvements-
// plan.md, 3.3). View-side: applied in the cockpit snapshot only.

const COURSE = { start: { position: [0, 0, 0], heading: 0 } }
const lampsOff = Object.fromEntries(WARNING_LAMPS.map((lamp) => [lamp, false]))
const readings = { lamps: lampsOff, fuel: 0.7, temp: 0.5, hours: 1287.4 }

test('every stock gauge maps to an instrument; an admin-made one maps to none', () => {
  for (const instrument of Object.values(STOCK_GAUGE_INSTRUMENTS)) assert.ok(INSTRUMENT_IDS.includes(instrument), instrument)
  assert.equal(gaugeInstrument({ id: 'engine-temperature-gauge' }), 'gauge.temp')
  assert.equal(gaugeInstrument({ id: 'engine-temperature-gauge', instrument: 'gauge.fuel' }), 'gauge.fuel')
  assert.equal(gaugeInstrument({ id: 'engine-temperature-gauge', instrument: 'nonsense' }), 'gauge.temp')
  assert.equal(gaugeInstrument({ id: 'admin-made-gauge' }), null)
})

test('a lamp that stays lit is lit whenever the cab is powered; a dead one never', () => {
  const faulty = applyInstrumentFaults(readings, { 'lamp.charge': { lamp: 'stays-lit' } }, { powered: true })
  assert.equal(faulty.lamps.charge, true)
  assert.equal(faulty.lamps.oil, false)
  assert.equal(applyInstrumentFaults(readings, { 'lamp.charge': { lamp: 'stays-lit' } }, { powered: false }).lamps.charge, false)

  const allLit = { ...readings, lamps: Object.fromEntries(WARNING_LAMPS.map((lamp) => [lamp, true])) }
  const dead = applyInstrumentFaults(allLit, { 'lamp.oil': { lamp: 'dead' } }, { powered: true })
  assert.equal(dead.lamps.oil, false, 'a dead bulb stays dark through the bulb check')
  assert.equal(dead.lamps.charge, true)
  // A fault on the whole row reaches every warning lamp.
  assert.ok(Object.values(applyInstrumentFaults(allLit, { lamps: { lamp: 'dead' } }, { powered: true }).lamps).every((lit) => !lit))
})

test('a gauge fault moves the needle from normal to its value over the ramp', () => {
  const fault = { value: 0.97, after: 'start', rampS: 10 }
  assert.equal(faultyReading(fault, 0.5, { sinceStart: null }), 0.5, 'not started: reads normal')
  assert.equal(faultyReading(fault, 0.5, { sinceStart: 5 }), 0.735)
  assert.equal(faultyReading(fault, 0.5, { sinceStart: 60 }), 0.97)
  assert.equal(faultyReading({ value: 0.05, after: 'key', rampS: 0 }, 0.7, { sinceKeyOn: 0 }), 0.05)
  assert.equal(faultyReading({ lamp: 'dead' }, 0.7, { sinceStart: 5 }), 0.7, 'not a gauge fault')
})

test('faults leave the readings alone when there are none, and ignore unknown instruments', () => {
  assert.equal(applyInstrumentFaults(readings, null, { powered: true }), readings)
  assert.deepEqual(applyInstrumentFaults(readings, { 'gauge.speed': { value: 1 } }, { powered: true }), readings)
})

test('the cockpit snapshot shows a fault, and the simulation state is untouched', () => {
  const state = createSimState(COURSE)
  state.truck.engineOn = true
  const before = JSON.stringify(state)
  const switches = { ...createDashboardSource().switches, key: 'on' }
  const clock = { bulbCheck: 0, sinceKeyOn: 30, sinceStart: 25 }
  const faults = { 'gauge.temp': { value: 0.95, after: 'start', rampS: 20 }, 'lamp.charge': { lamp: 'stays-lit' } }
  const snapshot = cockpitSnapshot(state, COURSE, { controls: neutralControls(), switches, gauges: createCabGauges(), clock, faults })
  assert.equal(snapshot.temp, 0.95)
  assert.equal(snapshot.lampCharge, true, 'charge lamp lit with the engine running')
  assert.equal(snapshot.lampOil, false)
  assert.equal(JSON.stringify(state), before)
})
