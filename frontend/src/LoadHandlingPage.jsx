import { useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import InteractiveForkliftViewer from './components/InteractiveForkliftViewer'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { drivingCourses } from './data/drivingCourse'
import { loadHandlingViewerHotspots } from './data/viewerHotspots'
import { routes } from './lib/router'
import { equipmentUsageModules, forkliftEquipment, moduleScenarioSteps } from './lib/trainingData'
import './LoadHandlingPage.css'

const moduleSlug = 'load-handling'
const NEXT_MODULE_DELAY_MS = 1400
const loadViewerActiveHotspots = ['forks', 'carriage', 'mast-assembly', 'tire-condition', 'operator-area']
const REQUIRED_CONTROL_KEYS = ['w', 'a', 's', 'd']

const completionFieldByStep = {
  'accelerate-course': 'accelerateComplete',
  'accelerate-brake': 'brakeComplete',
  'turning-practice': 'turningComplete',
  'driving-course': 'drivingCourseComplete',
  'pallet-pickup': 'palletComplete',
}

function calculateSimulationState(nextState) {
  const flags = [
    nextState.engineStarted,
    nextState.accelerateComplete,
    nextState.brakeComplete,
    nextState.turningComplete,
    nextState.drivingCourseComplete,
    nextState.palletComplete,
  ]
  const percentage = Math.round((flags.filter(Boolean).length / flags.length) * 100)
  const complete = percentage === 100

  return { ...nextState, percentage, complete }
}

function unique(items) {
  return [...new Set(items)]
}

function ControlsDiagram() {
  return (
    <div className="controls-diagram">
      <div className="controls-diagram-pad">
        <span className="controls-diagram-key key-w">W</span>
        <span className="controls-diagram-key key-a">A</span>
        <span className="controls-diagram-key key-s">S</span>
        <span className="controls-diagram-key key-d">D</span>
      </div>
      <ul className="controls-diagram-legend">
        <li><strong>W</strong> Accelerate forward</li>
        <li><strong>A</strong> Steer left</li>
        <li><strong>S</strong> Brake / reverse</li>
        <li><strong>D</strong> Steer right</li>
      </ul>
      <div className="controls-diagram-engine">
        <span className="controls-diagram-key key-e">E</span>
        <p>Start or stop the engine</p>
      </div>
    </div>
  )
}

function LoadHandlingPage({ moduleName, onBack, onNavigate }) {
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const steps = moduleScenarioSteps[moduleSlug]
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const simulation = calculateSimulationState({
    engineStarted: savedSimulation.engineStarted || false,
    keysUsed: savedSimulation.keysUsed || [],
    accelerateComplete: savedSimulation.accelerateComplete || false,
    brakeComplete: savedSimulation.brakeComplete || false,
    turningComplete: savedSimulation.turningComplete || false,
    drivingCourseComplete: savedSimulation.drivingCourseComplete || false,
    palletComplete: savedSimulation.palletComplete || false,
    percentage: savedSimulation.percentage || 0,
    complete: savedSimulation.complete || false,
  })

  const saveSimulation = (partial) => {
    const next = calculateSimulationState({ ...simulation, ...partial })
    updateSimulation(moduleSlug, next)
    return next
  }

  const handleViewerHotspot = () => {}

  const handleDrivingEvent = (currentStep) => (event) => {
    if (event.type === 'key-active') {
      if (currentStep.id === 'controls-intro' && !simulation.keysUsed.includes(event.key)) {
        saveSimulation({ keysUsed: unique([...simulation.keysUsed, event.key]) })
      }
      return
    }

    if (event.type === 'engine-on') {
      if (currentStep.id === 'controls-intro') {
        saveSimulation({ engineStarted: true })
      }
      return
    }

    if (event.type === 'engine-off') {
      return
    }

    if (event.type === 'checkpoint') {
      return
    }

    if (event.type === 'pallet-lifted' || event.type === 'pallet-dropped') {
      return
    }

    if (event.type === 'pallet-delivered') {
      const completionField = completionFieldByStep[currentStep.id]
      if (completionField) {
        saveSimulation({ [completionField]: true })
      }
      return
    }

    if (event.type === 'course-complete') {
      const completionField = completionFieldByStep[currentStep.id]
      if (completionField) {
        saveSimulation({ [completionField]: true })
      }
    }
  }

  const completeModule = () => {
    if (!simulation.complete) return

    setTimeout(() => onNavigate?.(routes.postOperation), NEXT_MODULE_DELAY_MS)
  }

  const getStepCanProceed = (stepId) => {
    if (stepId === 'controls-intro') {
      return simulation.engineStarted && REQUIRED_CONTROL_KEYS.every((key) => simulation.keysUsed.includes(key))
    }
    if (stepId === 'accelerate-course') return simulation.accelerateComplete
    if (stepId === 'accelerate-brake') return simulation.brakeComplete
    if (stepId === 'turning-practice') return simulation.turningComplete
    if (stepId === 'driving-course') return simulation.drivingCourseComplete
    if (stepId === 'pallet-pickup') return simulation.palletComplete
    return true
  }

  const renderScene = ({ currentStep }) => {
    if (currentStep.id === 'briefing') {
      return <ControlsDiagram />
    }

    const course = drivingCourses[currentStep.id]

    if (course) {
      return (
        <div className="load-scene-wrap">
          <DrivingSimulationViewer course={course} onEvent={handleDrivingEvent(currentStep)} />
        </div>
      )
    }

    return (
      <div className="load-scene-wrap">
        <InteractiveForkliftViewer
          mode="load-handling"
          scenario="good-forklift"
          activeHotspots={loadViewerActiveHotspots}
          hotspots={loadHandlingViewerHotspots}
          modelUrl={forkliftEquipment.modelUrl}
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

  const renderDrivingTask = (currentStep) => {
    const course = drivingCourses[currentStep.id]
    const checkpointCount = course?.checkpoints?.length || 0
    const done = getStepCanProceed(currentStep.id)

    if (currentStep.id === 'controls-intro') {
      const remainingKeys = REQUIRED_CONTROL_KEYS.filter((key) => !simulation.keysUsed.includes(key))
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

    if (currentStep.id === 'pallet-pickup') {
      return (
        <div className="load-task-stack">
          <p className={done ? 'completion-ready' : 'task-note'}>
            {done
              ? 'Step complete. Use Next to continue.'
              : 'Slide the lowered forks under the pallet, raise it with R, carry it to the drop zone, then lower with F and reverse away.'}
          </p>
        </div>
      )
    }

    return (
      <div className="load-task-stack">
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done
            ? 'Step complete. Use Next to continue.'
            : checkpointCount
              ? `Drive through ${checkpointCount} checkpoint${checkpointCount > 1 ? 's' : ''} to finish this step.`
              : 'Press E to start the engine to finish this step.'}
        </p>
      </div>
    )
  }

  const renderSummary = () => (
    <div className="load-task-stack">
      <div className="summary-grid">
        <div><span>Engine Start</span><strong>{simulation.engineStarted ? 'Complete' : 'Open'}</strong></div>
        <div><span>Accelerate</span><strong>{simulation.accelerateComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Brake</span><strong>{simulation.brakeComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Turning</span><strong>{simulation.turningComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Driving Course</span><strong>{simulation.drivingCourseComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Pallet Handling</span><strong>{simulation.palletComplete ? 'Complete' : 'Open'}</strong></div>
      </div>
      <p className={simulation.complete ? 'completion-ready' : 'completion-warning'}>
        {simulation.complete
          ? 'All requirements are complete. Submit the module to record completion feedback.'
          : 'Complete all guided driving tasks to finish this module.'}
      </p>
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'briefing') return renderBriefing()
    if (drivingCourses[currentStep.id]) return renderDrivingTask(currentStep)
    return null
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

export default LoadHandlingPage
