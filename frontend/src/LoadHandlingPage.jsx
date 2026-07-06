import { useMemo, useState } from 'react'
import InteractiveForkliftViewer from './components/InteractiveForkliftViewer'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { equipmentUsageModules, moduleScenarioSteps } from './lib/trainingData'
import './LoadHandlingPage.css'

const moduleSlug = 'load-handling'

const positioningChoices = [
  {
    id: 'slow-square',
    label: 'Approach slowly and squarely',
    correct: true,
    feedback: 'Correct. A slow, square approach improves alignment and control before entering the pallet.',
  },
  {
    id: 'fast-angle',
    label: 'Approach quickly at an angle',
    correct: false,
    feedback: 'Incorrect. Speed and angled entry increase the chance of striking the pallet or destabilizing the load.',
  },
  {
    id: 'raised-forks',
    label: 'Travel forward with raised forks',
    correct: false,
    feedback: 'Incorrect. Forks and loads should be kept low while traveling to support stability and visibility.',
  },
]

const stabilityStates = [
  {
    id: 'centered-low',
    label: 'Centered and low',
    dot: { left: '50%', top: '58%' },
    correct: true,
    feedback: 'Correct. A centered, low load keeps the center of gravity within the stability triangle.',
  },
  {
    id: 'high-forward',
    label: 'High and forward',
    dot: { left: '50%', top: '18%' },
    correct: false,
    feedback: 'Warning. High or forward load position can move the center of gravity toward the edge of stability.',
  },
  {
    id: 'off-center',
    label: 'Off-center',
    dot: { left: '76%', top: '48%' },
    correct: false,
    feedback: 'Warning. Off-center loads reduce stability and should be corrected before travel.',
  },
]

const hydraulicControlSteps = [
  {
    id: 'fork-height',
    label: 'Set forks to pallet height',
    feedback: 'Fork height is set before entering the pallet.',
  },
  {
    id: 'lift-smoothly',
    label: 'Lift smoothly',
    feedback: 'The load is raised with controlled movement.',
  },
  {
    id: 'tilt-back',
    label: 'Tilt mast slightly back',
    feedback: 'Slight back tilt helps keep the load stable on the forks.',
  },
  {
    id: 'travel-low',
    label: 'Travel with load low',
    feedback: 'Travel posture is correct for stability and visibility.',
  },
]

const worksiteHazards = [
  {
    id: 'pedestrian',
    label: 'Pedestrian in path',
    x: 66,
    y: 28,
    feedback: 'Pedestrian traffic must be cleared before moving with a load.',
  },
  {
    id: 'spill',
    label: 'Floor spill',
    x: 38,
    y: 62,
    feedback: 'A spill can affect traction and should be avoided or reported.',
  },
  {
    id: 'blocked-aisle',
    label: 'Blocked aisle',
    x: 78,
    y: 70,
    feedback: 'Blocked travel paths reduce maneuvering space and visibility.',
  },
  {
    id: 'overhead',
    label: 'Overhead obstruction',
    x: 28,
    y: 26,
    feedback: 'Overhead hazards matter when lifting or traveling near racks and doors.',
  },
]

function unique(items) {
  return [...new Set(items)]
}

function calculateSimulationState(nextState) {
  const positioning = nextState.positioningChoice === 'slow-square' ? 20 : 0
  const stability = nextState.stabilityChoice === 'centered-low' ? 20 : 0
  const controls = ((nextState.controlsCompleted?.length || 0) / hydraulicControlSteps.length) * 25
  const hazards = ((nextState.hazardsFound?.length || 0) / worksiteHazards.length) * 25
  const checkpoint = nextState.checkpointPassed ? 10 : 0
  const percentage = Math.round(positioning + stability + controls + hazards + checkpoint)
  const complete = percentage === 100

  return { ...nextState, percentage, complete }
}

function StabilityDiagram({ state }) {
  const selected = stabilityStates.find((item) => item.id === state) || stabilityStates[1]

  return (
    <div className="stability-diagram">
      <div className="triangle-shape" />
      <div className="cg-dot" style={selected.dot}>CG</div>
      <div className="triangle-label front">Front Axle</div>
      <div className="triangle-label rear-left">Rear Pivot</div>
      <div className="triangle-label rear-right">Rear Pivot</div>
    </div>
  )
}

