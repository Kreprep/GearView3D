import { useMemo, useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ModuleSummary from './components/ModuleSummary'
import { BriefingScene, BriefingTask } from './components/ModuleBriefing'
import { FORKLIFT_SCOPE_NOTE } from './components/ScopeNotice'
import { ChecklistScene, ModuleRowsTask, QuizScene } from './components/ModuleChecklistStep'
import { useModuleCourses } from './hooks/useModuleCourses'
import { useModuleRecord } from './hooks/useModuleRecord'
import { useProgress } from './hooks/useProgress'
import { courseTaskCopy } from './lib/courseGoals'
import { moduleObjectives, nextModuleRoute } from './lib/moduleContent'
import { buildSimulationState, isStepComplete, withStepComplete } from './lib/simulationProgress'
import { equipmentUsageModules } from './lib/trainingData'
import './LoadHandlingPage.css'
import './PalletTestingPage.css'

const moduleSlug = 'pallet-testing'
const NEXT_MODULE_DELAY_MS = 1400

// Reads snapshots written before completion moved to a step-id map.
const legacyStepFields = {
  'precision-carry': 'carryComplete',
  'load-limits': 'limitsComplete',
}

function PalletTestingPage({ moduleName, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  const module = useModuleRecord(moduleSlug, equipmentUsageModules.find((item) => item.slug === moduleSlug))
  const { steps, stepById, courseById, loading, error } = useModuleCourses(moduleSlug)
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [lastFail, setLastFail] = useState(null)
  // Every step backed by a driving course is graded; briefing and summary are not.
  const gradedStepIds = useMemo(
    () => steps.filter((step) => courseById[step.id]).map((step) => step.id),
    [steps, courseById],
  )
  const simulation = buildSimulationState(
    { ...savedSimulation, failedAttempts: savedSimulation.failedAttempts || 0 },
    gradedStepIds,
    legacyStepFields,
  )

  const saveSimulation = (partial) => {
    const next = buildSimulationState({ ...simulation, ...partial }, gradedStepIds, legacyStepFields)
    updateSimulation(moduleSlug, next)
    return next
  }

  const handleDrivingEvent = (currentStep) => (event) => {
    if (event.type === 'sim-failed') {
      setLastFail({ stepId: currentStep.id, title: event.title, message: event.message })
      saveSimulation({ failedAttempts: simulation.failedAttempts + 1 })
      return
    }

    // Whichever goal the course defines, reaching it completes that step.
    if (event.type === 'pallet-delivered' || event.type === 'course-complete' || event.type === 'parking-complete') {
      if (gradedStepIds.includes(currentStep.id)) {
        setLastFail(null)
        saveSimulation(withStepComplete(simulation, currentStep.id))
      }
    }
  }

  const completeModule = () => {
    if (!simulation.complete) return

    setTimeout(() => onNavigate?.(nextModuleRoute(steps, 'equipment')), NEXT_MODULE_DELAY_MS)
  }

  const getStepCanProceed = (stepId) =>
    gradedStepIds.includes(stepId) ? isStepComplete(simulation, stepId) : true

  const changeStep = (nextIndex) => {
    setLastFail(null)
    setCurrentStepIndex(nextIndex)
  }

  const renderScene = ({ currentStep }) => {
    const step = stepById[currentStep.id]

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
          <DrivingSimulationViewer course={course} onEvent={handleDrivingEvent(currentStep)} isAdmin={isAdmin} />
        </div>
      )
    }

    return null
  }

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
          {done ? 'Step complete. Use Next to continue.' : courseTaskCopy(courseById[currentStep.id])}
        </p>
      </div>
    )
  }

  const summaryStep = steps.find((step) => step.kind === 'summary')

  const renderTask = ({ currentStep }) => {
    const step = stepById[currentStep.id]
    if (step?.kind === 'briefing') return <BriefingTask content={step.content} module={module} scopeNote={FORKLIFT_SCOPE_NOTE} />
    if (step?.kind === 'checklist' || step?.kind === 'quiz') {
      return <ModuleRowsTask content={step.content} kind={step.kind} />
    }
    if (courseById[currentStep.id]) return renderCourseTask(currentStep)
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
            objectives={moduleObjectives(steps, module)}
            progress={simulation.percentage}
            score={simulation.percentage}
            canProceed={getStepCanProceed(steps[currentStepIndex].id)}
            onBackStep={() => changeStep(Math.max(currentStepIndex - 1, 0))}
            onNextStep={() => changeStep(Math.min(currentStepIndex + 1, steps.length - 1))}
            onComplete={completeModule}
            renderScene={renderScene}
            renderTask={renderTask}
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
      </main>
    </div>
  )
}

export default PalletTestingPage
