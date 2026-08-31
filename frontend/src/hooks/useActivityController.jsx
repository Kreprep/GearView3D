import { useEffect, useRef, useState } from 'react'
import { isStepComplete, withStepComplete } from '../lib/simulationProgress'

// Both built-in activities (Module 3's shutdown sequence and unsafe-condition
// reporting) are graded against their own row's content, so a prompt an
// admin adds is required and one they delete stops blocking completion.
export function useActivityController({ steps, simulation, saveSimulation }) {
  const [shutdownPicked, setShutdownPicked] = useState([])
  const [wrongPickId, setWrongPickId] = useState(null)
  const [reportAnswers, setReportAnswers] = useState({})
  const wrongPickTimer = useRef(null)

  useEffect(() => () => clearTimeout(wrongPickTimer.current), [])

  const shutdownComplete = isStepComplete(simulation, 'shutdown-sequence')
  const reportingComplete = isStepComplete(simulation, 'reporting')

  const activityContent = (activityId) =>
    steps.find((step) => step.content?.activityId === activityId)?.content || {}
  const shutdownActions = activityContent('shutdown-sequence').actions || []
  const shutdownDisplayOrder = activityContent('shutdown-sequence').displayOrder || []
  const reportPrompts = activityContent('reporting').prompts || []

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
      clearTimeout(wrongPickTimer.current)
      wrongPickTimer.current = setTimeout(() => setWrongPickId(null), 700)
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

  return {
    shutdownComplete,
    reportingComplete,
    shutdownActions,
    shutdownDisplayOrder,
    reportPrompts,
    shutdownPicked,
    wrongPickId,
    reportAnswers,
    handleShutdownPick,
    handleReportAnswer,
    renderShutdownTask,
    renderReportingTask,
  }
}
