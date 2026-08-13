import { useMemo, useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ModuleSummary from './components/ModuleSummary'
import SimulationPageLayout from './components/SimulationPageLayout'
import { BriefingScene, BriefingTask } from './components/ModuleBriefing'
import { ReportingActivity, ShutdownSequenceActivity } from './components/ModuleActivities'
import { ACTIVITY_IDS } from './lib/activitySteps'
import { FORKLIFT_SCOPE_NOTE } from './components/ScopeNotice'
import { ChecklistScene, ModuleRowsTask, QuizScene } from './components/ModuleChecklistStep'
import { useModuleCourses } from './hooks/useModuleCourses'
import { useModuleRecord } from './hooks/useModuleRecord'
import { useProgress } from './hooks/useProgress'
import { courseTaskCopy } from './lib/courseGoals'
import { legacyStepFieldsFor, REQUIRED_CONTROL_KEYS } from './lib/legacyStepFields'
import { moduleObjectives, nextModuleRoute } from './lib/moduleContent'
import { buildSimulationState, isStepComplete, withStepComplete } from './lib/simulationProgress'
import { equipmentUsageModules } from './lib/trainingData'
import './GenericModulePage.css'

const NEXT_MODULE_DELAY_MS = 1400

function unique(items) {
  return [...new Set(items)]
}

// The one module page for every equipment's course-backed modules, Forklift
// included - it renders whatever typed step rows the module has (briefing,
// driving, checklist, quiz, activity, summary), so the only module page left
// outside it is Forklift's hardcoded Walk-Around Check.
//
// `driving`-kind steps render through DrivingSimulationViewer, which still
// defaults to forklift.glb when no equipment has its own model configured -
// an admin adding a driving step for equipment with no model of its own sees
// Forklift's model rather than a broken viewer.
function GenericModulePage({ equipmentId, moduleSlug, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  const isForklift = equipmentId === 'forklift'
  // Forklift's modules keep their static definitions as the fallback record
  // (objectives, fullTitle); admin-created modules fall back to a blank
  // fullTitle deliberately - useModuleRecord only overrides a field when the
  // DB row has a non-empty value, so a non-blank fallback would permanently
  // shadow a row whose fullTitle hasn't been filled in yet.
  const module = useModuleRecord(
    moduleSlug,
    equipmentUsageModules.find((item) => item.slug === moduleSlug) || { title: 'Module', fullTitle: '' },
  )
  const { steps, stepById, courseById, loading, error } = useModuleCourses(moduleSlug)
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [lastFail, setLastFail] = useState(null)
  const [shutdownPicked, setShutdownPicked] = useState([])
  const [wrongPickId, setWrongPickId] = useState(null)
  const [reportAnswers, setReportAnswers] = useState({})
  const legacyStepFields = legacyStepFieldsFor(moduleSlug)

  // Steps backed by a driving course are graded, as are the built-in
  // activities; briefing, checklist, quiz and summary steps are not.
  const gradedStepIds = useMemo(
    () =>
      steps
        .filter(
          (step) =>
            courseById[step.id] || (step.kind === 'activity' && ACTIVITY_IDS.includes(step.content?.activityId)),
        )
        .map((step) => step.id),
    [steps, courseById],
  )
  const simulation = buildSimulationState(
    {
      ...savedSimulation,
      engineStarted: savedSimulation.engineStarted || false,
      keysUsedByStep: savedSimulation.keysUsedByStep || {},
      failedAttempts: savedSimulation.failedAttempts || 0,
      shutdownMistakes: savedSimulation.shutdownMistakes || 0,
    },
    gradedStepIds,
    legacyStepFields,
  )
  const shutdownComplete = isStepComplete(simulation, 'shutdown-sequence')
  const reportingComplete = isStepComplete(simulation, 'reporting')

  // Both activities are graded against their own row's content, so a prompt an
  // admin adds is required and one they delete stops blocking completion.
  const activityContent = (activityId) =>
    steps.find((step) => step.content?.activityId === activityId)?.content || {}
  const shutdownActions = activityContent('shutdown-sequence').actions || []
  const shutdownDisplayOrder = activityContent('shutdown-sequence').displayOrder || []
  const reportPrompts = activityContent('reporting').prompts || []

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

    if (event.type === 'sim-failed') {
      setLastFail({ stepId: currentStep.id, title: event.title, message: event.message })
      saveSimulation({ failedAttempts: simulation.failedAttempts + 1 })
      return
    }

    // Whichever goal the course defines, reaching it completes that step.
    if (event.type === 'course-complete' || event.type === 'pallet-delivered' || event.type === 'parking-complete') {
      if (gradedStepIds.includes(currentStep.id)) {
        setLastFail(null)
        markStepComplete(currentStep.id)
      }
    }
  }

  const handleShutdownPick = (action) => {
    if (shutdownComplete) return
    const expectedOrder = shutdownPicked.length + 1

    if (action.order === expectedOrder) {
      const nextPicked = [...shutdownPicked, action.id]
      setShutdownPicked(nextPicked)
      setWrongPickId(null)
      if (nextPicked.length === shutdownActions.length) {
        saveSimulation(withStepComplete(simulation, 'shutdown-sequence'))
      }
    } else {
      setWrongPickId(action.id)
      saveSimulation({ shutdownMistakes: simulation.shutdownMistakes + 1 })
      setTimeout(() => setWrongPickId(null), 700)
    }
  }

  const handleReportAnswer = (prompt, choice) => {
    if (reportingComplete) return
    const correct = choice === prompt.shouldReport
    const nextAnswers = { ...reportAnswers, [prompt.id]: { choice, correct } }
    setReportAnswers(nextAnswers)

    const allCorrect = reportPrompts.every((item) => nextAnswers[item.id]?.correct)
    if (allCorrect) {
      saveSimulation(withStepComplete(simulation, 'reporting'))
    }
  }

  const completeModule = () => {
    if (!simulation.complete && gradedStepIds.length > 0) return

    // The summary step's stored nextRoute wins when it resolves; otherwise
    // return to the equipment's module list to pick the next one.
    setTimeout(() => onNavigate?.(nextModuleRoute(steps) || `/training/${equipmentId}/modules`), NEXT_MODULE_DELAY_MS)
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

    if (step?.content?.activityId === 'shutdown-sequence') {
      return (
        <ShutdownSequenceActivity
          actions={shutdownActions}
          displayOrder={shutdownDisplayOrder}
          pickedIds={shutdownPicked}
          completed={shutdownComplete}
          wrongPickId={wrongPickId}
          onPick={handleShutdownPick}
        />
      )
    }

    if (step?.content?.activityId === 'reporting') {
      return (
        <ReportingActivity
          prompts={reportPrompts}
          answers={reportAnswers}
          completed={reportingComplete}
          onAnswer={handleReportAnswer}
        />
      )
    }

    return null
  }

  const renderDrivingTask = (currentStep) => {
    const course = courseById[currentStep.id]
    const done = getStepCanProceed(currentStep.id)
    const failVisible = lastFail && lastFail.stepId === currentStep.id && !done

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
        {failVisible && (
          <p className="pallet-fail-note">
            <strong>{lastFail.title}.</strong> {lastFail.message}
          </p>
        )}
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done ? 'Step complete. Use Next to continue.' : courseTaskCopy(course)}
        </p>
      </div>
    )
  }

  const renderShutdownTask = () => (
    <div className="load-task-stack">
      <p className={shutdownComplete ? 'completion-ready' : 'task-note'}>
        {shutdownComplete
          ? 'Step complete. Use Next to continue.'
          : `Select the shutdown actions in the correct order (${shutdownPicked.length} of ${shutdownActions.length} placed). Wrong picks are counted: ${simulation.shutdownMistakes}.`}
      </p>
    </div>
  )

  const renderReportingTask = () => {
    const correctCount = reportPrompts.filter((item) => reportAnswers[item.id]?.correct).length
    return (
      <div className="load-task-stack">
        <p className={reportingComplete ? 'completion-ready' : 'task-note'}>
          {reportingComplete
            ? 'Step complete. Use Next to continue.'
            : `Decide Report or No Action for each condition (${correctCount} of ${reportPrompts.length} correct). Wrong answers can be retried.`}
        </p>
      </div>
    )
  }

  const summaryStep = steps.find((step) => step.kind === 'summary')

  const renderTask = ({ currentStep }) => {
    const step = stepById[currentStep.id]
    if (step?.kind === 'briefing') {
      return (
        <BriefingTask content={step.content} module={module} scopeNote={isForklift ? FORKLIFT_SCOPE_NOTE : undefined} />
      )
    }
    if (step?.kind === 'checklist' || step?.kind === 'quiz') {
      return <ModuleRowsTask content={step.content} kind={step.kind} />
    }
    if (courseById[currentStep.id]) return renderDrivingTask(currentStep)
    if (step?.content?.activityId === 'shutdown-sequence') return renderShutdownTask()
    if (step?.content?.activityId === 'reporting') return renderReportingTask()
    return null
  }

  return (
    <SimulationPageLayout
      className="load-simulation-page"
      title={module.fullTitle || module.title}
      subtitle="Guided Simulation"
      onBack={onBack}
    >
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
    </SimulationPageLayout>
  )
}

export default GenericModulePage
