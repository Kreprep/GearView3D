import { resolveAlerts, resolveSpeedLimitKmh } from '../courseAlerts.js'
import { emptyAttemptTally, tallyAlert } from '../simulationProgress.js'
import { activeAlerts, createAlertQueue, stepAlertQueue } from './safetyRules.js'
import { buildSafetySnapshot } from './safetySnapshot.js'

// One attempt's safety watch: the course's rules (lib/courseAlerts.js) judged
// against the simulation each time it has stepped, debounced into signs
// (safetyRules.js) and tallied for the violation log
// (lib/simulationProgress.js). It reads the sim state and never writes it,
// like the audio (drivingAudio.js). No browser APIs: the viewer runs it once
// per frame, the tests once per step.
const NO_EDGES = Object.freeze([])

export function createSafetyMonitor(course) {
  const enabled = resolveAlerts(course)
  const speedLimitKmh = resolveSpeedLimitKmh(course)
  let queue = createAlertQueue()
  let previous = null
  let tally = emptyAttemptTally()

  return {
    // `view`: { firstPerson, lookYaw }. Returns { shown, edges }: the signs to
    // draw, the same array until they change, and what began since the last
    // call.
    update(state, world, view) {
      // A frame in which the simulation did not step has nothing new to judge.
      if (previous && state.time === previous.time) return { shown: queue.shown, edges: NO_EDGES }

      const snapshot = buildSafetySnapshot(state, world, { view, speedLimitKmh, previous })
      previous = snapshot
      queue = stepAlertQueue(queue, activeAlerts(snapshot, enabled), snapshot.time)
      // A hint says what to do next; it is not a violation.
      for (const edge of queue.edges) if (!edge.hint) tally = tallyAlert(tally, edge)
      return queue
    },

    // This attempt's { violations, dangers } so far.
    tally: () => tally,

    // For window.__drivingDebug (sim-verify).
    debugSnapshot: () => ({
      signs: queue.shown.map(({ id, severity, kind }) => ({ id, severity, kind })),
      violations: tally.violations,
      dangers: tally.dangers,
    }),
  }
}
