import { DETECTOR_IDS } from './inspection/detectors.js'
import { faultProblem, gaugeInstrument, INSTRUMENTS, instrumentReadyAt } from './inspection/instruments.js'

// Grading and state helpers for `walk-around` step rows. The step's payload
// (Course.data) decides what the phase asks for, so adding an inspection check
// or a gauge in the admin changes what completion means with no code change.
// Pure: the engine-on step's cab (components/inspection/CabInspectionViewer.jsx)
// reads its instrument targets from here too.

export const PHASE_TITLE_KEYS = {
  'engine-off': 'walkAround.phase.engineOff',
  'engine-on': 'walkAround.phase.engineOn',
  'defect-test': 'walkAround.phase.defectTest',
}

// The gauge choices, as a value/label pair rather than one string doing both
// jobs. `value` is what gets written into the learner's saved progress and
// compared against `gauge.answer`, which is admin-authored English content in
// the database - translating it would silently mark every correct answer wrong
// the moment a learner switched language. Only `labelKey` is translated (the
// task panel's cards and the cab's judge popover both render it).
export const GAUGE_CHOICES = [
  { value: 'Normal', labelKey: 'walkAround.gauges.normal' },
  { value: 'Abnormal', labelKey: 'walkAround.gauges.abnormal' },
]

// The cab's live start-up state, as the engine-on scene reports it
// (CabInspectionViewer's onCabStatus), before it has reported any. `keyOn`
// and `engineRan` are latched for the attempt; the rest are the switches now.
export const NO_CAB_STATUS = { seatbelt: false, parkingBrake: false, neutral: false, keyOn: false, engineOn: false, engineRan: false }

// `started` is set when the engine was started in this step's own cab (the
// engine-on phase), apart from the module-wide `engineStarted`, so a start on
// an older engine-off step does not stand in for the cab's start-up.
export function emptyPhaseState() {
  return { checks: [], devices: [], gauges: {}, scenarios: {}, started: false }
}

export function phaseStateFor(simulation, stepId) {
  return { ...emptyPhaseState(), ...(simulation?.walkAround?.[stepId] || {}) }
}

// Answers are stored per step under `walkAround`, alongside the module-wide
// `engineStarted` flag the engine-off phase sets.
export function withPhaseState(simulation, stepId, patch) {
  return {
    walkAround: {
      ...(simulation?.walkAround || {}),
      [stepId]: { ...phaseStateFor(simulation, stepId), ...patch },
    },
  }
}

export function gaugeScore(data, state) {
  return (data.gauges || []).filter((gauge) => state.gauges?.[gauge.id] === gauge.answer).length
}

export function scenarioScore(data, state) {
  return (data.scenarios || []).filter((scenario) => state.scenarios?.[scenario.id] === scenario.answer).length
}

// A phase is done when everything it asks for is answered - and, where the row
// requires the engine started, when it was: for engine-off from the ignition
// (the module-wide flag), for engine-on in this step's own cab (`started`). Gauges and defect scenarios must be answered
// *correctly*; clicking a check or a device test is enough on its own.
export function isPhaseComplete(data, state, engineStarted) {
  const phase = data?.phase

  if (phase === 'engine-off') {
    const checks = data.checks || []
    const allChecked = checks.length > 0 && checks.every((check) => state.checks.includes(check.id))
    return allChecked && (!data.requireEngineStart || Boolean(engineStarted))
  }

  if (phase === 'engine-on') {
    const devices = data.devices || []
    const gauges = data.gauges || []
    const allDevices = devices.every((device) => state.devices.includes(device.id))
    const started = !data.requireEngineStart || Boolean(state.started)
    return started && allDevices && gaugeScore(data, state) === gauges.length && devices.length + gauges.length > 0
  }

  if (phase === 'defect-test') {
    const scenarios = data.scenarios || []
    return scenarios.length > 0 && scenarioScore(data, state) === scenarios.length
  }

  return false
}

// The hotspots a phase shows. A marker's `state` (engine-off / ignition /
// engine-on) picks its phase; an empty one shows in every phase.
export function visibleHotspotIds(data, hotspots, { engineOffComplete, engineStarted } = {}) {
  const phase = data?.phase
  if (phase === 'defect-test') return []

  const stateless = hotspots.filter((hotspot) => !hotspot.state).map((hotspot) => hotspot.id)
  const withState = (state) => hotspots.filter((hotspot) => hotspot.state === state).map((hotspot) => hotspot.id)

  // In the cab the key is on the dashboard, so the ignition marker is only its
  // detail card.
  if (phase === 'engine-on') return [...withState('engine-on'), ...withState('ignition'), ...stateless]

  // The ignition only joins the engine-off scene once the walk-around is done,
  // and only on a row that still starts the engine there.
  const ignition = data.requireEngineStart && engineOffComplete && !engineStarted ? withState('ignition') : []
  return [...withState('engine-off'), ...ignition, ...stateless]
}

// The engine-on step's gauges, split by where they are judged: on the
// operator dashboard (`dashboard`, one per instrument, the first row on an
// instrument winning) or, for a row that names no instrument, from a card in
// the task panel (`cards`).
export function engineOnGauges(data) {
  const dashboard = []
  const cards = []
  const taken = new Set()
  for (const gauge of data?.gauges || []) {
    const instrument = gaugeInstrument(gauge)
    if (instrument && !taken.has(instrument)) {
      taken.add(instrument)
      dashboard.push({ gauge, instrument })
    } else {
      cards.push(gauge)
    }
  }
  return { dashboard, cards }
}

// A gauge's status in the step: 'pending' until answered, then whether the
// answer is right.
export const gaugeStatus = (gauge, state) =>
  !state.gauges?.[gauge.id] ? 'pending' : state.gauges[gauge.id] === gauge.answer ? 'correct' : 'wrong'

// The dashboard's inspect targets ({ [instrumentId]: status }): each
// instrument the step asks about, once it can be judged (instrumentReadyAt():
// `keyOn` since the key went ON in this attempt, `started` since the engine
// started in it).
export function instrumentTargets(data, state, { keyOn, started }) {
  const targets = {}
  for (const { gauge, instrument } of engineOnGauges(data).dashboard) {
    const ready = instrumentReadyAt(instrument) === 'key' ? keyOn || started : started
    if (ready) targets[instrument] = gaugeStatus(gauge, state)
  }
  return targets
}

// What is wrong with an engine-on row's cab fields, as problem strings for
// the admin (the server refuses to publish a row with any): an instrument or
// a detector the cab does not know, or a fault that cannot apply to its
// instrument. A field left out is fine: it falls back to the stock maps.
export function engineOnProblems(data) {
  const problems = []
  for (const gauge of data?.gauges || []) {
    const name = gauge.label || gauge.id
    if (gauge.instrument !== undefined && gauge.instrument !== null && !INSTRUMENTS[gauge.instrument]) {
      problems.push(`Gauge "${name}" names an unknown instrument "${gauge.instrument}".`)
      continue
    }
    const problem = gauge.fault ? faultProblem(gauge.fault, gaugeInstrument(gauge)) : null
    if (problem) problems.push(`Gauge "${name}": ${problem}`)
  }
  for (const device of data?.devices || []) {
    if (device.detect !== undefined && device.detect !== null && !DETECTOR_IDS.includes(device.detect)) {
      problems.push(`Device "${device.label || device.id}" names an unknown test "${device.detect}".`)
    }
  }
  return problems
}
