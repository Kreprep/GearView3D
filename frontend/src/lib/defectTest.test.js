import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cabEffects, DECAL_TEXTURES, DEFECT_IDS, DEFECT_LIBRARY, DEFECT_VIEWS, defectSoundNames, exteriorEffects, SOUND_WHILE, VISUAL_KINDS } from '../data/defectLibrary.js'
import { SOUND_BANK } from '../data/soundBank.js'
import { walkAroundViewerHotspots } from '../data/viewerHotspots.js'
import { defectRecognitionScenarios } from '../data/inspectionScenarios.js'
import { normalizeControlFaults } from './driving/controlFaults.js'
import { createDashboardSource, SPRING_BACK_SECONDS, SWITCH_FAULTS } from './driving/dashboardSource.js'
import { defectLoopTargets, replacedSound } from './driving/drivingAudio.js'
import { neutralControls } from './driving/controls.js'
import { kmh } from './driving/units.js'
import { ALARM_REPEAT_S, createFaultAlarm, faultProblem, INSTRUMENTS } from './inspection/instruments.js'
import { bodyLift, defectPose, wheelCentres } from './defectPose.js'
import {
  defectScenarioProblems,
  defectScenarios,
  emptyPhaseState,
  firstAnswerScore,
  isPhaseComplete,
  LEGACY_VISUAL_STATES,
  locateCandidates,
  normalizeScenario,
  scenarioOrder,
  scenarioScore,
} from './walkAroundStep.js'

// The Defect Recognition Test (docs/modules/module-improvements-plan.md,
// 3.4): the library's entries, the rig pose its recipes ask for, and the
// scenario shape, old and new.

const HOTSPOT_IDS = walkAroundViewerHotspots.map((hotspot) => hotspot.id)
const PUBLIC = (path) => fileURLToPath(new URL(`../../public/${path}`, import.meta.url))

test('every library entry is well formed: a view, a known part, known recipe kinds, faults that apply, sounds in the bank', () => {
  for (const id of DEFECT_IDS) {
    const defect = DEFECT_LIBRARY[id]
    assert.ok(defect.label, `${id} label`)
    assert.ok(DEFECT_VIEWS.includes(defect.view), `${id} view`)
    if (defect.hotspotId !== null) assert.ok(HOTSPOT_IDS.includes(defect.hotspotId), `${id} hotspot ${defect.hotspotId}`)
    if (defect.view === 'exterior') assert.ok(defect.visual?.length, `${id} shows something on the model`)
    for (const step of defect.visual || []) {
      assert.ok(VISUAL_KINDS.includes(step.kind), `${id}: ${step.kind}`)
      if (step.kind === 'decal') {
        assert.ok(DECAL_TEXTURES.includes(step.texture), `${id}: texture ${step.texture}`)
        assert.ok(existsSync(PUBLIC(`textures/defects/${step.texture}.png`)), `${id}: ${step.texture}.png is built`)
      }
    }
    for (const [instrument, fault] of Object.entries(defect.cab?.instrumentFaults || {})) {
      assert.ok(INSTRUMENTS[instrument], `${id}: instrument ${instrument}`)
      assert.equal(faultProblem(fault, instrument), null, `${id}: ${instrument} fault`)
    }
    for (const [key, value] of Object.entries(defect.cab?.controlFaults || {})) {
      assert.equal(normalizeControlFaults({ [key]: value })[key], value, `${id}: ${key} is a known, in-range control fault`)
    }
    for (const fault of Object.values(defect.cab?.switchFaults || {})) assert.ok(SWITCH_FAULTS.includes(fault), `${id}: ${fault}`)
    for (const rule of defect.sounds || []) {
      const name = rule.loop || rule.with
      assert.ok(SOUND_BANK[name], `${id}: sound ${name}`)
      if (rule.loop) {
        assert.ok(SOUND_BANK[name].loop, `${id}: ${name} is a loop`)
        assert.ok(SOUND_WHILE.includes(rule.while), `${id}: while ${rule.while}`)
      }
      if (rule.replace) assert.ok(SOUND_BANK[rule.replace], `${id}: replaces ${rule.replace}`)
    }
  }
})