function WorksiteSurvey({ foundHazards, onFindHazard }) {
  return (
    <div className="worksite-scene" aria-label="Clickable worksite hazard survey">
      <div className="aisle-line main" />
      <div className="aisle-line cross" />
      <div className="pallet-stack one">Pallets</div>
      <div className="pallet-stack two">Rack</div>
      {worksiteHazards.map((hazard) => (
        <button
          key={hazard.id}
          type="button"
          className={foundHazards.includes(hazard.id) ? 'hazard-pin found' : 'hazard-pin'}
          style={{ left: `${hazard.x}%`, top: `${hazard.y}%` }}
          onClick={() => onFindHazard(hazard)}
          aria-label={hazard.label}
        >
          !
        </button>
      ))}
    </div>
  )
}

function LoadHandlingPage({ moduleName, onBack }) {
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const steps = moduleScenarioSteps[moduleSlug]
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [feedback, setFeedback] = useState({
    type: 'neutral',
    title: 'Scenario Briefing',
    message: 'Review the load-handling objectives before starting the guided tasks.',
  })
  const simulation = calculateSimulationState({
    positioningChoice: savedSimulation.positioningChoice || '',
    stabilityChoice: savedSimulation.stabilityChoice || 'high-forward',
    controlsCompleted: savedSimulation.controlsCompleted || [],
    hazardsFound: savedSimulation.hazardsFound || [],
    checkpointPassed: savedSimulation.checkpointPassed || false,
    percentage: savedSimulation.percentage || 0,
    complete: savedSimulation.complete || false,
  })
  const foundHazardSet = useMemo(() => new Set(simulation.hazardsFound), [simulation.hazardsFound])

  const saveSimulation = (partial) => {
    const next = calculateSimulationState({ ...simulation, ...partial })
    updateSimulation(moduleSlug, next)
    return next
  }

  const choosePositioning = (choice) => {
    saveSimulation({ positioningChoice: choice.id })
    setFeedback({
      type: choice.correct ? 'correct' : 'warning',
      title: choice.correct ? 'Safe positioning' : 'Positioning risk',
      message: choice.feedback,
    })
  }

  const chooseStability = (state) => {
    saveSimulation({ stabilityChoice: state.id })
    setFeedback({
      type: state.correct ? 'correct' : 'warning',
      title: state.correct ? 'Stable load position' : 'Stability warning',
      message: state.feedback,
    })
  }

  const completeControlStep = (step) => {
    saveSimulation({ controlsCompleted: unique([...simulation.controlsCompleted, step.id]) })
    setFeedback({
      type: 'correct',
      title: step.label,
      message: step.feedback,
    })
  }

  const findHazard = (hazard) => {
    saveSimulation({ hazardsFound: unique([...simulation.hazardsFound, hazard.id]) })
    setFeedback({
      type: 'warning',
      title: hazard.label,
      message: hazard.feedback,
    })
  }

  const handleViewerHotspot = (hotspot) => {
    setFeedback({
      type: hotspot.result === 'unsafe' ? 'warning' : 'correct',
      title: hotspot.label,
      message: `${hotspot.inspect} ${hotspot.feedback}`,
    })
  }

  const passCheckpoint = () => {
    saveSimulation({ checkpointPassed: true })
    setFeedback({
      type: 'correct',
      title: 'Checkpoint Passed',
      message: 'You selected the safe load-handling decision: keep the load centered, low, and within rated capacity.',
    })
  }

  const completeModule = () => {
    if (!simulation.complete) {
      setFeedback({
        type: 'warning',
        title: 'Module not complete yet',
        message: 'Finish positioning, stability, hydraulic controls, hazard survey, and checkpoint tasks.',
      })
      return
    }

    setFeedback({
      type: 'completed',
      title: 'Load Handling Complete',
      message: 'You completed the guided load-handling and operational controls simulation.',
    })
  }

  const renderScene = ({ currentStep }) => {
    if (currentStep.id === 'stability-triangle') {
      return (
        <div className="load-diagram-stage">
          <StabilityDiagram state={simulation.stabilityChoice} />
        </div>
      )
    }

    if (currentStep.id === 'area-safety-survey') {
      return (
        <div className="load-diagram-stage">
          <WorksiteSurvey foundHazards={simulation.hazardsFound} onFindHazard={findHazard} />
        </div>
      )
    }

    return (
      <div className="load-scene-wrap">
        <InteractiveForkliftViewer
          mode="load-handling"
          scenario="good-forklift"
          activeHotspots={['forks', 'carriage', 'mast-assembly', 'tires', 'operator-area']}
          onHotspotSelect={handleViewerHotspot}
        />
      </div>
    )
  }

  const renderBriefing = () => (
    <div className="load-task-stack">
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

  const renderPositioning = () => (
    <div className="load-task-stack">
      <p className="task-note">Choose the safest way to approach a pallet before handling a load.</p>
      {positioningChoices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          className={simulation.positioningChoice === choice.id ? 'load-choice selected' : 'load-choice'}
          onClick={() => choosePositioning(choice)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  )

  const renderStability = () => (
    <div className="load-task-stack">
      <p className="task-note">Select the load position that keeps the center of gravity in the safest zone.</p>
      {stabilityStates.map((state) => (
        <button
          key={state.id}
          type="button"
          className={simulation.stabilityChoice === state.id ? 'load-choice selected' : 'load-choice'}
          onClick={() => chooseStability(state)}
        >
          {state.label}
        </button>
      ))}
    </div>
  )

  const renderControls = () => (
    <div className="load-task-stack">
      <div className="hydraulic-panel">
        {hydraulicControlSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={simulation.controlsCompleted.includes(step.id) ? 'control-lever done' : 'control-lever'}
            onClick={() => completeControlStep(step)}
          >
            {step.label}
          </button>
        ))}
      </div>
      <p className="task-note">These controls are conceptual UI practice only. Real equipment must be handled under supervision.</p>
    </div>
  )

  const renderHazardSurvey = () => (
    <div className="load-task-stack">
      <p className="task-note">Click all visible hazards in the worksite scene.</p>
      <div className="hazard-list">
        {worksiteHazards.map((hazard) => (
          <span key={hazard.id} className={foundHazardSet.has(hazard.id) ? 'found' : ''}>
            {hazard.label}
          </span>
        ))}
      </div>
    </div>
  )

  const renderSummary = () => (
    <div className="load-task-stack">
      <div className="summary-grid">
        <div><span>Positioning</span><strong>{simulation.positioningChoice === 'slow-square' ? 'Safe' : 'Open'}</strong></div>
        <div><span>Stability</span><strong>{simulation.stabilityChoice === 'centered-low' ? 'Safe' : 'Open'}</strong></div>
        <div><span>Controls</span><strong>{simulation.controlsCompleted.length}/{hydraulicControlSteps.length}</strong></div>
        <div><span>Hazards</span><strong>{simulation.hazardsFound.length}/{worksiteHazards.length}</strong></div>
      </div>
      <button type="button" className={simulation.checkpointPassed ? 'checkpoint-button done' : 'checkpoint-button'} onClick={passCheckpoint}>
        Checkpoint: load is centered, low, and within rated capacity
      </button>
      <p className={simulation.complete ? 'completion-ready' : 'completion-warning'}>
        {simulation.complete
          ? 'All requirements are complete. Submit the module to record completion feedback.'
          : 'Complete all load-handling tasks and pass the checkpoint to finish this module.'}
      </p>
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'briefing') return renderBriefing()
    if (currentStep.id === 'maneuvering-positioning') return renderPositioning()
    if (currentStep.id === 'stability-triangle') return renderStability()
    if (currentStep.id === 'hydraulic-controls') return renderControls()
    if (currentStep.id === 'area-safety-survey') return renderHazardSurvey()
    return renderSummary()
  }

  return (
    <div className="module-page-container load-simulation-page">
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
          score={simulation.percentage}
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

export default LoadHandlingPage
