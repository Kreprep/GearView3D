import { useEffect, useMemo, useRef, useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ModuleSummary from './components/ModuleSummary'
import SimulationPageLayout from './components/SimulationPageLayout'
import { BriefingScene, BriefingTask } from './components/ModuleBriefing'
import { ReportingActivity, ShutdownSequenceActivity } from './components/ModuleActivities'
import { ACTIVITY_IDS } from './lib/activitySteps'
import { ChecklistScene, ModuleRowsTask, QuizScene } from './components/ModuleChecklistStep'
import { WalkAroundScene, WalkAroundTask } from './components/WalkAroundStep'
import { engineOnDeviceEffects, resolveEffectLamps, walkAroundDefectOverlays } from './data/viewerHotspots'
import { playDeviceSound, stopDeviceSound } from './lib/deviceAudio'
import { getEquipment, getHotspotDetails } from './lib/api'
import {
  isPhaseComplete,
  phaseStateFor,
  withPhaseState,
} from './lib/walkAroundStep'
import { resolveVehicleProfile } from './lib/vehicleProfile'
import { useInspectionHotspots } from './hooks/useInspectionHotspots'
import { useModuleCourses } from './hooks/useModuleCourses'
import { useModuleRecord } from './hooks/useModuleRecord'
import { useProgress } from './hooks/useProgress'
import { courseTaskCopy } from './lib/courseGoals'
import { legacyStepFieldsFor, REQUIRED_CONTROL_KEYS } from './lib/legacyStepFields'
import { moduleObjectives, nextModuleRoute } from './lib/moduleContent'
import { getStoredProgress } from './lib/progressService'
import { buildSimulationState, isStepComplete, withStepComplete } from './lib/simulationProgress'
import { equipmentUsageModules } from './lib/trainingData'
import './GenericModulePage.css'

const NEXT_MODULE_DELAY_MS = 1400
const ENGINE_START_DELAY_MS = 1500
// Pulled in close to the operator station so the cockpit hotspots are readable.
const ENGINE_ON_CAMERA = { position: [1.05, 0.82, 0.95], fov: 46, minDistance: 0.4, maxDistance: 2.8 }

function unique(items) {
  return [...new Set(items)]
}

// The one module page for every equipment's course-backed modules, Forklift
// included - it renders whatever typed step rows the module has (briefing,
// driving, checklist, quiz, activity, summary), so the only module page left
// outside it is Forklift's hardcoded Walk-Around Check.
//
// `driving`-kind steps render through DrivingSimulationViewer with this
// equipment's vehicle profile (model, rig node names, footprint, HUD copy,
// fail messages - see lib/vehicleProfile.js). An equipment with no model of
// its own falls back to forklift.glb, so a driving step is never an empty
// scene; one whose model has no rig nodes simply drives as a solid body.
function GenericModulePage({ equipmentId, moduleSlug, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  // Forklift's modules keep their static definitions as the fallback record
  // (objectives, fullTitle); admin-created modules fall back to a blank
  // fullTitle deliberately - useModuleRecord only overrides a field when the
  // DB row has a non-empty value, so a non-blank fallback would permanently
  // shadow a row whose fullTitle hasn't been filled in yet.
  const module = useModuleRecord(
    moduleSlug,
    equipmentUsageModules.find((item) => item.slug === moduleSlug) || { title: 'Module', fullTitle: '' },
  )
  const { steps, stepById, courseById, loading, error } = useModuleCourses(moduleSlug)
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [lastFail, setLastFail] = useState(null)
  const [shutdownPicked, setShutdownPicked] = useState([])
  const [wrongPickId, setWrongPickId] = useState(null)
  const [reportAnswers, setReportAnswers] = useState({})
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [focusedHotspotId, setFocusedHotspotId] = useState(null)
  const [activeDeviceEffect, setActiveDeviceEffect] = useState(null)
  const [activeScenarioId, setActiveScenarioId] = useState(null)
  const [partDetails, setPartDetails] = useState({})
  const [equipmentRecord, setEquipmentRecord] = useState(null)
  const deviceEffectTimer = useRef(null)
  const engineStartTimer = useRef(null)
  const legacyStepFields = legacyStepFieldsFor(moduleSlug)

  // Walk-around steps need this module's inspection markers; every other
  // module skips the request entirely.
  const hasWalkAround = steps.some((step) => step.kind === 'walk-around')
  const { hotspots, loading: hotspotsLoading, error: hotspotsError } = useInspectionHotspots(
    equipmentId,
    hasWalkAround,
  )

  // Walk-around and driving steps both need the equipment row - the first for
  // its model, the second for its vehicle profile - and only walk-around steps
  // need the editable part-detail cards.
  const hasDriving = steps.some((step) => step.kind === 'driving')

  useEffect(() => {
    if (!hasWalkAround && !hasDriving) return undefined

    getEquipment()
      .then((rows) => setEquipmentRecord(rows.find((row) => row.id === equipmentId) || null))
      .catch(() => {})
    if (hasWalkAround) getHotspotDetails(equipmentId).then(setPartDetails).catch(() => {})

    return undefined
  }, [hasWalkAround, hasDriving, equipmentId])

  const vehicleProfile = useMemo(() => resolveVehicleProfile(equipmentRecord), [equipmentRecord])

  useEffect(() => () => {
    clearTimeout(deviceEffectTimer.current)
    clearTimeout(engineStartTimer.current)
    stopDeviceSound()
  }, [])

  // Steps backed by a driving course are graded, as are walk-around steps and
  // the built-in activities; briefing, checklist, quiz and summary are not.
  const gradedStepIds = useMemo(
    () =>
      steps
        .filter(
          (step) =>
            courseById[step.id] ||
            step.kind === 'walk-around' ||
            (step.kind === 'activity' && ACTIVITY_IDS.includes(step.content?.activityId)),
        )
        .map((step) => step.id),
    [steps, courseById],
  )
  const simulation = buildSimulationState(
    {
      ...savedSimulation,
      engineStarted: savedSimulation.engineStarted || false,
      keysUsedByStep: savedSimulation.keysUsedByStep || {},
      failedAttempts: savedSimulation.failedAttempts || 0,
      shutdownMistakes: savedSimulation.shutdownMistakes || 0,
    },
    gradedStepIds,
    legacyStepFields,
  )
  const shutdownComplete = isStepComplete(simulation, 'shutdown-sequence')
  const reportingComplete = isStepComplete(simulation, 'reporting')

  // Both activities are graded against their own row's content, so a prompt an
  // admin adds is required and one they delete stops blocking completion.
  const activityContent = (activityId) =>
    steps.find((step) => step.content?.activityId === activityId)?.content || {}
  const shutdownActions = activityContent('shutdown-sequence').actions || []
  const shutdownDisplayOrder = activityContent('shutdown-sequence').displayOrder || []
  const reportPrompts = activityContent('reporting').prompts || []

  const saveSimulation = (partial) => {
    const next = buildSimulationState({ ...simulation, ...partial }, gradedStepIds, legacyStepFields)
    updateSimulation(moduleSlug, next)
    return next
  }

  const markStepComplete = (stepId, partial = {}) =>
    saveSimulation({ ...partial, ...withStepComplete(simulation, stepId) })

  const keysUsedFor = (stepId) => simulation.keysUsedByStep?.[stepId] || []

  // A `free` course has no checkpoints, pallet or bay to complete against, so
  // it grades the only thing it can: the engine running and every control key
  // tried at least once. Tracked per step id, so more than one free-practice
  // step can exist in a module.
  const saveFreePractice = (stepId, partial) => {
    const merged = { ...simulation, ...partial }
    const keysUsed = merged.keysUsedByStep?.[stepId] || []
    const done = merged.engineStarted && REQUIRED_CONTROL_KEYS.every((key) => keysUsed.includes(key))
    saveSimulation(done ? { ...partial, ...withStepComplete(simulation, stepId) } : partial)
  }

  const handleDrivingEvent = (currentStep) => (event) => {
    const isFreePractice = courseById[currentStep.id]?.goalType === 'free'

    if (event.type === 'key-active') {
      if (isFreePractice && !keysUsedFor(currentStep.id).includes(event.key)) {
        saveFreePractice(currentStep.id, {
          keysUsedByStep: {
            ...simulation.keysUsedByStep,
            [currentStep.id]: unique([...keysUsedFor(currentStep.id), event.key]),
          },
        })
      }
      return
    }

    if (event.type === 'engine-on') {
      if (isFreePractice) saveFreePractice(currentStep.id, { engineStarted: true })
      return
    }

    if (event.type === 'sim-failed') {
      setLastFail({ stepId: currentStep.id, title: event.title, message: event.message })
      saveSimulation({ failedAttempts: simulation.failedAttempts + 1 })
      return
    }

    // Whichever goal the course defines, reaching it completes that step.
    if (event.type === 'course-complete' || event.type === 'pallet-delivered' || event.type === 'parking-complete') {
      if (gradedStepIds.includes(currentStep.id)) {
        setLastFail(null)
        markStepComplete(currentStep.id)
      }
    }
  }

  const handleShutdownPick = (action) => {
    if (shutdownComplete) return
    const expectedOrder = shutdownPicked.length + 1

    if (action.order === expectedOrder) {
      const nextPicked = [...shutdownPicked, action.id]
      setShutdownPicked(nextPicked)
      setWrongPickId(null)
      if (nextPicked.length === shutdownActions.length) {
        saveSimulation(withStepComplete(simulation, 'shutdown-sequence'))
      }
    } else {
      setWrongPickId(action.id)
      saveSimulation({ shutdownMistakes: simulation.shutdownMistakes + 1 })
      setTimeout(() => setWrongPickId(null), 700)
    }
  }

  const handleReportAnswer = (prompt, choice) => {
    if (reportingComplete) return
    const correct = choice === prompt.shouldReport
    const nextAnswers = { ...reportAnswers, [prompt.id]: { choice, correct } }
    setReportAnswers(nextAnswers)

    const allCorrect = reportPrompts.every((item) => nextAnswers[item.id]?.correct)
    if (allCorrect) {
      saveSimulation(withStepComplete(simulation, 'reporting'))
    }
  }

  // --- Walk-around steps ----------------------------------------------------
  // Every phase grades itself against its own row's data, so an inspection
  // check or gauge an admin adds is required and one they delete stops
  // blocking completion.

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
    if (effect.sound) playDeviceSound(effect.sound)
    deviceEffectTimer.current = setTimeout(() => setActiveDeviceEffect(null), effect.duration)
  }

  // Walk-around answers are written against the *stored* snapshot rather than
  // the one this render closed over: several markers can be clicked before
  // React re-renders, and each click must build on the previous one.
  const liveSimulation = () =>
    buildSimulationState(getStoredProgress().simulations[moduleSlug] || {}, gradedStepIds, legacyStepFields)

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
      buildSimulationState(
        { ...merged, ...(complete ? withStepComplete(merged, step.id) : {}) },
        gradedStepIds,
        legacyStepFields,
      ),
    )
  }

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

  const ignitionIdFor = (step) =>
    step.walkAround?.ignitionHotspotId ||
    hotspots.find((hotspot) => hotspot.state === 'ignition')?.id ||
    'ignition'

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

  const walkAroundHandlers = (step) => ({
    onCheck: (check) => handleCheck(step, check),
    onStartEngine: () => startEngine(step),
    onDevice: (device) => handleDevice(step, device, hotspots.find((entry) => entry.id === device.id)),
    onGauge: (gauge, choice) => handleGauge(step, gauge, choice),
    onSelectScenario: setActiveScenarioId,
    onAnswerScenario: (scenario, choice) => handleScenario(step, scenario, choice),
  })

  const scenarioIdFor = (step) =>
    activeScenarioId && (step.walkAround?.scenarios || []).some((entry) => entry.id === activeScenarioId)
      ? activeScenarioId
      : step.walkAround?.scenarios?.[0]?.id || null

  const completeModule = () => {
    if (!simulation.complete && gradedStepIds.length > 0) return

    // The summary step's stored nextRoute wins when it resolves; otherwise
    // return to the equipment's module list to pick the next one.
    setTimeout(
      () => onNavigate?.(nextModuleRoute(steps, equipmentId) || `/training/${equipmentId}/modules`),
      NEXT_MODULE_DELAY_MS,
    )
  }

  const getStepCanProceed = (stepId) =>
    gradedStepIds.includes(stepId) ? isStepComplete(simulation, stepId) : true

  const changeStep = (nextIndex) => {
    setLastFail(null)
    setSelectedDetail(null)
    setFocusedHotspotId(null)
    setCurrentStepIndex(nextIndex)
  }

  // Steps arrive after the first render and an admin can delete one, so the
  // saved index is clamped rather than indexed into blindly.
  const stepIndex = Math.min(currentStepIndex, Math.max(steps.length - 1, 0))

  const renderScene = ({ currentStep }) => {
    const step = stepById[currentStep.id]

    if (step?.kind === 'walk-around') {
      return (
        <WalkAroundScene
          data={step.walkAround}
          hotspots={hotspots}
          modelUrl={equipmentRecord?.modelUrl || undefined}
          modelScale={equipmentRecord?.modelScale}
          state={phaseStateFor(simulation, step.id)}
          engineStarted={simulation.engineStarted}
          activeScenarioId={scenarioIdFor(step)}
          selectedHotspotId={focusedHotspotId}
          deviceEffect={activeDeviceEffect}
          defectOverlays={walkAroundDefectOverlays}
          cameraPreset={step.walkAround?.phase === 'engine-on' ? ENGINE_ON_CAMERA : undefined}
          isAdmin={isAdmin}
          onHotspotSelect={(hotspot) => handleWalkAroundHotspot(step, hotspot)}
          onResetView={() => setFocusedHotspotId(null)}
        />
      )
    }

    if (step?.kind === 'briefing') {
      return <BriefingScene content={step.content} />
    }

    if (step?.kind === 'checklist') {
      return <ChecklistScene content={step.content} moduleSlug={moduleSlug} title={step.title} />
    }

    if (step?.kind === 'quiz') {
      return <QuizScene content={step.content} moduleSlug={moduleSlug} title={step.title} />
    }

    const course = courseById[currentStep.id]

    if (course) {
      return (
        <div className="load-scene-wrap">
          <DrivingSimulationViewer
            profile={vehicleProfile}
            course={course}
            onEvent={handleDrivingEvent(currentStep)}
            isAdmin={isAdmin}
          />
        </div>
      )
    }

    if (step?.content?.activityId === 'shutdown-sequence') {
      return (
        <ShutdownSequenceActivity
          actions={shutdownActions}
          displayOrder={shutdownDisplayOrder}
          pickedIds={shutdownPicked}
          completed={shutdownComplete}
          wrongPickId={wrongPickId}
          onPick={handleShutdownPick}
        />
      )
    }

    if (step?.content?.activityId === 'reporting') {
      return (
        <ReportingActivity
          prompts={reportPrompts}
          answers={reportAnswers}
          completed={reportingComplete}
          onAnswer={handleReportAnswer}
        />
      )
    }

    return null
  }

  const renderDrivingTask = (currentStep) => {
    const course = courseById[currentStep.id]
    const done = getStepCanProceed(currentStep.id)
    const failVisible = lastFail && lastFail.stepId === currentStep.id && !done

    if (course.goalType === 'free') {
      const remainingKeys = REQUIRED_CONTROL_KEYS.filter((key) => !keysUsedFor(currentStep.id).includes(key))
      return (
        <div className="load-task-stack">
          <p className={done ? 'completion-ready' : 'task-note'}>
            {done
              ? 'Step complete. Use Next to continue.'
              : !simulation.engineStarted
                ? 'Press E to start the engine.'
                : `Try each control key: ${remainingKeys.map((key) => key.toUpperCase()).join(', ')} remaining.`}
          </p>
        </div>
      )
    }

    return (
      <div className="load-task-stack">
        {failVisible && (
          <p className="pallet-fail-note">
            <strong>{lastFail.title}.</strong> {lastFail.message}
          </p>
        )}
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done ? 'Step complete. Use Next to continue.' : courseTaskCopy(course, vehicleProfile)}
        </p>
      </div>
    )
  }

  const renderShutdownTask = () => (
    <div className="load-task-stack">
      <p className={shutdownComplete ? 'completion-ready' : 'task-note'}>
        {shutdownComplete
          ? 'Step complete. Use Next to continue.'
          : `Select the shutdown actions in the correct order (${shutdownPicked.length} of ${shutdownActions.length} placed). Wrong picks are counted: ${simulation.shutdownMistakes}.`}
      </p>
    </div>
  )

  const renderReportingTask = () => {
    const correctCount = reportPrompts.filter((item) => reportAnswers[item.id]?.correct).length
    return (
      <div className="load-task-stack">
        <p className={reportingComplete ? 'completion-ready' : 'task-note'}>
          {reportingComplete
            ? 'Step complete. Use Next to continue.'
            : `Decide Report or No Action for each condition (${correctCount} of ${reportPrompts.length} correct). Wrong answers can be retried.`}
        </p>
      </div>
    )
  }

  const summaryStep = steps.find((step) => step.kind === 'summary')

  const renderTask = ({ currentStep }) => {
    const step = stepById[currentStep.id]
    if (step?.kind === 'briefing') {
      return (
        <BriefingTask content={step.content} module={module} equipmentId={equipmentId} />
      )
    }
    if (step?.kind === 'walk-around') {
      return (
        <WalkAroundTask
          data={step.walkAround}
          content={step.content}
          state={phaseStateFor(simulation, step.id)}
          engineStarted={simulation.engineStarted}
          activeScenarioId={scenarioIdFor(step)}
          handlers={walkAroundHandlers(step)}
        />
      )
    }
    if (step?.kind === 'checklist' || step?.kind === 'quiz') {
      return <ModuleRowsTask content={step.content} kind={step.kind} />
    }
    if (courseById[currentStep.id]) return renderDrivingTask(currentStep)
    if (step?.content?.activityId === 'shutdown-sequence') return renderShutdownTask()
    if (step?.content?.activityId === 'reporting') return renderReportingTask()
    return null
  }

  return (
    <SimulationPageLayout
      className="load-simulation-page"
      title={module.fullTitle || module.title}
      subtitle="Guided Simulation"
      onBack={onBack}
    >
      {loading || error || hotspotsLoading || hotspotsError ? (
        <ModuleLoadingState loading={loading || hotspotsLoading} error={error || hotspotsError} />
      ) : !steps.length ? (
        <div className="module-loading-state">
          <p>This module has no steps yet. An admin can add one from the Courses tab.</p>
        </div>
      ) : (
        <ModuleSimulationShell
          module={module}
          steps={steps}
          currentStepIndex={stepIndex}
          objectives={moduleObjectives(steps, module)}
          progress={simulation.percentage}
          score={simulation.percentage}
          canProceed={getStepCanProceed(steps[stepIndex].id)}
          onBackStep={() => changeStep(Math.max(stepIndex - 1, 0))}
          onNextStep={() => changeStep(Math.min(stepIndex + 1, steps.length - 1))}
          onComplete={completeModule}
          renderScene={renderScene}
          renderTask={renderTask}
          selectedDetail={selectedDetail}
          onClearDetail={() => { setSelectedDetail(null); setFocusedHotspotId(null) }}
          completionSummary={
            <ModuleSummary
              content={summaryStep?.content}
              steps={steps}
              gradedStepIds={gradedStepIds}
              simulation={simulation}
            />
          }
        />
      )}
    </SimulationPageLayout>
  )
}

export default GenericModulePage