test('every view has defects to choose from, and a cab defect changes the cab', () => {
  for (const view of DEFECT_VIEWS) assert.ok(DEFECT_IDS.some((id) => DEFECT_LIBRARY[id].view === view))
  for (const id of DEFECT_IDS.filter((entry) => DEFECT_LIBRARY[entry].view === 'cab')) {
    const effects = cabEffects([id])
    const changes = Object.keys(effects.instrumentFaults).length + Object.keys(effects.controlFaults).length + Object.keys(effects.switchFaults).length + effects.sounds.length
    assert.ok(changes > 0, `${id} changes something in the cab`)
  }
})

test('cabEffects and exteriorEffects merge a scenario\'s defects; unknown ids are left out', () => {
  const cab = cabEffects(['brake-fade', 'charge-lamp-lit', 'nope'])
  assert.equal(cab.controlFaults.brakeFade, 0.5)
  assert.deepEqual(cab.instrumentFaults['lamp.charge'], { lamp: 'stays-lit' })
  assert.deepEqual(defectSoundNames(cab.sounds), ['brakeGrind'])
  const exterior = exteriorEffects(['engine-oil-leak', 'lpg-leak'])
  assert.ok(exterior.visual.some((step) => step.kind === 'puddle'))
  assert.ok(exterior.visual.some((step) => step.kind === 'vapour'))
  assert.deepEqual(defectSoundNames(exterior.sounds), ['lpgHiss'])
})

test('defectPose: a flat front tyre drops its own corner by what the tyre lost; the other front wheel and the rear pivot stay down', () => {
  const pose = defectPose(DEFECT_LIBRARY['flat-front-tyre'].visual)
  const centres = wheelCentres()
  const { amount } = DEFECT_LIBRARY['flat-front-tyre'].visual[0]
  assert.equal(pose.wheelSquash.FL, amount)
  const drop = -bodyLift(pose, centres.FL)
  assert.ok(Math.abs(drop - amount * 0.07857618934745933) < 1e-9, `FL drops ${drop}`)
  assert.ok(Math.abs(bodyLift(pose, centres.FR)) < 1e-9, 'FR stays')
  assert.ok(Math.abs(bodyLift(pose, { x: 0, z: centres.RR.z })) < 1e-9, 'the rear pivot stays')
})

test('defectPose: the mast, the carriage and a tine', () => {
  assert.equal(defectPose([]).mastTilt, null)
  assert.ok(defectPose(DEFECT_LIBRARY['mast-stuck-tilted'].visual).mastTilt > 0, 'held forward')
  const chains = defectPose(DEFECT_LIBRARY['uneven-lift-chains'].visual)
  assert.ok(chains.carriageRoll < 0, 'the carriage hangs low on the operator\'s left (+X)')
  const fork = defectPose(DEFECT_LIBRARY['bent-fork-tip'].visual)
  assert.ok(fork.forkBend.L > 0 && fork.forkBend.R === 0, 'only the left tine droops')
})

// --- The scenario shape ----------------------------------------------------

const yesNo = (overrides) => ({ question: 'Is this forklift usable for operation?', choices: ['Yes', 'No'], answer: 'No', feedback: 'f', ...overrides })

// The 3-scenario row a local database was seeded with, and the stock 7.
const OLD_THREE = [
  { id: 'leaking-oil', title: 'Scenario 1: Obvious defect - leaking oil', visualState: 'oil-leak', ...yesNo() },
  { id: 'good-forklift', title: 'Scenario 2: Good forklift', visualState: 'normal', ...yesNo({ answer: 'Yes' }) },
  { id: 'flat-tire', title: 'Scenario 3: Worn-out or flat tire', visualState: 'flat-tire', ...yesNo() },
]

test('normalizeScenario reads the old shape: visual states become defects, Yes/No becomes a usable question, the demo carries over', () => {
  const oil = normalizeScenario(OLD_THREE[0])
  assert.deepEqual(oil.defects, ['engine-oil-leak'])
  assert.equal(oil.view, 'exterior')
  assert.equal(oil.question.type, 'usable')
  assert.equal(oil.question.answer, 'No')
  assert.equal(oil.question.prompt, 'Is this forklift usable for operation?')
  assert.deepEqual(normalizeScenario(OLD_THREE[1]).defects, [])

  const brake = normalizeScenario(defectRecognitionScenarios.find((scenario) => scenario.deviceEffectId === 'brakes') || { id: 'b', visualState: 'normal', deviceEffectId: 'brakes', ...yesNo({ answer: 'Yes' }) })
  assert.equal(brake.demo, 'brake-test')

  assert.equal(normalizeScenario({ id: 'w', visualState: 'warning-light-blink', ...yesNo() }).view, 'cab')
  for (const ids of Object.values(LEGACY_VISUAL_STATES)) for (const id of ids) assert.ok(DEFECT_LIBRARY[id], id)
})

