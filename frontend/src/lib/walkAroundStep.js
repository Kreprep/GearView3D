// Grading and state helpers for `walk-around` step rows. The step's payload
// (Course.data) decides what the phase asks for, so adding an inspection check
// or a gauge in the admin changes what completion means with no code change.

export const PHASE_TITLES = {
  'engine-off': 'Engine-Off Inspection',
  'engine-on': 'Engine-On Inspection',
  'defect-test': 'Defect Recognition',
}

export function emptyPhaseState() {
  return { checks: [], devices: [], gauges: {}, scenarios: {} }
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

// A phase is done when everything it asks for is answered - and, for
// engine-off, when the engine has actually been started from the ignition
// rather than skipped past. Gauges and defect scenarios must be answered
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
    return allDevices && gaugeScore(data, state) === gauges.length && devices.length + gauges.length > 0
  }

  if (phase === 'defect-test') {
    const scenarios = data.scenarios || []
    return scenarios.length > 0 && scenarioScore(data, state) === scenarios.length
  }

  return false
}

// The hotspot a phase's markers come from. Forklift's WalkAroundHotspot rows
// carry a `state` (engine-off / ignition / engine-on); an equipment reusing its
// EquipmentHotspot rows has none, so every hotspot shows in every phase.
export function visibleHotspotIds(data, hotspots, { engineOffComplete, engineStarted } = {}) {
  const phase = data?.phase
  if (phase === 'defect-test') return []

  const stateless = hotspots.filter((hotspot) => !hotspot.state).map((hotspot) => hotspot.id)
  const withState = (state) => hotspots.filter((hotspot) => hotspot.state === state).map((hotspot) => hotspot.id)

  if (phase === 'engine-on') return [...withState('engine-on'), ...stateless]

  // The ignition only joins the engine-off scene once the walk-around is done.
  const ignition = engineOffComplete && !engineStarted ? withState('ignition') : []
  return [...withState('engine-off'), ...ignition, ...stateless]
}
