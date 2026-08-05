import { useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { drivingCourses } from './data/drivingCourse'
import { routes } from './lib/router'
import { equipmentUsageModules, moduleScenarioSteps } from './lib/trainingData'
import './LoadHandlingPage.css'
import './PalletTestingPage.css'

const moduleSlug = 'pallet-testing'
const NEXT_MODULE_DELAY_MS = 1400

const completionFieldByStep = {
  'precision-carry': 'carryComplete',
  'load-limits': 'limitsComplete',
}

function calculateSimulationState(nextState) {
  const flags = [nextState.carryComplete, nextState.limitsComplete]
  const percentage = Math.round((flags.filter(Boolean).length / flags.length) * 100)

  return { ...nextState, percentage, complete: percentage === 100 }
}

function AssessmentBriefing() {
  return (
    <div className="pallet-briefing">
      <h3>Fail Conditions</h3>
      <ul>
        <li>
          <strong>Overload tip-over</strong> - lifting a pallet heavier than the rated capacity shifts the center of
          gravity past the front axle and pitches the forklift forward.
        </li>
        <li>
          <strong>Cone strike</strong> - touching any traffic cone ends the attempt, the same as striking a pedestrian
          lane marker in a practical evaluation.
        </li>
        <li>
          <strong>Load thrown off</strong> - braking hard above walking speed throws the pallet off the forks. Slow
          down early and brake gently while carrying.
        </li>
      </ul>
      <p>
        Rated capacity in this assessment: <strong>1,000 kg</strong>. After a fail, use <strong>Reset Attempt</strong>
        {' '}and try again - failed attempts are counted but never block completion.
      </p>
    </div>
  )
}

function PalletTestingPage({ moduleName, onBack, onNavigate }) {
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const steps = moduleScenarioSteps[moduleSlug]
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [lastFail, setLastFail] = useState(null)
  const simulation = calculateSimulationState({
    carryComplete: savedSimulation.carryComplete || false,
    limitsComplete: savedSimulation.limitsComplete || false,
    failedAttempts: savedSimulation.failedAttempts || 0,
    percentage: savedSimulation.percentage || 0,
    complete: savedSimulation.complete || false,
  })

  const saveSimulation = (partial) => {
    const next = calculateSimulationState({ ...simulation, ...partial })
    updateSimulation(moduleSlug, next)
    return next
  }

  const handleDrivingEvent = (currentStep) => (event) => {
    if (event.type === 'sim-failed') {
      setLastFail({ stepId: currentStep.id, title: event.title, message: event.message })
      saveSimulation({ failedAttempts: simulation.failedAttempts + 1 })
      return
    }

    if (event.type === 'pallet-delivered') {
      const completionField = completionFieldByStep[currentStep.id]
      if (completionField) {
        setLastFail(null)
        saveSimulation({ [completionField]: true })
      }
    }
  }

  const completeModule = () => {
    if (!simulation.complete) return

    setTimeout(() => onNavigate?.(routes.equipment), NEXT_MODULE_DELAY_MS)
  }

  const getStepCanProceed = (stepId) => {
    if (stepId === 'precision-carry') return simulation.carryComplete
    if (stepId === 'load-limits') return simulation.limitsComplete
    return true
  }

  const changeStep = (nextIndex) => {
    setLastFail(null)
    setCurrentStepIndex(nextIndex)
  }

  const renderScene = ({ currentStep }) => {
    if (currentStep.id === 'briefing') {
      return <AssessmentBriefing />
    }

    const course = drivingCourses[currentStep.id]

    if (course) {
      return (
        <div className="load-scene-wrap">
          <DrivingSimulationViewer course={course} onEvent={handleDrivingEvent(currentStep)} />
        </div>
      )
    }

    return <AssessmentBriefing />
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

  const renderCourseTask = (currentStep) => {
    const done = getStepCanProceed(currentStep.id)
    const failVisible = lastFail && lastFail.stepId === currentStep.id && !done

    return (
      <div className="load-task-stack">
        {failVisible && (
          <p className="pallet-fail-note">
            <strong>{lastFail.title}.</strong> {lastFail.message}
          </p>
        )}
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done
            ? 'Step complete. Use Next to continue.'
            : currentStep.id === 'precision-carry'
              ? 'Pick up the pallet, keep it clear of every cone in the lane, and set it down in the drop zone. Brake gently - a hard stop throws the load.'
              : 'Check each weight label against the 1,000 kg capacity, lift a safe pallet, and deliver it to the drop zone.'}
        </p>
      </div>
    )
  }

  const renderSummary = () => (
    <div className="load-task-stack">
      <div className="summary-grid">
        <div><span>Precision Carry</span><strong>{simulation.carryComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Load Limits</span><strong>{simulation.limitsComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Failed Attempts</span><strong>{simulation.failedAttempts}</strong></div>
      </div>
      <p className={simulation.complete ? 'completion-ready' : 'completion-warning'}>
        {simulation.complete
          ? 'All requirements are complete. Submit the module to record completion feedback.'
          : 'Complete the precision carry and load limit exercises to finish this module.'}
      </p>
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'briefing') return renderBriefing()
    if (drivingCourses[currentStep.id]) return renderCourseTask(currentStep)
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
          onBackStep={() => changeStep(Math.max(currentStepIndex - 1, 0))}
          onNextStep={() => changeStep(Math.min(currentStepIndex + 1, steps.length - 1))}
          onComplete={completeModule}
          renderScene={renderScene}
          renderTask={renderTask}
          completionSummary={renderSummary()}
        />
      </main>
    </div>
  )
}

export default PalletTestingPage
