import { useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { drivingCourses } from './data/drivingCourse'
import { routes } from './lib/router'
import {
  equipmentUsageModules,
  moduleScenarioSteps,
  postOperationReportPrompts,
  shutdownDisplayOrder,
  shutdownSequenceActions,
} from './lib/trainingData'
import './LoadHandlingPage.css'
import './PostOperationPage.css'

const moduleSlug = 'post-operation'
const NEXT_MODULE_DELAY_MS = 1400

function calculateSimulationState(nextState) {
  const flags = [nextState.parkingComplete, nextState.shutdownComplete, nextState.reportingComplete]
  const percentage = Math.round((flags.filter(Boolean).length / flags.length) * 100)

  return { ...nextState, percentage, complete: percentage === 100 }
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

function PostOperationPage({ moduleName, onBack, onNavigate }) {
  const module = equipmentUsageModules.find((item) => item.slug === moduleSlug)
  const steps = moduleScenarioSteps[moduleSlug]
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [lastFail, setLastFail] = useState(null)
  const [shutdownPicked, setShutdownPicked] = useState([])
  const [wrongPickId, setWrongPickId] = useState(null)
  const [reportAnswers, setReportAnswers] = useState({})
  const simulation = calculateSimulationState({
    parkingComplete: savedSimulation.parkingComplete || false,
    shutdownComplete: savedSimulation.shutdownComplete || false,
    reportingComplete: savedSimulation.reportingComplete || false,
    shutdownMistakes: savedSimulation.shutdownMistakes || 0,
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

    if (event.type === 'parking-complete' && currentStep.id === 'secure-parking') {
      setLastFail(null)
      saveSimulation({ parkingComplete: true })
    }
  }

  const handleShutdownPick = (action) => {
    if (simulation.shutdownComplete) return
    const expectedOrder = shutdownPicked.length + 1

    if (action.order === expectedOrder) {
      const nextPicked = [...shutdownPicked, action.id]
      setShutdownPicked(nextPicked)
      setWrongPickId(null)
      if (nextPicked.length === shutdownSequenceActions.length) {
        saveSimulation({ shutdownComplete: true })
      }
    } else {
      setWrongPickId(action.id)
      saveSimulation({ shutdownMistakes: simulation.shutdownMistakes + 1 })
      setTimeout(() => setWrongPickId(null), 700)
    }
  }

  const handleReportAnswer = (prompt, choice) => {
    if (simulation.reportingComplete) return
    const correct = choice === prompt.shouldReport
    const nextAnswers = { ...reportAnswers, [prompt.id]: { choice, correct } }
    setReportAnswers(nextAnswers)

    const allCorrect = postOperationReportPrompts.every((item) => nextAnswers[item.id]?.correct)
    if (allCorrect) {
      saveSimulation({ reportingComplete: true })
    }
  }

  const completeModule = () => {
    if (!simulation.complete) return

    setTimeout(() => onNavigate?.(routes.palletTesting), NEXT_MODULE_DELAY_MS)
  }

  const getStepCanProceed = (stepId) => {
    if (stepId === 'secure-parking') return simulation.parkingComplete
    if (stepId === 'shutdown-sequence') return simulation.shutdownComplete
    if (stepId === 'reporting') return simulation.reportingComplete
    return true
  }

  const changeStep = (nextIndex) => {
    setLastFail(null)
    setCurrentStepIndex(nextIndex)
  }

  const renderScene = ({ currentStep }) => {
    if (currentStep.id === 'secure-parking') {
      return (
        <div className="load-scene-wrap">
          <DrivingSimulationViewer course={drivingCourses['secure-parking']} onEvent={handleDrivingEvent(currentStep)} />
        </div>
      )
    }

    if (currentStep.id === 'shutdown-sequence') {
      return (
        <ShutdownSequenceActivity
          actions={shutdownSequenceActions}
          displayOrder={shutdownDisplayOrder}
          pickedIds={shutdownPicked}
          completed={simulation.shutdownComplete}
          wrongPickId={wrongPickId}
          onPick={handleShutdownPick}
        />
      )
    }

    if (currentStep.id === 'reporting') {
      return (
        <ReportingActivity
          prompts={postOperationReportPrompts}
          answers={reportAnswers}
          completed={simulation.reportingComplete}
          onAnswer={handleReportAnswer}
        />
      )
    }

    return (
      <div className="post-op-briefing">
        <h3>Secure Parking Discipline</h3>
        <ul>
          <li>Park inside the painted bay, clear of traffic lanes and cones.</li>
          <li>Lower the forks flat, set controls to neutral, and engage the parking brake.</li>
          <li>Switch off the equipment and report anything unsafe found during the shift.</li>
        </ul>
        <p>
          The next step is a driving exercise: the parking is only accepted when the forklift is inside the lines,
          straight, stopped, forks lowered, and the engine is off. Cones along the route are live - hitting one fails
          the attempt.
        </p>
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

  const renderParkingTask = (currentStep) => {
    const done = simulation.parkingComplete
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
            : 'Follow the breadcrumbs to the painted bay. Park between the lines, straighten up, stop, lower the forks with F, then switch off with E. The badge at the top shows the next requirement.'}
        </p>
      </div>
    )
  }

  const renderShutdownTask = () => {
    const done = simulation.shutdownComplete
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
    const done = simulation.reportingComplete
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

  const renderSummary = () => (
    <div className="load-task-stack">
      <div className="summary-grid">
        <div><span>Secure Parking</span><strong>{simulation.parkingComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Shutdown Sequence</span><strong>{simulation.shutdownComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Reporting</span><strong>{simulation.reportingComplete ? 'Complete' : 'Open'}</strong></div>
        <div><span>Failed Attempts</span><strong>{simulation.failedAttempts}</strong></div>
        <div><span>Ordering Mistakes</span><strong>{simulation.shutdownMistakes}</strong></div>
      </div>
      <p className={simulation.complete ? 'completion-ready' : 'completion-warning'}>
        {simulation.complete
          ? 'All requirements are complete. Submit the module to record completion feedback.'
          : 'Complete the parking drive, shutdown ordering, and reporting decisions to finish this module.'}
      </p>
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'briefing') return renderBriefing()
    if (currentStep.id === 'secure-parking') return renderParkingTask(currentStep)
    if (currentStep.id === 'shutdown-sequence') return renderShutdownTask()
    if (currentStep.id === 'reporting') return renderReportingTask()
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

export default PostOperationPage
