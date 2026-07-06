import { useMemo, useState } from 'react'
import InteractiveForkliftViewer from './components/InteractiveForkliftViewer'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { walkAroundDefectOverlays, walkAroundViewerHotspots } from './data/viewerHotspots'
import { routes } from './lib/router'
import {
  defectRecognitionScenarios,
  engineOffInspectionChecks,
  engineOnGaugeChecks,
  equipmentUsageModules,
  forkliftEquipment,
  moduleScenarioSteps,
  safetyDeviceTests,
} from './lib/trainingData'
import './WalkAroundCheckPage.css'

const NEXT_MODULE_DELAY_MS = 1400

const moduleSlug = 'walk-around-check'
const noViewerHotspots = []
const engineOffViewerHotspots = engineOffInspectionChecks.map((check) => check.id)
const engineOnViewerHotspots = ['operator-area', 'warning-devices']

function unique(items) {
  return [...new Set(items)]
}

function calculateSimulationState(nextState) {
  const engineOffTotal = engineOffInspectionChecks.length
  const engineOnTotal = engineOnGaugeChecks.length + safetyDeviceTests.length
  const scenarioTotal = defectRecognitionScenarios.length
  const engineOffCount = nextState.engineOffChecks?.length || 0
  const engineOnCount = nextState.engineOnChecks?.length || 0
  const defectScenarioAnswers = nextState.defectScenarioAnswers || {}
  const defectScenarioScore = defectRecognitionScenarios.filter(
    (scenario) => defectScenarioAnswers[scenario.id] === scenario.answer,
  ).length
  const percentage = Math.round(
    (engineOffCount / engineOffTotal) * 35 +
      (engineOnCount / engineOnTotal) * 35 +
      (defectScenarioScore / scenarioTotal) * 30,
  )
  const complete = engineOffCount === engineOffTotal && engineOnCount === engineOnTotal && defectScenarioScore === scenarioTotal

  return { ...nextState, defectScenarioAnswers, defectScenarioScore, percentage, complete }
}

