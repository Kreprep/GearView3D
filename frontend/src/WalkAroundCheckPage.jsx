import { useEffect, useMemo, useRef, useState } from 'react'
import InteractiveForkliftViewer from './components/InteractiveForkliftViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useModuleRecord } from './hooks/useModuleRecord'
import { useProgress } from './hooks/useProgress'
import { useWalkAroundHotspots } from './hooks/useWalkAroundHotspots'
import {
  engineOnDeviceEffects,
  resolveEffectLamps,
  walkAroundDefectOverlays,
} from './data/viewerHotspots'
import { playDeviceSound, stopDeviceSound } from './lib/deviceAudio'
import { getPartDetails } from './lib/api'
import { routes } from './lib/router'
import {
  defectRecognitionScenarios,
  engineOffInspectionChecks,
  engineOnControlChecks,
  engineOnGaugeChecks,
  equipmentUsageModules,
  forkliftEquipment,
  moduleScenarioSteps,
  safetyDeviceTests,
} from './lib/trainingData'
import './WalkAroundCheckPage.css'

const MODULE_EXIT_DELAY_MS = 1400

const moduleSlug = 'walk-around-check'
const noViewerHotspots = []
const ENGINE_START_DELAY_MS = 1500
const engineOnDeviceChecks = [...safetyDeviceTests, ...engineOnControlChecks]
const engineOnTotalChecks = engineOnGaugeChecks.length + engineOnDeviceChecks.length
// Pulled in close to the operator station so the cockpit hotspots are readable.
const ENGINE_ON_CAMERA = { position: [1.05, 0.82, 0.95], fov: 46, minDistance: 0.4, maxDistance: 2.8 }

function unique(items) {
  return [...new Set(items)]
}

function calculateSimulationState(nextState) {
  const engineOffTotal = engineOffInspectionChecks.length
  const gaugeTotal = engineOnGaugeChecks.length
  const scenarioTotal = defectRecognitionScenarios.length
  const engineOffCount = nextState.engineOffChecks?.length || 0
  const deviceCount = nextState.engineOnChecks?.length || 0
  const gaugeAnswers = nextState.gaugeAnswers || {}
  // Gauges are judgment calls, so a wrong call still counts as answered for the
  // counter but only a correct call counts toward completing the module.
  const gaugeAnsweredCount = engineOnGaugeChecks.filter((gauge) => gaugeAnswers[gauge.id]).length
  const gaugeScore = engineOnGaugeChecks.filter((gauge) => gaugeAnswers[gauge.id] === gauge.answer).length
  const engineOnCount = deviceCount + gaugeAnsweredCount
  const defectScenarioAnswers = nextState.defectScenarioAnswers || {}
  const defectScenarioScore = defectRecognitionScenarios.filter(
    (scenario) => defectScenarioAnswers[scenario.id] === scenario.answer,
  ).length
  const percentage = Math.round(
    (engineOffCount / engineOffTotal) * 35 +
      (engineOnCount / engineOnTotalChecks) * 35 +
      (defectScenarioScore / scenarioTotal) * 30,
  )
  const engineOffComplete = engineOffCount === engineOffTotal
  const complete =
    engineOffComplete &&
    deviceCount === engineOnDeviceChecks.length &&
    gaugeScore === gaugeTotal &&
    defectScenarioScore === scenarioTotal

  return {
    ...nextState,
    engineOffComplete,
    gaugeAnswers,
    gaugeScore,
    engineOnCount,
    defectScenarioAnswers,
    defectScenarioScore,
    percentage,
    complete,
  }
}

