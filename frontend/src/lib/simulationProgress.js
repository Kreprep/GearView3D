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
