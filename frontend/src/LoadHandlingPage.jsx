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

const moduleSlug = 'load-handling'
const NEXT_MODULE_DELAY_MS = 1400
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

function LoadHandlingPage({ moduleName, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  const module = useModuleRecord(moduleSlug, equipmentUsageModules.find((item) => item.slug === moduleSlug))
  const { steps, stepById, courseById, loading, error } = useModuleCourses(moduleSlug)
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
      keysUsedByStep: savedSimulation.keysUsedByStep || {},
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

    if (event.type === 'engine-off' || event.type === 'checkpoint') {
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

    setTimeout(() => onNavigate?.(nextModuleRoute(steps, 'postOperation')), NEXT_MODULE_DELAY_MS)
  }

  const getStepCanProceed = (stepId) =>
    gradedStepIds.includes(stepId) ? isStepComplete(simulation, stepId) : true

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

  const renderDrivingTask = (currentStep) => {
    const course = courseById[currentStep.id]
    const done = getStepCanProceed(currentStep.id)

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
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done ? 'Step complete. Use Next to continue.' : courseTaskCopy(course)}
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
            objectives={moduleObjectives(steps, module)}
            progress={simulation.percentage}
            score={simulation.percentage}
            canProceed={getStepCanProceed(steps[currentStepIndex].id)}
            onBackStep={() => setCurrentStepIndex((index) => Math.max(index - 1, 0))}
            onNextStep={() => setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1))}
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

export default LoadHandlingPage
