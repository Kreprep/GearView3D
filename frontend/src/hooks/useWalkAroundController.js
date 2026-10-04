import { useEffect, useRef, useState } from 'react'
import { engineOnDeviceEffects, resolveEffectLamps } from '../data/viewerHotspots'
import { SOUND_BANK } from '../data/soundBank'
import { getAudioEngine } from '../lib/audio/audioEngine'
import { getHotspotDetails } from '../lib/api'
import { preloadImages } from '../lib/imagePreload'
import { defectScenarios, isPhaseComplete, NO_CAB_STATUS, phaseStateFor, SCENARIO_DEMOS, scenarioOrder, withPhaseState } from '../lib/walkAroundStep'
import { useInspectionHotspots } from './useInspectionHotspots'
import { getStoredProgress } from '../lib/progressService'
import { buildSimulationState, withStepComplete } from '../lib/simulationProgress'

const ENGINE_START_DELAY_MS = 1500

// The samples the device tests play, loaded up front so the first test is
// heard on time.
const DEVICE_SOUNDS = [...new Set(Object.values(engineOnDeviceEffects).map((effect) => effect.sound).filter(Boolean))]
const NO_SOUND = () => {}

function unique(items) {
  return [...new Set(items)]
}

// Every walk-around phase (engine-off, engine-on, defect-test) grades itself
// against its own row's data, so an inspection check or gauge an admin adds
// is required and one they delete stops blocking completion.
//
// The engine-on phase runs in the cab (components/inspection/
// CabInspectionViewer.jsx): its device tests tick when the inspection
// monitor sees them done, not on a click, and the start there is recorded
// for the step (`started`) as well as module-wide (`engineStarted`).
//
// A defect test's scenarios are met in an order shuffled per learner
// (`learnerId`) and step (decision D-1, scenarioOrder() in
// lib/walkAroundStep.js), and the first answer to each is kept as the score.
export function useWalkAroundController({ hasWalkAround, moduleSlug, steps, gradedStepIds, simulation, updateSimulation, changeStep, learnerId }) {
  const { hotspots, loading: hotspotsLoading, error: hotspotsError } = useInspectionHotspots(hasWalkAround)
  const [partDetails, setPartDetails] = useState({})
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [focusedHotspotId, setFocusedHotspotId] = useState(null)
  const [activeDeviceEffect, setActiveDeviceEffect] = useState(null)
  const [activeScenarioId, setActiveScenarioId] = useState(null)
  // The cab's start-up switches, as the engine-on scene last reported them.
  const [cabStatus, setCabStatus] = useState(NO_CAB_STATUS)
  const deviceEffectTimer = useRef(null)
  const engineStartTimer = useRef(null)
  // Cuts off the device sound that is playing, if any.
  const stopDeviceSound = useRef(NO_SOUND)

  useEffect(() => {
    if (!hasWalkAround) return

    getAudioEngine().preload(DEVICE_SOUNDS)

    getHotspotDetails()
      .then((details) => {
        setPartDetails(details)
        preloadImages(Object.values(details).map((detail) => detail.image))
      })
      .catch(() => {})
  }, [hasWalkAround])

  useEffect(() => () => {
    clearTimeout(deviceEffectTimer.current)
    clearTimeout(engineStartTimer.current)
    stopDeviceSound.current()
  }, [])

  // One device sound at a time, from the same bank the driving simulation
  // plays (data/soundBank.js): a new test cuts off the previous one.
  const playDeviceSound = (name, duration) => {
    stopDeviceSound.current()
    const engine = getAudioEngine()
    if (!SOUND_BANK[name]?.loop) {
      stopDeviceSound.current = engine.playOneShot(name)
      return
    }
    const loop = engine.createLoop(name)
    loop.setGain(1)
    const timer = setTimeout(loop.stop, duration)
    stopDeviceSound.current = () => {
      clearTimeout(timer)
      loop.stop()
    }
  }

  const buildDetail = (id, fallback) => {
    const detail = partDetails[id] || {}
    return {
      title: detail.title || fallback.title,
      subtitle: detail.subtitle || fallback.subtitle,
      image: detail.image || fallback.image,
      description: detail.description || fallback.description,
    }
  }

  const triggerDeviceEffect = (deviceId) => {
    const effect = engineOnDeviceEffects[deviceId]
    if (!effect) return

    // Lamps follow the hotspot, so repositioning a hotspot keeps the effect aligned.
    const hotspot = hotspots.find((entry) => entry.id === deviceId)
    clearTimeout(deviceEffectTimer.current)
    setActiveDeviceEffect({ ...effect, lamps: resolveEffectLamps(effect, hotspot) })
    if (effect.sound) playDeviceSound(effect.sound, effect.duration)
    deviceEffectTimer.current = setTimeout(() => setActiveDeviceEffect(null), effect.duration)
  }

  // Walk-around answers are written against the *stored* snapshot rather than
  // the one this render closed over: several markers can be clicked before
  // React re-renders, and each click must build on the previous one.
  const liveSimulation = () =>
    buildSimulationState(getStoredProgress().simulations[moduleSlug] || {}, gradedStepIds)

  // Saves the phase's answers and re-grades the step in one write, so the step
  // list ticks over the moment the last item is answered. `patchFor` receives
  // the phase's current state and returns what to merge into it.
  const savePhase = (step, patchFor, extra = {}) => {
    const live = liveSimulation()
    const patch = typeof patchFor === 'function' ? patchFor(phaseStateFor(live, step.id)) : patchFor
    const walkAround = withPhaseState(live, step.id, patch)
    const merged = { ...live, ...extra, ...walkAround }
    const complete = isPhaseComplete(step.walkAround, phaseStateFor(merged, step.id), merged.engineStarted)

    updateSimulation(
      moduleSlug,
      buildSimulationState({ ...merged, ...(complete ? withStepComplete(merged, step.id) : {}) }, gradedStepIds),
    )
  }

  const ignitionIdFor = (step) =>
    step.walkAround?.ignitionHotspotId ||
    hotspots.find((hotspot) => hotspot.state === 'ignition')?.id ||
    'ignition'

  const handleCheck = (step, check) => {
    const state = phaseStateFor(liveSimulation(), step.id)
    const checks = unique([...state.checks, check.id])
    const justCompleted =
      !state.checks.includes(check.id) &&
      checks.length === (step.walkAround.checks || []).length &&
      step.walkAround.requireEngineStart &&
      !simulation.engineStarted

    savePhase(step, (current) => ({ checks: unique([...current.checks, check.id]) }))
    setFocusedHotspotId(justCompleted ? ignitionIdFor(step) : check.id)
    setSelectedDetail({
      ...buildDetail(check.id, {
        title: check.label,
        subtitle: check.targetArea,
        description: check.found,
        image: check.image,
      }),
      status: check.feedback,
      statusType: check.status === 'safe' ? 'correct' : 'warning',
    })
  }

  const startEngine = (step) => {
    const state = phaseStateFor(liveSimulation(), step.id)
    const checks = step.walkAround.checks || []
    const walkAroundDone = checks.length > 0 && checks.every((check) => state.checks.includes(check.id))
    if (!walkAroundDone || simulation.engineStarted) return

    savePhase(step, () => ({}), { engineStarted: true })
    setFocusedHotspotId(ignitionIdFor(step))
    triggerDeviceEffect(ignitionIdFor(step))
    setSelectedDetail({
      ...buildDetail(ignitionIdFor(step), {
        title: 'Ignition Switch',
        subtitle: 'Engine start',
        description: 'Key turned. The starter cranks and the engine settles to idle.',
      }),
      status: 'Engine started. Continue with the engine-on checks.',
      statusType: 'correct',
    })

    // Let the start-up sound play before moving on to the engine-on step.
    clearTimeout(engineStartTimer.current)
    engineStartTimer.current = setTimeout(() => {
      const nextIndex = steps.findIndex((entry) => entry.walkAround?.phase === 'engine-on')
      if (nextIndex >= 0) changeStep(nextIndex)
    }, ENGINE_START_DELAY_MS)
  }

  // The cab's events: the engine started in this step's cab, and device
  // tests the inspection monitor saw done.
  const handleCabEvent = (step) => (event) => {
    if (event.type === 'engine-on') {
      savePhase(step, () => ({ started: true }), { engineStarted: true })
    } else if (event.type === 'devices-tested') {
      savePhase(step, (current) => ({ devices: unique([...current.devices, ...event.ids]) }))
    }
  }

  const handleGauge = (step, gauge, choice) => {
    savePhase(step, (current) => ({ gauges: { ...current.gauges, [gauge.id]: choice } }))
    const correct = choice === gauge.answer
    setSelectedDetail({
      title: gauge.label,
      subtitle: 'Dashboard indicator',
      image: gauge.image,
      description: `Reading: ${gauge.reading}`,
      status: correct ? gauge.correctFeedback : gauge.incorrectFeedback,
      statusType: correct ? 'correct' : 'incorrect',
    })
  }

  // `scenario` is normalized; `answer` is a choice's value, or for a locate
  // question the clicked part's hotspot id.
  const handleScenario = (step, scenario, answer) => {
    savePhase(step, (current) => ({
      scenarios: { ...current.scenarios, [scenario.id]: answer },
      firstAnswers: scenario.id in (current.firstAnswers || {}) ? current.firstAnswers : { ...current.firstAnswers, [scenario.id]: answer },
    }))
  }

  // Clicking a marker runs the engine-off check it belongs to; anything else
  // just opens its detail card. (In the cab the click is also seen by the
  // inspection monitor, which ticks a device tested by its marker.)
  const handleWalkAroundHotspot = (step, hotspot) => {
    const data = step.walkAround || {}

    if (hotspot.id === ignitionIdFor(step) && data.phase === 'engine-off') {
      startEngine(step)
      return
    }

    const check = data.phase === 'engine-off' && (data.checks || []).find((item) => item.id === hotspot.id)
    if (check) {
      handleCheck(step, check)
      return
    }

    // A device's card carries its feedback once it has been tested.
    const device = (data.devices || []).find((item) => item.id === hotspot.id)
    const tested = device && phaseStateFor(liveSimulation(), step.id).devices.includes(device.id)

    setFocusedHotspotId(hotspot.id)
    setSelectedDetail({
      ...buildDetail(hotspot.id, {
        title: hotspot.label,
        subtitle: hotspot.category,
        description: hotspot.inspect || hotspot.description,
        image: hotspot.image,
      }),
      status: tested ? device.feedback : hotspot.feedback,
      statusType: hotspot.result === 'unsafe' ? 'warning' : 'correct',
    })
  }

  // The item after whatever selectedDetail is currently showing, so the
  // detail panel can offer a "Next Part" shortcut instead of forcing Back
  // then a fresh click for engine-off checks, where the cards are meant to
  // be worked through in order. Engine-on devices are tested by doing them
  // in the cab, so a card is no shortcut there. Returns data, not a handler,
  // so the click callback stays a plain inline arrow at the call site.
  const nextWalkAroundItem = (step) => {
    const data = step.walkAround || {}
    const state = phaseStateFor(simulation, step.id)

    if (data.phase === 'engine-off') {
      const check = (data.checks || []).find((item) => !state.checks.includes(item.id))
      return check ? { kind: 'check', item: check } : null
    }

    return null
  }

  const walkAroundHandlers = (step) => ({
    onCheck: (check) => handleCheck(step, check),
    onStartEngine: () => startEngine(step),
    onGauge: (gauge, choice) => handleGauge(step, gauge, choice),
    onSelectScenario: setActiveScenarioId,
    onAnswerScenario: (scenario, answer) => handleScenario(step, scenario, answer),
    onPlayDemo: (scenario) => triggerDeviceEffect(SCENARIO_DEMOS[scenario.demo]),
  })

  // A defect test's scenarios, normalized, in this learner's order.
  const scenariosFor = (step) => scenarioOrder(defectScenarios(step.walkAround), `${learnerId ?? 'guest'}:${step.id}`)

  const scenarioIdFor = (step) => {
    const scenarios = scenariosFor(step)
    return scenarios.some((entry) => entry.id === activeScenarioId) ? activeScenarioId : scenarios[0]?.id || null
  }

  const activeScenarioFor = (step) => {
    const id = scenarioIdFor(step)
    return scenariosFor(step).find((entry) => entry.id === id) || null
  }

  // A locate question answered by clicking a part on the model.
  const handleLocate = (step, hotspot) => {
    const scenario = activeScenarioFor(step)
    if (scenario?.question.type === 'locate') handleScenario(step, scenario, hotspot.id)
  }

  return {
    hotspots,
    hotspotsLoading,
    hotspotsError,
    selectedDetail,
    setSelectedDetail,
    focusedHotspotId,
    setFocusedHotspotId,
    activeDeviceEffect,
    activeScenarioId,
    handleCheck,
    handleGauge,
    handleCabEvent,
    cabStatus,
    setCabStatus,
    handleWalkAroundHotspot,
    walkAroundHandlers,
    scenariosFor,
    scenarioIdFor,
    activeScenarioFor,
    handleLocate,
    nextWalkAroundItem,
  }
}
