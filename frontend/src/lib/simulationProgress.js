// Per-module simulation state is keyed by step id (`stepsComplete`) instead of
// a fixed list of named booleans, so driving steps that an admin adds or
// removes in the course editor are graded without a code change.
//
// Completion percentage is always recomputed against the module's *current*
// graded step list. Entries left behind by a deleted step are ignored but never
// pruned, so re-adding a step restores the learner's completion.

export function isStepComplete(simulation, stepId) {
  return Boolean(simulation?.stepsComplete?.[stepId])
}

export function buildSimulationState(saved = {}, gradedStepIds = []) {
  const stepsComplete = { ...(saved.stepsComplete || {}) }
  const completedCount = gradedStepIds.filter((stepId) => stepsComplete[stepId]).length
  const percentage = gradedStepIds.length ? Math.round((completedCount / gradedStepIds.length) * 100) : 0

  return {
    ...saved,
    stepsComplete,
    completedCount,
    gradedCount: gradedStepIds.length,
    percentage,
    complete: gradedStepIds.length > 0 && completedCount === gradedStepIds.length,
  }
}

// Partial update that marks one step complete without dropping the others.
export function withStepComplete(simulation, stepId) {
  return { stepsComplete: { ...simulation.stepsComplete, [stepId]: true } }
}

// --- Safety record per driving step -----------------------------------------
//
// `simulation.attemptStats[stepId]` is what the safety signs logged on the
// learner's latest completion of a driving step (docs/revisions/
// post-defense-plan.md, section 4.5), the evidence the skills checklist reads:
//
//   completedAt     ISO time of that completion
//   violations      { ruleId: n }  times a sign for the rule came up
//   dangers         { ruleId: n }  times it was, or rose to, danger level
//   fails           failed attempts before that completion
//   bestViolations  the fewest violations of any completion so far
//   failsSinceCompletion  failed attempts since, not yet attached to one
//
// A tally is one attempt's running `{ violations, dangers }`, built from the
// alert queue's edges (lib/driving/safetyRules.js).

export function emptyAttemptTally() {
  return { violations: {}, dangers: {} }
}

const bump = (counts, id) => ({ ...counts, [id]: (counts[id] || 0) + 1 })

// One alert-queue edge. A sign coming up is a violation; a sign already up
// that escalates to danger is the same violation getting worse, so it counts
// under `dangers` only.
export function tallyAlert(tally, { id, severity, escalation = false }) {
  return {
    violations: escalation ? tally.violations : bump(tally.violations, id),
    dangers: severity === 'danger' ? bump(tally.dangers, id) : tally.dangers,
  }
}

export function violationTotal(violations = {}) {
  return Object.values(violations).reduce((sum, count) => sum + count, 0)
}

export function attemptStatsFor(simulation, stepId) {
  return simulation?.attemptStats?.[stepId] || null
}

const withAttemptEntry = (simulation, stepId, entry) => ({
  attemptStats: { ...simulation?.attemptStats, [stepId]: entry },
})

// Partial update for a failed attempt at a driving step.
export function withAttemptFail(simulation, stepId) {
  const previous = attemptStatsFor(simulation, stepId) || {}
  return withAttemptEntry(simulation, stepId, {
    ...previous,
    failsSinceCompletion: (previous.failsSinceCompletion || 0) + 1,
  })
}

// Partial update for a completed attempt: the latest completion replaces the
// last one's record, and bestViolations keeps the cleanest run.
export function withAttemptComplete(simulation, stepId, { tally = emptyAttemptTally(), completedAt }) {
  const previous = attemptStatsFor(simulation, stepId) || {}
  const total = violationTotal(tally.violations)
  return withAttemptEntry(simulation, stepId, {
    completedAt,
    violations: { ...tally.violations },
    dangers: { ...tally.dangers },
    fails: previous.failsSinceCompletion || 0,
    bestViolations: typeof previous.bestViolations === 'number' ? Math.min(previous.bestViolations, total) : total,
    failsSinceCompletion: 0,
  })
}

// --- A mission's scorecard ---------------------------------------------------
//
// A mission step (the Final Driving Test, docs/modules/module-improvements-
// plan.md, 3.6) completes only on a passing run (decided 2026-10-05). Every
// finished run is scored (lib/missionScore.js) and kept on the step's entry as
// `attemptStats[stepId].mission`:
//
//   lastRun   the latest finished run, pass or fail: { finishedAt, elapsedS,
//             violations, dangers } plus scoreMission()'s result
//   runs      finished runs so far
//   bestScore the best score of a passing run, or null
//   passedAt  ISO time of the first passing run, or null; once set it stays,
//             so a later failing retry does not take the pass away
//
// A passing run is also an ordinary completion (withAttemptComplete), so a
// clean-run rule can read it; a failing one counts as a failed attempt.

export function missionRecordFor(simulation, stepId) {
  return attemptStatsFor(simulation, stepId)?.mission || null
}

// Partial update for a finished mission run, `run` as described above.
export function withMissionRun(simulation, stepId, run) {
  const base = run.passed
    ? withAttemptComplete(simulation, stepId, { tally: run, completedAt: run.finishedAt })
    : withAttemptFail(simulation, stepId)
  const previous = missionRecordFor(simulation, stepId) || {}
  const bestScore = run.passed
    ? Math.max(run.score, previous.bestScore ?? run.score)
    : (previous.bestScore ?? null)
  const mission = {
    lastRun: run,
    runs: (previous.runs || 0) + 1,
    bestScore,
    passedAt: previous.passedAt || (run.passed ? run.finishedAt : null),
  }
  return withAttemptEntry(simulation, stepId, { ...base.attemptStats[stepId], mission })
}

// Every mission step a progress document has a scorecard for, as
// { module, stepId, ...record }, in the document's order: what the Assessment
// page and the instructor's Reports read.
export function missionResults(progress) {
  const simulations = progress?.simulations && typeof progress.simulations === 'object' ? progress.simulations : {}
  return Object.entries(simulations).flatMap(([module, simulation]) =>
    Object.entries(simulation?.attemptStats || {})
      .filter(([, stats]) => stats?.mission?.lastRun)
      .map(([stepId, stats]) => ({ module, stepId, ...stats.mission })),
  )
}
