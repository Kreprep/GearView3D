import { useMemo, useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import InteractiveForkliftViewer from './components/InteractiveForkliftViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useModuleCourses } from './hooks/useModuleCourses'
import { useProgress } from './hooks/useProgress'
import { loadHandlingViewerHotspots } from './data/viewerHotspots'
import { courseTaskCopy } from './lib/courseGoals'
import { routes } from './lib/router'
import { buildSimulationState, isStepComplete, withStepComplete } from './lib/simulationProgress'
import { equipmentUsageModules, forkliftEquipment } from './lib/trainingData'
import './LoadHandlingPage.css'

const moduleSlug = 'load-handling'
const NEXT_MODULE_DELAY_MS = 1400
const loadViewerActiveHotspots = ['forks', 'carriage', 'mast-assembly', 'tire-condition', 'operator-area']
const REQUIRED_CONTROL_KEYS = ['w', 'a', 's', 'd']

// Reads snapshots written before completion moved to a step-id map.
const legacyStepFields = {
  'controls-intro': (saved) =>
    saved.engineStarted && REQUIRED_CONTROL_KEYS.every((key) => (saved.keysUsed || []).includes(key)),
  'accelerate-course': 'accelerateComplete',
  'accelerate-brake': 'brakeComplete',
  'turning-practice': 'turningComplete',
  'driving-course': 'drivingCourseComplete',
  'pallet-pickup': 'palletComplete',
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

function LoadHandlingPage({ moduleName, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const { steps, courseById, loading, error } = useModuleCourses(moduleSlug)
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  // Every step backed by a driving course is graded; briefing and summary are not.
  const gradedStepIds = useMemo(
    () => steps.filter((step) => courseById[step.id]).map((step) => step.id),
    [steps, courseById],
  )
  const simulation = buildSimulationState(
    {
      ...savedSimulation,
      engineStarted: savedSimulation.engineStarted || false,
      keysUsed: savedSimulation.keysUsed || [],
    },
    gradedStepIds,
    legacyStepFields,
  )

  const saveSimulation = (partial) => {
    const next = buildSimulationState({ ...simulation, ...partial }, gradedStepIds, legacyStepFields)
    updateSimulation(moduleSlug, next)
    return next
  }

  const markStepComplete = (stepId, partial = {}) =>
    saveSimulation({ ...partial, ...withStepComplete(simulation, stepId) })

  // Controls intro has no checkpoints - it completes once the engine is running
  // and every control key has been pressed at least once.
  const saveControlsIntro = (partial) => {
    const merged = { ...simulation, ...partial }
    const done = merged.engineStarted && REQUIRED_CONTROL_KEYS.every((key) => merged.keysUsed.includes(key))
    saveSimulation(done ? { ...partial, ...withStepComplete(simulation, 'controls-intro') } : partial)
  }

  const handleViewerHotspot = () => {}

  const handleDrivingEvent = (currentStep) => (event) => {
    if (event.type === 'key-active') {
      if (currentStep.id === 'controls-intro' && !simulation.keysUsed.includes(event.key)) {
        saveControlsIntro({ keysUsed: unique([...simulation.keysUsed, event.key]) })
      }
      return
    }

    if (event.type === 'engine-on') {
      if (currentStep.id === 'controls-intro') {
        saveControlsIntro({ engineStarted: true })
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

    // Whichever goal the course defines, reaching it completes that step.
    if (event.type === 'course-complete' || event.type === 'pallet-delivered' || event.type === 'parking-complete') {
      if (gradedStepIds.includes(currentStep.id)) {
        markStepComplete(currentStep.id)
      }
    }
  }

  const completeModule = () => {
    if (!simulation.complete) return

    setTimeout(() => onNavigate?.(routes.postOperation), NEXT_MODULE_DELAY_MS)
  }

  const getStepCanProceed = (stepId) =>
    gradedStepIds.includes(stepId) ? isStepComplete(simulation, stepId) : true

  const renderScene = ({ currentStep }) => {
    if (currentStep.id === 'briefing') {
      return <ControlsDiagram />
    }

    const course = courseById[currentStep.id]

    if (course) {
      return (
        <div className="load-scene-wrap">
          <DrivingSimulationViewer course={course} onEvent={handleDrivingEvent(currentStep)} isAdmin={isAdmin} />
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
          isAdmin={isAdmin}
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
    const course = courseById[currentStep.id]
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

    return (
      <div className="load-task-stack">
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done ? 'Step complete. Use Next to continue.' : courseTaskCopy(course)}
        </p>
      </div>
    )
  }

  const renderSummary = () => (
    <div className="load-task-stack">
      <div className="summary-grid">
        {gradedStepIds.map((stepId) => (
          <div key={stepId}>
            <span>{steps.find((step) => step.id === stepId)?.title || stepId}</span>
            <strong>{isStepComplete(simulation, stepId) ? 'Complete' : 'Open'}</strong>
          </div>
        ))}
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
    if (courseById[currentStep.id]) return renderDrivingTask(currentStep)
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
        {loading || error ? (
          <ModuleLoadingState loading={loading} error={error} />
        ) : (
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
        )}
      </main>
    </div>
  )
}

export default LoadHandlingPage
