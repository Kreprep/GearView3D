import { DEFECT_LIBRARY, DEFECT_VIEWS } from '../data/defectLibrary.js'
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
// `firstAnswers` holds the defect test's first answer to each scenario,
// which is its score.
export function emptyPhaseState() {
  return { checks: [], devices: [], gauges: {}, scenarios: {}, firstAnswers: {}, started: false }
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

// How many defect scenarios are answered correctly now (completion), and
// how many were right first time (the score).
export function scenarioScore(data, state) {
  return defectScenarios(data).filter((scenario) => isScenarioCorrect(scenario, state.scenarios?.[scenario.id])).length
}

export function firstAnswerScore(data, state) {
  const scenarios = defectScenarios(data)
  const answered = scenarios.filter((scenario) => state.firstAnswers?.[scenario.id] !== undefined)
  return {
    correct: answered.filter((scenario) => isScenarioCorrect(scenario, state.firstAnswers[scenario.id])).length,
    answered: answered.length,
    total: scenarios.length,
  }
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
    const scenarios = defectScenarios(data)
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

// --- The defect test (docs/modules/module-improvements-plan.md, 3.4) --------
//
// A scenario puts defects from the library (data/defectLibrary.js) on the
// forklift, in the walk-around viewer (`view: 'exterior'`) or the cab
// (`'cab'`), and asks one question:
//
//   { id, view, defects: ['flat-front-tyre'],        // [] is a good forklift
//     question: { type, prompt, choices, answer },
//     demo,                                          // optional exterior demo
//     feedback }
//
//   usable    "May this forklift be used?" Yes / No. The values are stored
//             in English (USABLE_CHOICES), like GAUGE_CHOICES; only the
//             labels are translated.
//   identify  "What is wrong with this forklift?" from admin-written choices.
//   locate    "Click the defect on the forklift." The answer is a hotspot
//             id, clicked on an unlabelled marker. Exterior only.
//   action    "What do you do?" from admin-written choices.
//
// `prompt` is optional: each type has a default (translated). Rows saved
// before this shape (`visualState`, `question` as a string, `choices`,
// `answer`, `deviceEffectId`) are read through normalizeScenario(), and
// grading reads only the normalized shape, so the old 3- and 7-scenario rows
// still grade.

export const QUESTION_TYPES = ['usable', 'identify', 'locate', 'action']

export const QUESTION_PROMPT_KEYS = {
  usable: 'walkAround.defects.prompt.usable',
  identify: 'walkAround.defects.prompt.identify',
  locate: 'walkAround.defects.prompt.locate',
  action: 'walkAround.defects.prompt.action',
}

export const USABLE_CHOICES = [
  { value: 'Yes', labelKey: 'walkAround.defects.usable.yes' },
  { value: 'No', labelKey: 'walkAround.defects.usable.no' },
]
const USABLE_VALUES = USABLE_CHOICES.map(({ value }) => value)

// Demos a scenario can play on the exterior model (the engine-on device
// animations in data/viewerHotspots.js), by the scenario's name for them.
export const SCENARIO_DEMOS = {
  'brake-test': 'brakes',
  steering: 'steering-response',
  'lift-tilt': 'lift-tilt-functions',
  travel: 'forward-reverse-travel',
}

// The old free-text visual states, as library defects.
export const LEGACY_VISUAL_STATES = {
  normal: [],
  'good-forklift': [],
  'oil-leak': ['engine-oil-leak'],
  'flat-tire': ['flat-front-tyre'],
  'mast-tilt': ['mast-stuck-tilted'],
  'mast-crack': ['mast-channel-crack'],
  'loose-bolt': ['missing-guard-bolt'],
  'warning-light-blink': ['charge-lamp-lit'],
  'red-light-beep': ['engine-overheating'],
}

const DEMO_BY_DEVICE_EFFECT = Object.fromEntries(Object.entries(SCENARIO_DEMOS).map(([demo, effect]) => [effect, demo]))

const isYesNo = (choices) => Array.isArray(choices) && choices.length === 2 && USABLE_VALUES.every((value) => choices.includes(value))

const viewOfDefects = (defects) => (defects.some((id) => DEFECT_LIBRARY[id]?.view === 'cab') ? 'cab' : 'exterior')

// A scenario in the current shape, whichever shape it was saved in.
export function normalizeScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') return null
  if (scenario.question && typeof scenario.question === 'object') {
    const defects = Array.isArray(scenario.defects) ? scenario.defects : []
    const { type, prompt, choices, answer } = scenario.question
    const knownType = QUESTION_TYPES.includes(type) ? type : 'usable'
    return {
      id: scenario.id,
      view: DEFECT_VIEWS.includes(scenario.view) ? scenario.view : viewOfDefects(defects),
      defects,
      question: {
        type: knownType,
        prompt: prompt || '',
        choices: knownType === 'usable' ? USABLE_VALUES : knownType === 'locate' ? [] : Array.isArray(choices) ? choices : [],
        answer: answer ?? '',
      },
      demo: SCENARIO_DEMOS[scenario.demo] ? scenario.demo : null,
      feedback: scenario.feedback || '',
    }
  }

  // The old shape.
  const defects = LEGACY_VISUAL_STATES[scenario.visualState] ?? []
  const usable = isYesNo(scenario.choices)
  return {
    id: scenario.id,
    view: viewOfDefects(defects),
    defects,
    question: {
      type: usable ? 'usable' : 'identify',
      prompt: typeof scenario.question === 'string' ? scenario.question : '',
      choices: usable ? USABLE_VALUES : scenario.choices || [],
      answer: scenario.answer ?? '',
    },
    demo: DEMO_BY_DEVICE_EFFECT[scenario.deviceEffectId] || null,
    feedback: scenario.feedback || '',
  }
}

// A defect-test row's scenarios, normalized, in saved order.
export const defectScenarios = (data) => (data?.scenarios || []).map(normalizeScenario).filter(Boolean)

export const isScenarioCorrect = (scenario, answer) => answer !== undefined && answer !== null && answer === scenario.question.answer

// A string's 32-bit FNV-1a hash, the seed of the shuffle below.
function hashString(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// mulberry32: a small seeded generator, so the order is the same on every
// visit for the same seed.
function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The order a learner meets the scenarios in (decision D-1: a fixed set,
// shuffled): the same scenarios for everyone, shuffled with a seed from the
// learner and the step, so the order is stable across visits and differs
// between learners. Every learner answers every scenario, so first-answer
// scores still compare.
export function scenarioOrder(scenarios, seed) {
  const order = [...scenarios]
  const random = seededRandom(hashString(String(seed)))
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = order[i]
    order[i] = order[j]
    order[j] = swap
  }
  return order
}

// The hotspots a locate question offers: the walk-around's exterior parts
// (engine-off or stateless markers with a position).
export const locateCandidates = (hotspots = []) =>
  hotspots.filter((hotspot) => hotspot.position && (!hotspot.state || hotspot.state === 'engine-off'))

// What is wrong with a defect-test row's scenarios, as problem strings for
// the admin (the server refuses to publish a row with any). `hotspotIds`,
// when given, are the ids a locate answer may name.
export function defectScenarioProblems(data, { hotspotIds } = {}) {
  const problems = []
  const seen = new Set()
  for (const [index, raw] of (data?.scenarios || []).entries()) {
    const scenario = normalizeScenario(raw)
    const name = `Scenario ${index + 1}`
    if (!scenario?.id) {
      problems.push(`${name} needs an id.`)
      continue
    }
    if (seen.has(scenario.id)) problems.push(`${name}: the id "${scenario.id}" is used twice.`)
    seen.add(scenario.id)

    for (const id of scenario.defects) {
      const defect = DEFECT_LIBRARY[id]
      if (!defect) problems.push(`${name}: unknown defect "${id}".`)
      else if (defect.view !== scenario.view) problems.push(`${name}: "${defect.label}" is a ${defect.view} defect, but the scenario is in the ${scenario.view} view.`)
    }

    const { type, choices, answer } = scenario.question
    if (raw.question && typeof raw.question === 'object' && !QUESTION_TYPES.includes(raw.question.type)) {
      problems.push(`${name}: unknown question type "${raw.question.type}".`)
    }
    if (type === 'locate') {
      if (scenario.view !== 'exterior') problems.push(`${name}: a locate question needs the exterior view.`)
      if (!scenario.defects.length) problems.push(`${name}: a locate question needs a defect to find.`)
      if (!answer) problems.push(`${name}: pick the part the learner should click.`)
      else if (hotspotIds && !hotspotIds.includes(answer)) problems.push(`${name}: the answer "${answer}" is not a walk-around part.`)
    } else {
      if ((type === 'identify' || type === 'action') && choices.length < 2) problems.push(`${name} needs at least two choices.`)
      if (!choices.includes(answer)) problems.push(`${name}: the answer must be one of its choices.`)
    }
    if (raw.demo && !SCENARIO_DEMOS[raw.demo]) problems.push(`${name}: unknown demo "${raw.demo}".`)
    if (scenario.demo && scenario.view !== 'exterior') problems.push(`${name}: a demo plays on the exterior model only.`)
  }
  return problems
}
