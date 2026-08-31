import { useState } from 'react'
import { useT } from '../i18n'
import { courseTaskKey } from '../lib/courseGoals'
import { evaluateFreeCompletion } from '../lib/customCompletion'
import { getStoredProgress } from '../lib/progressService'
import { buildSimulationState, withStepComplete } from '../lib/simulationProgress'

function unique(items) {
  return [...new Set(items)]
}

// `driving`-kind steps render through DrivingSimulationViewer; this owns the
// event handler passed to it plus the task-panel copy for the current
// attempt (fail message, completion state).
//
// A `free` course has no checkpoints, pallet or bay to complete against, so
// it grades the only thing it can: the engine running and every control key
// tried at least once - or, if the course defines `completionCode`, an
// admin-authored rule evaluated asynchronously in a Worker (see
// lib/customCompletion.js). Tracked per step id, so more than one
// free-practice step can exist in a module.
export function useDrivingController({ moduleSlug, courseById, simulation, gradedStepIds, saveSimulation, markStepComplete, updateSimulation, vehicleProfile }) {
  const [lastFail, setLastFail] = useState(null)
  const t = useT()

  const keysUsedFor = (stepId) => simulation.keysUsedByStep?.[stepId] || []

  // The completion write reads the *stored* snapshot rather than the
  // `simulation` this render closed over: several key events (each awaiting
  // the Worker) can be in flight before React re-renders, and each must
  // build on the previous one.
  const saveFreePractice = (stepId, partial) => {
    const merged = { ...simulation, ...partial }
    const keysUsed = merged.keysUsedByStep?.[stepId] || []
    saveSimulation(partial)
    evaluateFreeCompletion(courseById[stepId], { keysUsed, engineStarted: merged.engineStarted }).then((done) => {
      if (!done) return
      const live = buildSimulationState(getStoredProgress().simulations[moduleSlug] || {}, gradedStepIds)
      updateSimulation(moduleSlug, buildSimulationState({ ...live, ...withStepComplete(live, stepId) }, gradedStepIds))
    })
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

  const renderDrivingTask = (currentStep, done) => {
    const course = courseById[currentStep.id]
    const failVisible = lastFail && lastFail.stepId === currentStep.id && !done

    if (course.goalType === 'free') {
      // Completion is entirely up to the course's own `completionCode` (see
      // lib/customCompletion.js), so this can't describe what remains -
      // the step's own Instructions/Hint text is where that's described.
      return (
        <div className="load-task-stack">
          <p className={done ? 'completion-ready' : 'task-note'}>
            {done ? t('driving.task.done') : t('module.task.completeRequirements')}
          </p>
        </div>
      )
    }

    const task = courseTaskKey(course, vehicleProfile)

    return (
      <div className="load-task-stack">
        {failVisible && (
          <p className="pallet-fail-note">
            <strong>{lastFail.title}.</strong> {lastFail.message}
          </p>
        )}
        <p className={done ? 'completion-ready' : 'task-note'}>
          {done ? t('driving.task.done') : t(task.key, task.values)}
        </p>
      </div>
    )
  }

  return { lastFail, setLastFail, handleDrivingEvent, renderDrivingTask }
}
