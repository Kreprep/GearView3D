import { useMemo, useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ModuleSummary from './components/ModuleSummary'
import { BriefingScene, BriefingTask } from './components/ModuleBriefing'
import { useModuleCourses } from './hooks/useModuleCourses'
import { useProgress } from './hooks/useProgress'
import { courseTaskCopy } from './lib/courseGoals'
import { moduleObjectives, nextModuleRoute } from './lib/moduleContent'
import { buildSimulationState, isStepComplete, withStepComplete } from './lib/simulationProgress'
import {
  equipmentUsageModules,
  postOperationReportPrompts,
  shutdownDisplayOrder,
  shutdownSequenceActions,
} from './lib/trainingData'
import './LoadHandlingPage.css'
import './PostOperationPage.css'

const moduleSlug = 'post-operation'
const NEXT_MODULE_DELAY_MS = 1400

// `activity` steps are rows like any other - an admin can reorder or remove
// them - but their UI is hardcoded React keyed by `content.activityId`, so
// these are the only two ids that render anything.
const ACTIVITY_IDS = ['shutdown-sequence', 'reporting']

// Reads snapshots written before completion moved to a step-id map.
const legacyStepFields = {
  'secure-parking': 'secureParkingComplete',
  'parallel-parking': 'parallelParkingComplete',
  'forklift-gap-parking': 'gapParkingComplete',
  'shutdown-sequence': 'shutdownComplete',
  reporting: 'reportingComplete',
}

function ShutdownSequenceActivity({ actions, displayOrder, pickedIds, completed, wrongPickId, onPick }) {
  const orderedActions = displayOrder
    .map((id) => actions.find((action) => action.id === id))
    .filter(Boolean)
  const cards = completed ? [...actions].sort((a, b) => a.order - b.order) : orderedActions

  return (
    <div className="shutdown-activity">
      <div className="shutdown-grid">
        {cards.map((action) => {
          const pickedIndex = pickedIds.indexOf(action.id)
          const isPicked = completed || pickedIndex >= 0
          return (
            <button
              key={action.id}
              type="button"
              className={`shutdown-card ${isPicked ? 'picked' : ''} ${wrongPickId === action.id ? 'wrong' : ''}`}
              disabled={isPicked}
              onClick={() => onPick(action)}
            >
              <span className="shutdown-order-chip">
                {completed ? action.order : pickedIndex >= 0 ? pickedIndex + 1 : '?'}
              </span>
              <span className="shutdown-card-text">
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ReportingActivity({ prompts, answers, completed, onAnswer }) {
  return (
    <div className="reporting-activity">
      {prompts.map((prompt) => {
        const answer = answers[prompt.id]
        const resolved = completed || (answer && answer.correct)
        return (
          <div key={prompt.id} className={`reporting-card ${resolved ? 'correct' : answer ? 'wrong' : ''}`}>
            <p className="reporting-text">{prompt.text}</p>
            <div className="reporting-actions">
              <button
                type="button"
                className={`reporting-button report ${(resolved && prompt.shouldReport) || answer?.choice === true ? 'chosen' : ''}`}
                disabled={resolved}
                onClick={() => onAnswer(prompt, true)}
              >
                Report
              </button>
              <button
                type="button"
                className={`reporting-button ok ${(resolved && !prompt.shouldReport) || answer?.choice === false ? 'chosen' : ''}`}
                disabled={resolved}
                onClick={() => onAnswer(prompt, false)}
              >
                No Action
              </button>
            </div>
            {resolved && <p className="reporting-feedback correct">{prompt.feedback}</p>}
            {!resolved && answer && !answer.correct && (
              <p className="reporting-feedback wrong">{prompt.wrongFeedback} Try again.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PostOperationPage({ moduleName, user, onBack, onNavigate }) {
  const isAdmin = user?.role === 'ADMIN'
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const { steps, stepById, courseById, loading, error } = useModuleCourses(moduleSlug)
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [lastFail, setLastFail] = useState(null)
  const [shutdownPicked, setShutdownPicked] = useState([])
  const [wrongPickId, setWrongPickId] = useState(null)
  const [reportAnswers, setReportAnswers] = useState({})
  // Driving steps plus the two hardcoded activities; briefing and summary are
  // not graded.
  const gradedStepIds = useMemo(
    () =>
      steps
        .filter((step) => step.kind === 'driving' || (step.kind === 'activity' && ACTIVITY_IDS.includes(step.content?.activityId)))
        .map((step) => step.id),
    [steps],
  )
  const simulation = buildSimulationState(
    {
      ...savedSimulation,
      shutdownMistakes: savedSimulation.shutdownMistakes || 0,
      failedAttempts: savedSimulation.failedAttempts || 0,
    },
    gradedStepIds,
    legacyStepFields,
  )
  const shutdownComplete = isStepComplete(simulation, 'shutdown-sequence')
  const reportingComplete = isStepComplete(simulation, 'reporting')

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
    if (event.type === 'parking-complete' || event.type === 'course-complete' || event.type === 'pallet-delivered') {
      if (gradedStepIds.includes(currentStep.id)) {
        setLastFail(null)
        saveSimulation(withStepComplete(simulation, currentStep.id))
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
      if (nextPicked.length === shutdownSequenceActions.length) {
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

    const allCorrect = postOperationReportPrompts.every((item) => nextAnswers[item.id]?.correct)
    if (allCorrect) {
      saveSimulation(withStepComplete(simulation, 'reporting'))
    }
  }

  const completeModule = () => {
    if (!simulation.complete) return

    setTimeout(() => onNavigate?.(nextModuleRoute(steps, 'palletTesting')), NEXT_MODULE_DELAY_MS)
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

    if (courseById[currentStep.id]) {
      return (
        <div className="load-scene-wrap">
          <DrivingSimulationViewer course={courseById[currentStep.id]} onEvent={handleDrivingEvent(currentStep)} isAdmin={isAdmin} />
        </div>
      )
    }

    if (step?.content?.activityId === 'shutdown-sequence') {
      return (
        <ShutdownSequenceActivity
          actions={shutdownSequenceActions}
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
          prompts={postOperationReportPrompts}
          answers={reportAnswers}
          completed={reportingComplete}
          onAnswer={handleReportAnswer}
        />
      )
    }

    return null
  }

  const renderDrivingTask = (currentStep) => {
    const done = isStepComplete(simulation, currentStep.id)
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

  const renderShutdownTask = () => {
    const done = shutdownComplete
    return (
      <div className="load-task-stack">
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done
            ? 'Step complete. Use Next to continue.'
            : `Select the shutdown actions in the correct order (${shutdownPicked.length} of ${shutdownSequenceActions.length} placed). Wrong picks are counted: ${simulation.shutdownMistakes}.`}
        </p>
      </div>
    )
  }

  const renderReportingTask = () => {
    const done = reportingComplete
    const correctCount = postOperationReportPrompts.filter((item) => reportAnswers[item.id]?.correct).length
    return (
      <div className="load-task-stack">
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done
            ? 'Step complete. Use Next to continue.'
            : `Decide Report or No Action for each condition (${correctCount} of ${postOperationReportPrompts.length} correct). Wrong answers can be retried.`}
        </p>
      </div>
    )
  }

  const summaryStep = steps.find((step) => step.kind === 'summary')

  const renderTask = ({ currentStep }) => {
    const step = stepById[currentStep.id]
    if (step?.kind === 'briefing') return <BriefingTask content={step.content} module={module} />
    if (courseById[currentStep.id]) return renderDrivingTask(currentStep)
    if (step?.content?.activityId === 'shutdown-sequence') return renderShutdownTask()
    if (step?.content?.activityId === 'reporting') return renderReportingTask()
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

export default PostOperationPage