function WalkAroundCheckPage({ moduleName, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  const module = useModuleRecord(moduleSlug, equipmentUsageModules.find((item) => item.slug === moduleSlug))
  const steps = moduleScenarioSteps[moduleSlug]
  const { hotspots: liveHotspots, loading: hotspotsLoading, error: hotspotsError } = useWalkAroundHotspots()
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [defectScenarioIndex, setDefectScenarioIndex] = useState(0)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [partDetails, setPartDetails] = useState({})
  const [focusedHotspotId, setFocusedHotspotId] = useState(null)
  const [activeDeviceEffect, setActiveDeviceEffect] = useState(null)
  const deviceEffectTimer = useRef(null)
  const engineStartTimer = useRef(null)
  const moduleExitTimer = useRef(null)
  const simulation = calculateSimulationState({
    engineOffChecks: savedSimulation.engineOffChecks || [],
    engineOnChecks: savedSimulation.engineOnChecks || [],
    engineStarted: savedSimulation.engineStarted || false,
    gaugeAnswers: savedSimulation.gaugeAnswers || {},
    defectScenarioAnswers: savedSimulation.defectScenarioAnswers || {},
    complete: savedSimulation.complete || false,
    percentage: savedSimulation.percentage || 0,
  })
  const activeDefectScenario = defectRecognitionScenarios[defectScenarioIndex]
  // Derived from the step rather than tracked separately, so Back/Next can never
  // leave the scene showing the wrong set of hotspots.
  const currentStepId = steps[currentStepIndex]?.id
  const inspectionState = currentStepId === 'engine-on-inspection' ? 'engine-on' : 'engine-off'

  const completedEngineOnSet = useMemo(() => new Set(simulation.engineOnChecks), [simulation.engineOnChecks])
  const completedEngineOffSet = useMemo(() => new Set(simulation.engineOffChecks), [simulation.engineOffChecks])

  // Which 3D markers show during each step is driven by the live hotspot's own
  // `state` field, so a hotspot an admin adds or repositions appears without a
  // code change. The ignition hotspot only joins the engine-off scene once the
  // walk-around is done, same as before.
  const engineOffViewerHotspots = useMemo(
    () => liveHotspots.filter((hotspot) => hotspot.state === 'engine-off').map((hotspot) => hotspot.id),
    [liveHotspots],
  )
  const ignitionViewerHotspots = useMemo(
    () => liveHotspots.filter((hotspot) => hotspot.state === 'ignition').map((hotspot) => hotspot.id),
    [liveHotspots],
  )
  const engineOnViewerHotspots = useMemo(
    () => liveHotspots.filter((hotspot) => hotspot.state === 'engine-on').map((hotspot) => hotspot.id),
    [liveHotspots],
  )

  useEffect(() => () => {
    clearTimeout(deviceEffectTimer.current)
    clearTimeout(engineStartTimer.current)
    clearTimeout(moduleExitTimer.current)
    stopDeviceSound()
  }, [])

  // Admin-editable part details (markdown description + reference image) from
  // the local content store; scenario data below stays as the fallback.
  useEffect(() => {
    getPartDetails().then(setPartDetails)
  }, [])

  const buildDetail = (id, fallback) => {
    const detail = partDetails[id] || {}
    return {
      title: detail.title || fallback.title,
      subtitle: detail.subtitle || fallback.subtitle,
      image: detail.image || fallback.image,
      description: detail.description || fallback.description,
    }
  }


  const saveSimulation = (partial) => {
    const next = calculateSimulationState({ ...simulation, ...partial })
    updateSimulation(moduleSlug, next)
    return next
  }

  // Every step change clears the detail panel and camera focus, so a selection
  // made in one step can never carry over into another.
  const goToStep = (index) => {
    setCurrentStepIndex(Math.min(Math.max(index, 0), steps.length - 1))
    setSelectedDetail(null)
    setFocusedHotspotId(null)
  }

  const switchInspectionState = (nextState) => {
    saveSimulation({ activeState: nextState })
    goToStep(nextState === 'engine-off' ? 1 : 2)
  }

  const completeEngineOffCheck = (check) => {
    const alreadyChecked = simulation.engineOffChecks.includes(check.id)
    const engineOffChecks = unique([...simulation.engineOffChecks, check.id])
    saveSimulation({ engineOffChecks })

    // The final check hands the learner over to the ignition, so point the camera
    // there instead of leaving the next required action hidden. Must only fire on
    // the click that actually completes the list - otherwise re-clicking any
    // already-checked card after completion keeps re-focusing the ignition marker
    // instead of the part that was clicked.
    const justCompleted =
      !alreadyChecked && engineOffChecks.length === engineOffInspectionChecks.length && !simulation.engineStarted
    setFocusedHotspotId(justCompleted ? 'ignition' : check.id)
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

  const startEngine = () => {
    if (!simulation.engineOffComplete || simulation.engineStarted) return

    saveSimulation({ engineStarted: true })
    setFocusedHotspotId('ignition')
    triggerDeviceEffect('ignition')
    setSelectedDetail({
      ...buildDetail('ignition', {
        title: 'Ignition Switch',
        subtitle: 'Engine start',
        description: 'Key turned. The starter cranks and the engine settles to idle.',
      }),
      status: 'Engine started. Continue with the engine-on checks.',
      statusType: 'correct',
    })

    // Let the start-up sound play before moving into the operational checks.
    clearTimeout(engineStartTimer.current)
    engineStartTimer.current = setTimeout(() => switchInspectionState('engine-on'), ENGINE_START_DELAY_MS)
  }

  const handleViewerHotspot = (hotspot) => {
    const stepId = steps[currentStepIndex]?.id

    if (hotspot.id === 'ignition') {
      startEngine()
      return
    }

    if (stepId === 'engine-off-inspection') {
      const check = engineOffInspectionChecks.find((item) => item.id === hotspot.id)
      if (check) {
        completeEngineOffCheck(check)
        return
      }
    }

    if (stepId === 'engine-on-inspection') {
      const device = engineOnDeviceChecks.find((item) => item.id === hotspot.id)
      if (device) {
        completeEngineOnCheck(device, hotspot)
        return
      }
    }

    setFocusedHotspotId(hotspot.id)
    setSelectedDetail({
      ...buildDetail(hotspot.id, {
        title: hotspot.label,
        subtitle: hotspot.category,
        description: hotspot.inspect,
        image: hotspot.image,
      }),
      status: hotspot.feedback,
      statusType: hotspot.result === 'unsafe' ? 'warning' : 'correct',
    })
  }

  const clearSelectedDetail = () => {
    setSelectedDetail(null)
    setFocusedHotspotId(null)
  }

  const triggerDeviceEffect = (deviceId) => {
    const effect = engineOnDeviceEffects[deviceId]
    if (!effect) return

    // Lamps follow the hotspot, so repositioning a hotspot keeps the effect aligned.
    const hotspot = liveHotspots.find((entry) => entry.id === deviceId)
    clearTimeout(deviceEffectTimer.current)
    setActiveDeviceEffect({ ...effect, lamps: resolveEffectLamps(effect, hotspot) })

    if (effect.sound) {
      playDeviceSound(effect.sound)
    }

    deviceEffectTimer.current = setTimeout(() => setActiveDeviceEffect(null), effect.duration)
  }

  const completeEngineOnCheck = (item, hotspot) => {
    saveSimulation({ engineOnChecks: unique([...simulation.engineOnChecks, item.id]) })
    setFocusedHotspotId(item.id)
    triggerDeviceEffect(item.id)
    setSelectedDetail({
      ...buildDetail(item.id, {
        title: hotspot?.label || item.label,
        subtitle: hotspot?.category || 'Engine-on check',
        description: hotspot?.inspect,
        image: hotspot?.image,
      }),
      status: item.feedback,
      statusType: 'correct',
    })
  }

  const answerGauge = (gauge, choice) => {
    saveSimulation({ gaugeAnswers: { ...simulation.gaugeAnswers, [gauge.id]: choice } })
    const correct = choice === gauge.answer
    setFocusedHotspotId('dashboard')
    setSelectedDetail({
      title: gauge.label,
      subtitle: 'Dashboard indicator',
      description: `Reading: ${gauge.reading}`,
      status: correct ? gauge.correctFeedback : gauge.incorrectFeedback,
      statusType: correct ? 'correct' : 'incorrect',
    })
  }

  const answerDefectScenario = (scenario, choice) => {
    saveSimulation({
      defectScenarioAnswers: { ...simulation.defectScenarioAnswers, [scenario.id]: choice },
    })
  }

  const completeModule = () => {
    if (!simulation.complete) return

    moduleExitTimer.current = setTimeout(() => onNavigate?.(routes.equipment), MODULE_EXIT_DELAY_MS)
  }

  const getStepRequiredNote = (stepId) => {
    if (stepId === 'engine-off-inspection' && simulation.engineOffComplete && !simulation.engineStarted) {
      return 'Walk-around complete. Turn the ignition switch to start the engine before continuing.'
    }
    if (stepId === 'engine-on-inspection' && simulation.gaugeScore < engineOnGaugeChecks.length) {
      return 'Re-read any gauge marked incorrect, then finish the remaining device and control tests.'
    }
    return "Complete this step's required items to continue."
  }

  const getStepCanProceed = (stepId) => {
    // The engine must be started from the ignition hotspot, not skipped past.
    if (stepId === 'engine-off-inspection') return simulation.engineOffComplete && simulation.engineStarted
    if (stepId === 'engine-on-inspection') {
      return (
        simulation.engineOnChecks.length === engineOnDeviceChecks.length &&
        simulation.gaugeScore === engineOnGaugeChecks.length
      )
    }
    if (stepId === 'defect-recognition') return defectRecognitionScenarios.every((scenario) => Boolean(simulation.defectScenarioAnswers[scenario.id]))
    return true
  }

  const renderScene = ({ currentStep }) => {
    const stepId = currentStep.id
    const isDefectStep = stepId === 'defect-recognition'
    const isEngineOnStep = stepId === 'engine-on-inspection'
    const isEngineOffStep = stepId === 'engine-off-inspection'

    const scenario = isDefectStep
      ? (activeDefectScenario.visualState === 'normal' ? 'good-forklift' : activeDefectScenario.visualState)
      : isEngineOnStep
        ? 'engine-on'
        : 'engine-off'

    // Hotspots belong to the step that uses them - the briefing, defect test and
    // summary steps show the model with no markers at all.
    let activeHotspots = noViewerHotspots

    if (isEngineOffStep) {
      // The ignition only appears once the walk-around inspection is done.
      activeHotspots = simulation.engineOffComplete && !simulation.engineStarted
        ? [...engineOffViewerHotspots, ...ignitionViewerHotspots]
        : engineOffViewerHotspots
    } else if (isEngineOnStep) {
      activeHotspots = engineOnViewerHotspots
    }

    return (
      <div className="walkaround-scene-wrap">
        <InteractiveForkliftViewer
          mode={isDefectStep ? 'defect-test' : 'inspection'}
          scenario={scenario}
          activeHotspots={activeHotspots}
          hotspots={liveHotspots}
          defectOverlays={walkAroundDefectOverlays}
          modelUrl={forkliftEquipment.modelUrl}
          cameraPreset={isEngineOnStep ? ENGINE_ON_CAMERA : undefined}
          onHotspotSelect={handleViewerHotspot}
          onResetView={() => setFocusedHotspotId(null)}
          selectedHotspotId={focusedHotspotId}
          isAdmin={isAdmin}
          deviceEffect={activeDeviceEffect}
        />
      </div>
    )
  }

  const renderBriefing = () => (
    <div className="walkaround-task-stack">
      <ScopeNotice />
      {renderInspectionToggle()}
      <div className="reference-card">
        <p><strong>Syllabus Location:</strong> {module.syllabusLocation}</p>
        <p><strong>Unit Code:</strong> {module.unitCode}</p>
        <p><strong>Element:</strong> {module.element}</p>
        <p><strong>Page References:</strong> {module.pageReferences}</p>
      </div>
      {module.lessonContent.map((content) => (
        <p key={content} className="lesson-bubble">{content}</p>
      ))}
    </div>
  )

  const renderInspectionToggle = () => (
    <div className="engine-state-toggle" role="group" aria-label="Inspection state toggle">
      <button
        type="button"
        className={inspectionState === 'engine-off' ? 'active' : ''}
        onClick={() => switchInspectionState('engine-off')}
      >
        Engine-Off
        <span>{simulation.engineOffChecks.length}/{engineOffInspectionChecks.length}</span>
      </button>
      <button
        type="button"
        className={inspectionState === 'engine-on' ? 'active' : ''}
        onClick={() => switchInspectionState('engine-on')}
        disabled={!simulation.engineStarted}
        title={simulation.engineStarted ? undefined : 'Start the engine first'}
      >
        Engine-On
        <span>{simulation.engineOnCount}/{engineOnTotalChecks}</span>
      </button>
    </div>
  )

  const renderEngineOff = () => (
    <div className="walkaround-task-stack">
      {renderInspectionToggle()}
      <p className="task-note">Click each inspection card to inspect that area and save progress.</p>
      <div className="inspection-card-grid">
        {engineOffInspectionChecks.map((check) => (
          <button
            key={check.id}
            type="button"
            className={completedEngineOffSet.has(check.id) ? 'inspection-card done' : 'inspection-card'}
            onClick={() => completeEngineOffCheck(check)}
          >
            <span>{check.label}</span>
            <small>{check.inspect}</small>
          </button>
        ))}
      </div>
      {simulation.engineOffComplete && !simulation.engineStarted && (
        <button type="button" className="start-engine-button" onClick={startEngine}>
          <strong>Start Engine</strong>
          <small>Walk-around complete. Turn the key here or click the ignition on the model.</small>
        </button>
      )}
    </div>
  )

  const renderDeviceGroup = (items) => (
    <div className="device-test-grid">
      {items.map((item) => {
        const hotspot = liveHotspots.find((entry) => entry.id === item.id)
        return (
          <button
            key={item.id}
            type="button"
            className={completedEngineOnSet.has(item.id) ? 'device-test done' : 'device-test'}
            onClick={() => completeEngineOnCheck(item, hotspot)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )

  const renderEngineOn = () => (
    <div className="walkaround-task-stack">
      {renderInspectionToggle()}
      <p className="task-note">
        Read each gauge and decide if the reading is normal. Then test the devices and controls, in the panel or
        directly on the 3D model.
      </p>
      <div className="virtual-dashboard">
        <h4>Dashboard Indicators</h4>
        {engineOnGaugeChecks.map((gauge) => {
          const answer = simulation.gaugeAnswers[gauge.id]
          const correct = answer === gauge.answer

          return (
            <div key={gauge.id} className={answer ? (correct ? 'gauge-card done' : 'gauge-card wrong') : 'gauge-card'}>
              <div className="gauge-dial" aria-hidden="true">
                <i style={{ transform: `rotate(${gauge.dialAngle}deg)` }} />
              </div>
              <div className="gauge-readout">
                <span>{gauge.label}</span>
                <strong>{gauge.reading}</strong>
              </div>
              <div className="gauge-answer-row">
                {['Normal', 'Abnormal'].map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={answer === choice ? 'selected' : ''}
                    onClick={() => answerGauge(gauge, choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              {answer && (
                <p className={correct ? 'gauge-verdict correct' : 'gauge-verdict incorrect'}>
                  {correct ? 'Correct' : 'Re-read this gauge'}
                </p>
              )}
            </div>
          )
        })}
        <p className="gauge-score">Gauge readings correct: {simulation.gaugeScore}/{engineOnGaugeChecks.length}</p>
      </div>
      <p className="subsection-label">Safety Devices</p>
      {renderDeviceGroup(safetyDeviceTests)}
      <p className="subsection-label">Operational Controls</p>
      {renderDeviceGroup(engineOnControlChecks)}
    </div>
  )

  const renderDefectTest = () => {
    const savedAnswer = simulation.defectScenarioAnswers[activeDefectScenario.id]

    return (
      <div className="walkaround-task-stack">
        <div className="scenario-picker" role="tablist" aria-label="Defect recognition scenarios">
          {defectRecognitionScenarios.map((scenario, index) => {
            const answer = simulation.defectScenarioAnswers[scenario.id]
            return (
              <button
                key={scenario.id}
                type="button"
                className={index === defectScenarioIndex ? 'active' : ''}
                aria-label={scenario.title}
                onClick={() => setDefectScenarioIndex(index)}
              >
                {answer ? (answer === scenario.answer ? '✓' : '✕') : index + 1}
              </button>
            )
          })}
        </div>
        <h4>{activeDefectScenario.title}</h4>
        <p>{activeDefectScenario.question}</p>
        <div className="scenario-choice-row">
          {activeDefectScenario.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className={savedAnswer === choice ? 'selected' : ''}
              onClick={() => answerDefectScenario(activeDefectScenario, choice)}
            >
              {choice}
            </button>
          ))}
        </div>
        {savedAnswer && <p className="task-note">{activeDefectScenario.feedback}</p>}
        <p className="task-note">
          Defect recognition score: {simulation.defectScenarioScore}/{defectRecognitionScenarios.length}
        </p>
      </div>
    )
  }

  const renderSummary = () => (
    <div className="walkaround-task-stack">
      <div className="summary-grid">
        <div><span>Engine-Off Checks</span><strong>{simulation.engineOffChecks.length}/{engineOffInspectionChecks.length}</strong></div>
        <div><span>Engine-On Checks</span><strong>{simulation.engineOnCount}/{engineOnTotalChecks}</strong></div>
        <div><span>Gauge Readings</span><strong>{simulation.gaugeScore}/{engineOnGaugeChecks.length}</strong></div>
        <div><span>Defect Recognition</span><strong>{simulation.defectScenarioScore}/{defectRecognitionScenarios.length}</strong></div>
      </div>
      <p className={simulation.complete ? 'completion-ready' : 'completion-warning'}>
        {simulation.complete
          ? 'All requirements are complete. Submit the module to record completion feedback.'
          : 'Complete all required checks and correct all scenario decisions to finish this module.'}
      </p>
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'briefing') return renderBriefing()
    if (currentStep.id === 'engine-off-inspection') return renderEngineOff()
    if (currentStep.id === 'engine-on-inspection') return renderEngineOn()
    if (currentStep.id === 'defect-recognition') return renderDefectTest()
    return null
  }

  return (
    <div className="module-page-container walkaround-simulation-page">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <div className="module-title-section">
          <h1>{module.fullTitle}</h1>
          <h2>{moduleName} Guided Simulation</h2>
        </div>
      </header>

      <main className="module-content wide-simulation-content">
        {hotspotsLoading || hotspotsError ? (
          <ModuleLoadingState loading={hotspotsLoading} error={hotspotsError} />
        ) : (
          <ModuleSimulationShell
            module={module}
            steps={steps}
            currentStepIndex={currentStepIndex}
            objectives={module.learningObjectives}
            progress={simulation.percentage}
            score={simulation.defectScenarioScore}
            canProceed={getStepCanProceed(steps[currentStepIndex].id)}
            requiredNote={getStepRequiredNote(steps[currentStepIndex].id)}
            onBackStep={() => goToStep(currentStepIndex - 1)}
            onNextStep={() => goToStep(currentStepIndex + 1)}
            onComplete={completeModule}
            renderScene={renderScene}
            renderTask={renderTask}
            completionSummary={renderSummary()}
            selectedDetail={selectedDetail}
            onClearDetail={clearSelectedDetail}
          />
        )}
      </main>
    </div>
  )
}

export default WalkAroundCheckPage
