import { useMemo, useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ModuleSummary from './components/ModuleSummary'
import { BriefingScene, BriefingTask } from './components/ModuleBriefing'
import { ChecklistScene, ModuleRowsTask, QuizScene } from './components/ModuleChecklistStep'
import { useModuleCourses } from './hooks/useModuleCourses'
import { useModuleRecord } from './hooks/useModuleRecord'
import { useProgress } from './hooks/useProgress'
import { courseTaskCopy } from './lib/courseGoals'
import { moduleObjectives } from './lib/moduleContent'
import { buildSimulationState, isStepComplete, withStepComplete } from './lib/simulationProgress'
import './LoadHandlingPage.css'

const NEXT_MODULE_DELAY_MS = 1400

// The equivalent of LoadHandlingPage/PostOperationPage/etc for any equipment
// other than Forklift: those pages are each hardcoded to one known
// moduleSlug because Forklift's 4 modules are a fixed, known set. Every other
// equipment's modules are admin-created and arbitrary, so this page takes its
// moduleSlug from the route instead and otherwise runs the same generic
// step-kind rendering ModuleSimulationShell already supports.
//
// `driving`-kind steps render through DrivingSimulationViewer same as
// Forklift's, but that component still defaults to forklift.glb when no
// equipment has its own model configured (see AdminDashboard's Model URL
// field - not built yet). An admin adding a driving step for equipment with
// no model of its own will see Forklift's model rather than a broken viewer.
function GenericModulePage({ equipmentId, moduleSlug, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  // fullTitle deliberately left blank in the fallback: useModuleRecord only
  // overrides a field when the DB row has a non-empty value for it, so a
  // non-blank fallback here would permanently shadow the DB row's title
  // whenever fullTitle hasn't been filled in yet.
  const module = useModuleRecord(moduleSlug, { title: 'Module', fullTitle: '' })
  const { steps, stepById, courseById, loading, error } = useModuleCourses(moduleSlug)
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const gradedStepIds = useMemo(
    () => steps.filter((step) => courseById[step.id]).map((step) => step.id),
    [steps, courseById],
  )
  const simulation = buildSimulationState(
    { ...savedSimulation, engineStarted: savedSimulation.engineStarted || false },
    gradedStepIds,
  )

  const saveSimulation = (partial) => {
    const next = buildSimulationState({ ...simulation, ...partial }, gradedStepIds)
    updateSimulation(moduleSlug, next)
    return next
  }

  const markStepComplete = (stepId, partial = {}) =>
    saveSimulation({ ...partial, ...withStepComplete(simulation, stepId) })

  // A `free` course (no checkpoints/pallet/bay) has no built-in completion
  // signal, so the only thing there is to grade generically is "the learner
  // started the engine and drove" - unlike Load Handling's own WASD-tracking
  // design, which is a pedagogical choice specific to that module.
  const handleDrivingEvent = (currentStep) => (event) => {
    const isFreePractice = courseById[currentStep.id]?.goalType === 'free'

    if (event.type === 'engine-on') {
      if (isFreePractice && gradedStepIds.includes(currentStep.id)) {
        markStepComplete(currentStep.id, { engineStarted: true })
      }
      return
    }

    if (event.type === 'course-complete' || event.type === 'pallet-delivered' || event.type === 'parking-complete') {
      if (gradedStepIds.includes(currentStep.id)) {
        markStepComplete(currentStep.id)
      }
    }
  }

  const completeModule = () => {
    if (!simulation.complete && gradedStepIds.length > 0) return

    setTimeout(() => onNavigate?.(`/training/${equipmentId}`), NEXT_MODULE_DELAY_MS)
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
    if (step?.kind === 'briefing') return <BriefingTask content={step.content} module={module} />
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
          <h1>{module.fullTitle || module.title}</h1>
        </div>
      </header>

      <main className="module-content wide-simulation-content">
        {loading || error ? (
          <ModuleLoadingState loading={loading} error={error} />
        ) : !steps.length ? (
          <div className="module-loading-state">
            <p>This module has no steps yet. An admin can add one from the Courses tab.</p>
          </div>
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

export default GenericModulePage
