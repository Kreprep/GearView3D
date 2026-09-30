import { useEffect, useRef, useState } from 'react'
import { engineOnDeviceEffects, resolveEffectLamps } from '../data/viewerHotspots'
import { SOUND_BANK } from '../data/soundBank'
import { getAudioEngine } from '../lib/audio/audioEngine'
import { getHotspotDetails } from '../lib/api'
import { preloadImages } from '../lib/imagePreload'
import { isPhaseComplete, phaseStateFor, withPhaseState } from '../lib/walkAroundStep'
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
export function useWalkAroundController({ hasWalkAround, moduleSlug, steps, gradedStepIds, simulation, updateSimulation, changeStep }) {
  const { hotspots, loading: hotspotsLoading, error: hotspotsError } = useInspectionHotspots(hasWalkAround)
  const [partDetails, setPartDetails] = useState({})
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [focusedHotspotId, setFocusedHotspotId] = useState(null)
  const [activeDeviceEffect, setActiveDeviceEffect] = useState(null)
  const [activeScenarioId, setActiveScenarioId] = useState(null)
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

  const handleDevice = (step, device, hotspot) => {
    savePhase(step, (current) => ({ devices: unique([...current.devices, device.id]) }))
    setFocusedHotspotId(device.id)
    triggerDeviceEffect(device.id)
    setSelectedDetail({
      ...buildDetail(device.id, {
        title: hotspot?.label || device.label,
        subtitle: hotspot?.category || 'Engine-on check',
        description: hotspot?.inspect,
        image: hotspot?.image,
      }),
      status: device.feedback,
      statusType: 'correct',
    })
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

  const handleScenario = (step, scenario, choice) => {
    savePhase(step, (current) => ({ scenarios: { ...current.scenarios, [scenario.id]: choice } }))
  }

  // Clicking a marker runs the check it belongs to; anything else just opens
  // its detail card.
  const handleWalkAroundHotspot = (step, hotspot) => {
    const data = step.walkAround || {}

    if (hotspot.id === ignitionIdFor(step) && data.phase === 'engine-off') {
      startEngine(step)
      return
    }

    const check = (data.checks || []).find((item) => item.id === hotspot.id)
    if (check) {
      handleCheck(step, check)
      return
    }

    const device = (data.devices || []).find((item) => item.id === hotspot.id)
    if (device) {
      handleDevice(step, device, hotspot)
      return
    }

    setFocusedHotspotId(hotspot.id)
    setSelectedDetail({
      ...buildDetail(hotspot.id, {
        title: hotspot.label,
        subtitle: hotspot.category,
        description: hotspot.inspect || hotspot.description,
        image: hotspot.image,
      }),
      status: hotspot.feedback,
      statusType: hotspot.result === 'unsafe' ? 'warning' : 'correct',
    })
  }

  // The item after whatever selectedDetail is currently showing, so the
  // detail panel can offer a "Next Part" shortcut instead of forcing Back
  // then a fresh click for engine-off checks and engine-on device tests -
  // the two flows where the cards are meant to be worked through in order.
  // Gauges and hotspots opened outside a check/device have no defined
  // "next", so they only ever show Back. Returns data, not a handler, so the
  // click callback stays a plain inline arrow at the call site.
  const nextWalkAroundItem = (step) => {
    const data = step.walkAround || {}
    const state = phaseStateFor(simulation, step.id)

    if (data.phase === 'engine-off') {
      const check = (data.checks || []).find((item) => !state.checks.includes(item.id))
      return check ? { kind: 'check', item: check } : null
    }

    if (data.phase === 'engine-on') {
      const device = (data.devices || []).find((item) => !state.devices.includes(item.id))
      return device ? { kind: 'device', item: device } : null
    }

    return null
  }

  const walkAroundHandlers = (step) => ({
    onCheck: (check) => handleCheck(step, check),
    onStartEngine: () => startEngine(step),
    onDevice: (device) => handleDevice(step, device, hotspots.find((entry) => entry.id === device.id)),
    onGauge: (gauge, choice) => handleGauge(step, gauge, choice),
    onSelectScenario: setActiveScenarioId,
    onAnswerScenario: (scenario, choice) => handleScenario(step, scenario, choice),
    onPlayDemo: (scenario) => triggerDeviceEffect(scenario.deviceEffectId),
  })

  const scenarioIdFor = (step) =>
    activeScenarioId && (step.walkAround?.scenarios || []).some((entry) => entry.id === activeScenarioId)
      ? activeScenarioId
      : step.walkAround?.scenarios?.[0]?.id || null

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
    handleDevice,
    handleWalkAroundHotspot,
    walkAroundHandlers,
    scenarioIdFor,
    nextWalkAroundItem,
  }
}