test('the old 3- and 7-scenario rows still grade, with answers saved before the redesign', () => {
  const seven = [
    ...OLD_THREE,
    { id: 'warning-light-blink', visualState: 'warning-light-blink', ...yesNo() },
    { id: 'red-light-beep', visualState: 'red-light-beep', ...yesNo() },
    { id: 'brakes-working', visualState: 'normal', deviceEffectId: 'brakes', demoLabel: 'Play brake test', ...yesNo({ answer: 'Yes' }) },
    { id: 'mast-tilt', visualState: 'mast-tilt', ...yesNo() },
  ]
  for (const scenarios of [OLD_THREE, seven]) {
    const data = { phase: 'defect-test', scenarios }
    const answers = Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario.answer]))
    // Progress saved before `firstAnswers` existed.
    const saved = { checks: [], devices: [], gauges: {}, scenarios: answers, started: false }
    assert.equal(isPhaseComplete(data, { ...emptyPhaseState(), ...saved }), true)
    assert.equal(scenarioScore(data, saved), scenarios.length)
    assert.deepEqual(firstAnswerScore(data, saved), { correct: 0, answered: 0, total: scenarios.length })
    assert.deepEqual(defectScenarioProblems(data), [])
  }
})

const newShape = (overrides) => ({
  id: 'f1',
  view: 'exterior',
  defects: ['flat-front-tyre'],
  question: { type: 'usable', prompt: '', choices: ['Yes', 'No'], answer: 'No' },
  demo: null,
  feedback: 'Report it.',
  ...overrides,
})

test('the four question types grade on the answer value; locate on the hotspot id', () => {
  const scenarios = [
    newShape(),
    newShape({ id: 'f2', question: { type: 'identify', choices: ['Flat tyre', 'Oil leak'], answer: 'Flat tyre' } }),
    newShape({ id: 'f3', question: { type: 'locate', answer: 'tires' } }),
    newShape({ id: 'f4', question: { type: 'action', choices: ['Report it', 'Use it'], answer: 'Report it' } }),
  ]
  const data = { phase: 'defect-test', scenarios }
  const state = { ...emptyPhaseState(), scenarios: { f1: 'No', f2: 'Flat tyre', f3: 'tires', f4: 'Use it' }, firstAnswers: { f1: 'No', f2: 'Oil leak', f3: 'tires', f4: 'Use it' } }
  assert.equal(scenarioScore(data, state), 3)
  assert.equal(isPhaseComplete(data, state), false)
  assert.deepEqual(firstAnswerScore(data, state), { correct: 2, answered: 4, total: 4 })
  state.scenarios.f4 = 'Report it'
  assert.equal(isPhaseComplete(data, state), true)
  // A usable question's choices are always the stored values, whatever was saved.
  assert.deepEqual(defectScenarios({ scenarios: [newShape({ question: { type: 'usable', choices: ['Ja'], answer: 'No' } })] })[0].question.choices, ['Yes', 'No'])
})

test('defectScenarioProblems: what the server refuses', () => {
  const problems = (scenario, options) => defectScenarioProblems({ scenarios: [scenario] }, options)
  assert.deepEqual(problems(newShape()), [])
  assert.match(problems(newShape({ defects: ['no-such-defect'] }))[0], /unknown defect/)
  assert.match(problems(newShape({ defects: ['brake-fade'] }))[0], /cab defect/)
  assert.match(problems(newShape({ view: 'cab', defects: ['brake-fade'], question: { type: 'locate', answer: 'brakes' } })).join(' '), /exterior view/)
  assert.match(problems(newShape({ question: { type: 'locate', answer: 'nowhere' } }), { hotspotIds: ['tires'] })[0], /not a walk-around part/)
  assert.match(problems(newShape({ question: { type: 'identify', choices: ['Only one'], answer: 'Only one' } }))[0], /two choices/)
  assert.match(problems(newShape({ question: { type: 'action', choices: ['A', 'B'], answer: 'C' } }))[0], /one of its choices/)
  assert.match(problems(newShape({ question: { type: 'guess', answer: 'x' } })).join(' '), /unknown question type/)
  assert.match(problems(newShape({ demo: 'fireworks' }))[0], /unknown demo/)
  assert.match(defectScenarioProblems({ scenarios: [newShape(), newShape()] })[0], /used twice/)
})

