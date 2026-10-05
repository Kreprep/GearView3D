import { useRef, useState } from 'react'
import { AttemptSummary } from '../components/driving/AttemptSummary'
import { MissionPassRules, MissionScorecard } from '../components/driving/MissionScorecard'
import { useT } from '../i18n'
import { courseTaskKey } from '../lib/courseGoals'
import { evaluateFreeCompletion } from '../lib/customCompletion'
import { resolvePassRules, scoreMission } from '../lib/missionScore'
import { getStoredProgress } from '../lib/progressService'
import {
  attemptStatsFor,
  buildSimulationState,
  emptyAttemptTally,
  isStepComplete,
  withAttemptComplete,
  withAttemptFail,
  withMissionRun,
  withStepComplete,
} from '../lib/simulationProgress'

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
//
// The rule's context is { keysUsed, engineStarted, seatbelt, parkingBrake,
// horn, leversUsed }. seatbelt and parkingBrake are the cab switches'
// positions right now (the viewer's cab-switch event); horn (it has sounded)
// and leversUsed (the positions the direction lever has been put in, 'F' |
// 'N' | 'R') are since the step was opened. None of the four is saved with
// progress.
//
// Completing a step also records what the safety signs logged on that attempt
// (simulation.attemptStats[stepId], lib/simulationProgress.js). The viewer
// reports the running tally with `safety-tally` events, starting from an
// empty one each attempt; a failed attempt counts toward the next
// completion's `fails`.
//
// A mission (the Final Driving Test) completes only on a passing run: its
// `course-complete` is scored against the course's pass rules
// (lib/missionScore.js), every finished run's scorecard is kept, and one that
// does not pass counts as a failed attempt (decided 2026-10-05).
export function useDrivingController({ moduleSlug, courseById, simulation, gradedStepIds, saveSimulation, markStepComplete, updateSimulation }) {
  const [lastFail, setLastFail] = useState(null)
  const cabRef = useRef({ seatbelt: false, parkingBrake: false })
  // The horn and the lever positions on this visit to a step.
  const usedRef = useRef({ stepId: null, horn: false, leversUsed: [] })
  const tallyRef = useRef({ stepId: null, tally: emptyAttemptTally() })
  const t = useT()

  // The current attempt's tally, if it is this step's.
  const tallyFor = (stepId) => (tallyRef.current.stepId === stepId ? tallyRef.current.tally : emptyAttemptTally())
  const completedAttempt = (stepId) => ({ tally: tallyFor(stepId), completedAt: new Date().toISOString() })

  // A finished mission run, scored and saved; the step completes on a pass.
  const finishMission = (stepId, { elapsedS }) => {
    const tally = tallyFor(stepId)
    const run = {
      finishedAt: new Date().toISOString(),
      elapsedS: typeof elapsedS === 'number' ? elapsedS : null,
      ...tally,
      ...scoreMission(tally, resolvePassRules(courseById[stepId])),
    }
    const partial = withMissionRun(simulation, stepId, run)
    setLastFail(null)
    if (run.passed) markStepComplete(stepId, partial)
    else saveSimulation({ failedAttempts: simulation.failedAttempts + 1, ...partial })
  }

  const keysUsedFor = (stepId) => simulation.keysUsedByStep?.[stepId] || []

  const usedOn = (stepId) => {
    if (usedRef.current.stepId !== stepId) usedRef.current = { stepId, horn: false, leversUsed: [] }
    return usedRef.current
  }

  // The completion write reads the *stored* snapshot rather than the
  // `simulation` this render closed over: several key events (each awaiting
  // the Worker) can be in flight before React re-renders, and each must
  // build on the previous one.
  const evaluateFreePractice = (stepId, merged) => {
    const keysUsed = merged.keysUsedByStep?.[stepId] || []
    const { horn, leversUsed } = usedOn(stepId)
    const context = { keysUsed, engineStarted: merged.engineStarted, ...cabRef.current, horn, leversUsed }
    evaluateFreeCompletion(courseById[stepId], context).then((done) => {
      if (!done) return
      const live = buildSimulationState(getStoredProgress().simulations[moduleSlug] || {}, gradedStepIds)
      // The rule is evaluated again on every key after it first holds; only
      // the first time is the completion.
      const stats = isStepComplete(live, stepId) ? null : withAttemptComplete(live, stepId, completedAttempt(stepId))
      updateSimulation(moduleSlug, buildSimulationState({ ...live, ...stats, ...withStepComplete(live, stepId) }, gradedStepIds))
    })
  }

  const saveFreePractice = (stepId, partial) => {
    saveSimulation(partial)
    evaluateFreePractice(stepId, { ...simulation, ...partial })
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

    if (event.type === 'safety-tally') {
      tallyRef.current = { stepId: currentStep.id, tally: event.tally }
      return
    }

    if (event.type === 'cab-switch') {
      cabRef.current = { seatbelt: event.seatbelt, parkingBrake: event.parkingBrake }
      const used = usedOn(currentStep.id)
      if (event.lever) used.leversUsed = unique([...used.leversUsed, event.lever])
      if (isFreePractice) evaluateFreePractice(currentStep.id, simulation)
      return
    }

    if (event.type === 'horn') {
      const used = usedOn(currentStep.id)
      if (isFreePractice && !used.horn) {
        used.horn = true
        evaluateFreePractice(currentStep.id, simulation)
      }
      return
    }

    if (event.type === 'engine-on') {
      if (isFreePractice) saveFreePractice(currentStep.id, { engineStarted: true })
      return
    }

    if (event.type === 'sim-failed') {
      setLastFail({ stepId: currentStep.id, title: event.title, message: event.message })
      saveSimulation({ failedAttempts: simulation.failedAttempts + 1, ...withAttemptFail(simulation, currentStep.id) })
      return
    }

    // Whichever goal the course defines, reaching it completes that step. A
    // mission delivers pallets and parks along the way: only its last task
    // (course-complete) finishes it, and only a passing run completes it.
    const isMission = courseById[currentStep.id]?.goalType === 'mission'
    if (isMission) {
      if (event.type === 'course-complete' && gradedStepIds.includes(currentStep.id)) finishMission(currentStep.id, event)
      return
    }
    const completes = event.type === 'course-complete' || event.type === 'pallet-delivered' || event.type === 'parking-complete'
    if (completes) {
      if (gradedStepIds.includes(currentStep.id)) {
        setLastFail(null)
        markStepComplete(currentStep.id, withAttemptComplete(simulation, currentStep.id, completedAttempt(currentStep.id)))
      }
    }
  }

  const renderDrivingTask = (currentStep, done) => {
    const course = courseById[currentStep.id]
    const failVisible = lastFail && lastFail.stepId === currentStep.id && !done
    const summary = done ? <AttemptSummary stats={attemptStatsFor(simulation, currentStep.id)} /> : null

    if (course.goalType === 'free') {
      // Completion is entirely up to the course's own `completionCode` (see
      // lib/customCompletion.js), so this can't describe what remains -
      // the step's own Instructions/Hint text is where that's described.
      return (
        <div className="load-task-stack">
          <p className={done ? 'completion-ready' : 'task-note'}>
            {done ? t('driving.task.done') : t('module.task.completeRequirements')}
          </p>
          {summary}
        </div>
      )
    }

    const task = courseTaskKey(course)
    const isMission = course.goalType === 'mission'
    const stats = attemptStatsFor(simulation, currentStep.id)

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
        {isMission ? (
          <>
            <MissionScorecard stats={stats} />
            {!done && <MissionPassRules rules={resolvePassRules(course)} />}
          </>
        ) : (
          summary
        )}
      </div>
    )
  }

  return { lastFail, setLastFail, handleDrivingEvent, renderDrivingTask }
}