function WalkAroundCheckPage({ moduleName, onBack, onNavigate }) {
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const steps = moduleScenarioSteps[moduleSlug]
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [inspectionState, setInspectionState] = useState(savedSimulation.activeState || 'engine-off')
  const [defectScenarioIndex, setDefectScenarioIndex] = useState(0)
  const [feedback, setFeedback] = useState({
    type: 'neutral',
    title: 'Scenario Briefing',
    message: 'Start by reviewing the purpose of the walk-around inspection.',
  })
  const simulation = calculateSimulationState({
    engineOffChecks: savedSimulation.engineOffChecks || [],
    engineOnChecks: savedSimulation.engineOnChecks || [],
    defectScenarioAnswers: savedSimulation.defectScenarioAnswers || {},
    complete: savedSimulation.complete || false,
    percentage: savedSimulation.percentage || 0,
  })
  const activeDefectScenario = defectRecognitionScenarios[defectScenarioIndex]

  const completedEngineOnSet = useMemo(() => new Set(simulation.engineOnChecks), [simulation.engineOnChecks])
  const completedEngineOffSet = useMemo(() => new Set(simulation.engineOffChecks), [simulation.engineOffChecks])

  const saveSimulation = (partial) => {
    const next = calculateSimulationState({ ...simulation, ...partial })
    updateSimulation(moduleSlug, next)
    return next
  }

  const switchInspectionState = (nextState) => {
    setInspectionState(nextState)
    saveSimulation({ activeState: nextState })
    setCurrentStepIndex(nextState === 'engine-off' ? 1 : 2)
    setFeedback({
      type: 'neutral',
      title: nextState === 'engine-off' ? 'Engine-Off Inspection' : 'Engine-On Inspection',
      message: nextState === 'engine-off'
        ? 'Only engine-off visual inspection hotspots are active.'
        : 'Cockpit dashboard checks and safety device tests are active.',
    })
  }

  const completeEngineOffCheck = (check) => {
    saveSimulation({ engineOffChecks: unique([...simulation.engineOffChecks, check.id]) })
    setFeedback({
      type: check.status === 'safe' ? 'correct' : 'warning',
      title: check.label,
      message: `${check.found} ${check.feedback}`,
    })
  }

  const handleViewerHotspot = (hotspot) => {
    if (steps[currentStepIndex]?.id === 'engine-off-inspection') {
      const check = engineOffInspectionChecks.find((item) => item.id === hotspot.id)
      if (check) {
        completeEngineOffCheck(check)
        return
      }
    }

    setFeedback({
      type: hotspot.result === 'unsafe' ? 'warning' : 'correct',
      title: hotspot.label,
      message: `${hotspot.inspect} ${hotspot.feedback}`,
    })
  }

  const handleScenarioAction = (action) => {
    setFeedback({
      type: 'warning',
      title: action.id === 'oil-leak' ? 'Fluid Leak Detected' : 'Tire Warning',
      message: action.feedback,
    })
  }

  const completeEngineOnCheck = (item) => {
    saveSimulation({ engineOnChecks: unique([...simulation.engineOnChecks, item.id]) })
    setFeedback({
      type: 'correct',
      title: item.label,
      message: item.feedback,
    })
  }

  const answerDefectScenario = (scenario, choice) => {
    const correct = choice === scenario.answer
    saveSimulation({
      defectScenarioAnswers: { ...simulation.defectScenarioAnswers, [scenario.id]: choice },
    })
    setFeedback({
      type: correct ? 'correct' : 'incorrect',
      title: correct ? 'Correct' : 'Review this scenario',
      message: scenario.feedback,
    })
  }

  const completeModule = () => {
    if (!simulation.complete) {
      setFeedback({
        type: 'warning',
        title: 'Module not complete yet',
        message: 'Finish all engine-off checks, engine-on checks, and answer all defect scenarios correctly.',
      })
      return
    }

    setFeedback({
      type: 'completed',
      title: 'Walk-Around Check Complete',
      message: 'You completed the visual inspection simulation. Moving to Load Handling and Operational Controls next.',
    })

    setTimeout(() => onNavigate?.(routes.loadHandling), NEXT_MODULE_DELAY_MS)
  }

  const getStepCanProceed = (stepId) => {
    if (stepId === 'engine-off-inspection') return simulation.engineOffChecks.length === engineOffInspectionChecks.length
    if (stepId === 'engine-on-inspection') return simulation.engineOnChecks.length === engineOnGaugeChecks.length + safetyDeviceTests.length
    if (stepId === 'defect-recognition') return defectRecognitionScenarios.every((scenario) => Boolean(simulation.defectScenarioAnswers[scenario.id]))
    return true
  }

  const renderScene = ({ currentStep }) => {
    const scenario = currentStep.id === 'defect-recognition'
      ? (activeDefectScenario.visualState === 'normal' ? 'good-forklift' : activeDefectScenario.visualState)
      : inspectionState === 'engine-on'
        ? 'engine-on'
        : 'engine-off'
    const activeHotspots = inspectionState === 'engine-off' && currentStep.id !== 'defect-recognition'
      ? engineOffViewerHotspots
      : inspectionState === 'engine-on' && currentStep.id !== 'defect-recognition'
        ? engineOnViewerHotspots
        : noViewerHotspots

    return (
      <div className="walkaround-scene-wrap">
        <InteractiveForkliftViewer
          mode={currentStep.id === 'defect-recognition' ? 'defect-test' : 'inspection'}
          scenario={scenario}
          activeHotspots={activeHotspots}
          hotspots={walkAroundViewerHotspots}
          defectOverlays={walkAroundDefectOverlays}
          modelUrl={forkliftEquipment.modelUrl}
          cameraPreset={inspectionState === 'engine-on' ? { position: [1.25, 0.95, 1.15], maxDistance: 3.4 } : undefined}
          onHotspotSelect={handleViewerHotspot}
          onScenarioAction={handleScenarioAction}
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
      >
        Engine-On
        <span>{simulation.engineOnChecks.length}/{engineOnGaugeChecks.length + safetyDeviceTests.length}</span>
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
    </div>
  )

  const renderEngineOn = () => (
    <div className="walkaround-task-stack">
      {renderInspectionToggle()}
      <div className="virtual-dashboard">
        <h4>Virtual Dashboard Panel</h4>
        {engineOnGaugeChecks.map((gauge) => (
          <div key={gauge.id} className={completedEngineOnSet.has(gauge.id) ? 'gauge-card done' : 'gauge-card'}>
            <div className="gauge-dial" aria-hidden="true">
              <i style={{ transform: completedEngineOnSet.has(gauge.id) ? 'rotate(42deg)' : 'rotate(-42deg)' }} />
            </div>
            <div>
              <span>{gauge.label}</span>
              <strong>{completedEngineOnSet.has(gauge.id) ? gauge.normalReading : 'Unchecked'}</strong>
            </div>
            <button type="button" onClick={() => completeEngineOnCheck(gauge)}>
              Check
            </button>
          </div>
        ))}
      </div>
      <div className="device-test-grid">
        {safetyDeviceTests.map((device) => (
          <button
            key={device.id}
            type="button"
            className={completedEngineOnSet.has(device.id) ? 'device-test done' : 'device-test'}
            onClick={() => completeEngineOnCheck(device)}
          >
            {device.label}
          </button>
        ))}
      </div>
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
        <div><span>Engine-On Checks</span><strong>{simulation.engineOnChecks.length}/{engineOnGaugeChecks.length + safetyDeviceTests.length}</strong></div>
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
        <ModuleSimulationShell
          module={module}
          steps={steps}
          currentStepIndex={currentStepIndex}
          objectives={module.learningObjectives}
          progress={simulation.percentage}
          score={simulation.defectScenarioScore}
          feedback={feedback}
          canProceed={getStepCanProceed(steps[currentStepIndex].id)}
          onBackStep={() => setCurrentStepIndex((index) => Math.max(index - 1, 0))}
          onNextStep={() => setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1))}
          onComplete={completeModule}
          renderScene={renderScene}
          renderTask={renderTask}
          completionSummary={renderSummary()}
        />
      </main>
    </div>
  )
}

export default WalkAroundCheckPage