test('scenarioOrder: a shuffle that is stable for a learner and step, differs between learners, and keeps every scenario', () => {
  const scenarios = Array.from({ length: 10 }, (_, index) => ({ id: `s${index}` }))
  const order = (seed) => scenarioOrder(scenarios, seed).map((scenario) => scenario.id)
  assert.deepEqual(order('learner-a:defect-recognition'), order('learner-a:defect-recognition'))
  assert.notDeepEqual(order('learner-a:defect-recognition'), order('learner-b:defect-recognition'))
  assert.deepEqual([...order('learner-a:defect-recognition')].sort(), scenarios.map((scenario) => scenario.id).sort())
})

test('locate candidates are the exterior walk-around parts with a marker', () => {
  const ids = locateCandidates(walkAroundViewerHotspots).map((hotspot) => hotspot.id)
  assert.ok(ids.includes('tires') && ids.includes('forks'))
  assert.ok(!ids.includes('horn') && !ids.includes('ignition'))
  for (const id of DEFECT_IDS.filter((entry) => DEFECT_LIBRARY[entry].view === 'exterior')) {
    assert.ok(ids.includes(DEFECT_LIBRARY[id].hotspotId), `${id}'s part can be clicked`)
  }
})

// --- In the cab -------------------------------------------------------------

test('a seat belt that will not latch goes on, then lets go; a healthy one stays on', () => {
  const faulty = createDashboardSource({ switchFaults: { seatbelt: 'springs-back' } })
  faulty.toggle('seatbelt')
  assert.equal(faulty.switches.seatbelt, true)
  faulty.tick(SPRING_BACK_SECONDS / 2)
  assert.equal(faulty.switches.seatbelt, true)
  faulty.tick(SPRING_BACK_SECONDS)
  assert.equal(faulty.switches.seatbelt, false)
  assert.equal(faulty.read().seatbelt, false, 'so the interlock never sees it fastened')

  const healthy = createDashboardSource()
  healthy.toggle('seatbelt')
  healthy.tick(10)
  assert.equal(healthy.switches.seatbelt, true)
})

test('the overheating gauge chimes as it passes its alarm level, and again while it stays there', () => {
  const alarm = createFaultAlarm(DEFECT_LIBRARY['engine-overheating'].cab.instrumentFaults)
  assert.equal(alarm.update({ temp: 0.5 }, 0.1), false)
  assert.equal(alarm.update({ temp: 0.9 }, 0.1), true)
  assert.equal(alarm.update({ temp: 0.95 }, 1), false)
  let rang = false
  for (let t = 0; t < ALARM_REPEAT_S + 0.5; t += 0.25) rang = alarm.update({ temp: 0.97 }, 0.25) || rang
  assert.equal(rang, true)
  assert.equal(createFaultAlarm({ 'lamp.charge': { lamp: 'stays-lit' } }).update({ temp: 1 }, 1), false, 'only gauges with an alarm level')
})

test('defect sounds: a knock while the engine runs, a grind while braking on the move, a click for the horn', () => {
  const state = (overrides) => ({ truck: { engineOn: true, speed: kmh(5), ...overrides.truck }, frame: { controls: { ...neutralControls(), ...overrides.controls } } })
  const knock = [{ loop: 'engineKnock', while: 'engine' }]
  assert.equal(defectLoopTargets(knock, state({})).engineKnock, 1)
  assert.equal(defectLoopTargets(knock, state({ truck: { engineOn: false } })).engineKnock, 0)
  const grind = [{ loop: 'brakeGrind', while: 'braking' }]
  assert.equal(defectLoopTargets(grind, state({ controls: { brake: 1 } })).brakeGrind, 1)
  assert.equal(defectLoopTargets(grind, state({ controls: { brake: 1 }, truck: { speed: 0 } })).brakeGrind, 0)
  assert.equal(defectLoopTargets(grind, state({})).brakeGrind, 0)
  assert.equal(replacedSound(DEFECT_LIBRARY['horn-not-working'].sounds, 'horn'), 'hornClick')
  assert.equal(replacedSound([], 'horn'), 'horn')
})
