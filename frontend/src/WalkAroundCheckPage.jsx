import { useMemo, useState } from 'react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import {
  defectRecognitionScenarios,
  engineOffInspectionChecks,
  engineOnGaugeChecks,
  equipmentUsageModules,
  moduleScenarioSteps,
  safetyDeviceTests,
} from './lib/trainingData'
import './WalkAroundCheckPage.css'

const moduleSlug = 'walk-around-check'

function unique(items) {
  return [...new Set(items)]
}

function calculateSimulationState(nextState) {
  const engineOffTotal = engineOffInspectionChecks.length
  const engineOnTotal = engineOnGaugeChecks.length + safetyDeviceTests.length
  const scenarioTotal = defectRecognitionScenarios.length
  const engineOffCount = nextState.engineOffChecks?.length || 0
  const engineOnCount = nextState.engineOnChecks?.length || 0
  const scenarioScore = nextState.scenarioScore || 0
  const percentage = Math.round(
    (engineOffCount / engineOffTotal) * 35 +
      (engineOnCount / engineOnTotal) * 35 +
      (scenarioScore / scenarioTotal) * 30,
  )
  const complete = engineOffCount === engineOffTotal && engineOnCount === engineOnTotal && scenarioScore === scenarioTotal

  return { ...nextState, percentage, complete }
}

function VisualOverlay({ state }) {
  if (state === 'oil-leak') {
    return (
      <>
        <div className="oil-leak-overlay" />
        <div className="defect-label oil">Visible fluid leak</div>
      </>
    )
  }

  if (state === 'flat-tire') {
    return (
      <>
        <div className="flat-tire-marker">!</div>
        <div className="defect-label tire">Unsafe tire condition</div>
      </>
    )
  }

  return <div className="defect-label good">No visible defect overlay</div>
}

function WalkAroundCheckPage({ moduleName, onBack }) {
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const steps = moduleScenarioSteps[moduleSlug]
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedPartId, setSelectedPartId] = useState('counterweight')
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0)
  const [feedback, setFeedback] = useState({
    type: 'neutral',
    title: 'Scenario Briefing',
    message: 'Start by reviewing the purpose of the walk-around inspection.',
  })
  const simulation = calculateSimulationState({
    engineOffChecks: savedSimulation.engineOffChecks || [],
    engineOnChecks: savedSimulation.engineOnChecks || [],
    scenarioAnswers: savedSimulation.scenarioAnswers || {},
    scenarioScore: savedSimulation.scenarioScore || 0,
    complete: savedSimulation.complete || false,
    percentage: savedSimulation.percentage || 0,
  })
  const activeScenario = defectRecognitionScenarios[activeScenarioIndex]

  const completedEngineOnSet = useMemo(() => new Set(simulation.engineOnChecks), [simulation.engineOnChecks])
  const completedEngineOffSet = useMemo(() => new Set(simulation.engineOffChecks), [simulation.engineOffChecks])

  const saveSimulation = (partial) => {
    const next = calculateSimulationState({ ...simulation, ...partial })
    updateSimulation(moduleSlug, next)
    return next
  }

  const completeEngineOffCheck = (check) => {
    setSelectedPartId(check.hotspotId)
    saveSimulation({ engineOffChecks: unique([...simulation.engineOffChecks, check.id]) })
    setFeedback({
      type: check.status === 'safe' ? 'correct' : 'warning',
      title: check.label,
      message: `${check.found} ${check.feedback}`,
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

  const answerScenario = (choice) => {
    const scenarioAnswers = {
      ...simulation.scenarioAnswers,
      [activeScenario.id]: choice,
    }
    const scenarioScore = defectRecognitionScenarios.reduce((score, scenario) => {
      return score + (scenarioAnswers[scenario.id] === scenario.answer ? 1 : 0)
    }, 0)
    saveSimulation({ scenarioAnswers, scenarioScore })
    setFeedback({
      type: choice === activeScenario.answer ? 'correct' : 'incorrect',
      title: choice === activeScenario.answer ? 'Correct decision' : 'Review the condition',
      message: activeScenario.feedback,
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
      message: 'You completed the visual inspection simulation and can explain when a forklift must be reported as unsafe.',
    })
  }

  const renderScene = ({ currentStep }) => {
    const scenarioState = currentStep.id === 'defect-recognition' ? activeScenario.visualState : 'normal'

    return (
      <div className="walkaround-scene-wrap">
        <ForkliftViewport selectedPartId={selectedPartId} onPartSelect={setSelectedPartId} />
        <VisualOverlay state={scenarioState} />
      </div>
    )
  }

  const renderBriefing = () => (
    <div className="walkaround-task-stack">
      <ScopeNotice />
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

  const renderEngineOff = () => (
    <div className="walkaround-task-stack">
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
      <div className="virtual-dashboard">
        <h4>Virtual Dashboard Panel</h4>
        {engineOnGaugeChecks.map((gauge) => (
          <button
            key={gauge.id}
            type="button"
            className={completedEngineOnSet.has(gauge.id) ? 'gauge-card done' : 'gauge-card'}
            onClick={() => completeEngineOnCheck(gauge)}
          >
            <span>{gauge.label}</span>
            <strong>{gauge.normalReading}</strong>
          </button>
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
    const savedAnswer = simulation.scenarioAnswers[activeScenario.id]

    return (
      <div className="walkaround-task-stack">
        <div className="scenario-picker">
          {defectRecognitionScenarios.map((scenario, index) => (
            <button
              key={scenario.id}
              type="button"
              className={index === activeScenarioIndex ? 'active' : ''}
              onClick={() => {
                setActiveScenarioIndex(index)
                setFeedback({
                  type: 'neutral',
                  title: scenario.title,
                  message: 'Review the visual overlay, then decide if the forklift is usable.',
                })
              }}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <h4>{activeScenario.title}</h4>
        <p>{activeScenario.question}</p>
        <div className="scenario-choice-row">
          {activeScenario.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className={savedAnswer === choice ? 'selected' : ''}
              onClick={() => answerScenario(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
        <p className="task-note">Scenario score: {simulation.scenarioScore}/{defectRecognitionScenarios.length}</p>
      </div>
    )
  }

  const renderSummary = () => (
    <div className="walkaround-task-stack">
      <div className="summary-grid">
        <div><span>Engine-Off Checks</span><strong>{simulation.engineOffChecks.length}/{engineOffInspectionChecks.length}</strong></div>
        <div><span>Engine-On Checks</span><strong>{simulation.engineOnChecks.length}/{engineOnGaugeChecks.length + safetyDeviceTests.length}</strong></div>
        <div><span>Scenario Test</span><strong>{simulation.scenarioScore}/{defectRecognitionScenarios.length}</strong></div>
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
    return renderSummary()
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
          score={simulation.scenarioScore}
          feedback={feedback}
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
