// Server-side recomputation of walk-around step completion. The learner GET
// already ships the walk-around answer key raw (needed for the instant
// per-click feedback in WalkAroundStep.jsx), so this does not hide anything -
// it only stops a client from writing `stepsComplete[stepId] = true` on its
// own say-so. The submitted phase state (which checks/gauges/scenarios were
// answered) is re-graded against the step's real, published Course.data
// before it is allowed to mark that step complete.
import { prisma } from './prisma.js'
import { ACTIVITY_IDS } from '../../../frontend/src/lib/activitySteps.js'
import { buildSimulationState } from '../../../frontend/src/lib/simulationProgress.js'
import { emptyPhaseState, isPhaseComplete } from '../../../frontend/src/lib/walkAroundStep.js'

function isGraded(row) {
  return row.kind === 'driving' || row.kind === 'walk-around' || (row.kind === 'activity' && ACTIVITY_IDS.includes(row.content?.activityId))
}

// Re-grades every walk-around step referenced by `simulations` (one entry per
// module slug, the same shape `GenericModulePage` writes) and returns a copy
// with `stepsComplete` corrected. Driving and activity steps are left as the
// client reported them - re-grading those would mean replaying the driving
// physics or activity logic server-side, which is a separate, larger project.
export async function validateSimulations(simulations) {
  if (!simulations || typeof simulations !== 'object') return simulations

  const moduleSlugs = Object.keys(simulations)
  if (!moduleSlugs.length) return simulations

  const rows = await prisma.course.findMany({
    where: { moduleSlug: { in: moduleSlugs }, published: true },
    select: { id: true, moduleSlug: true, kind: true, data: true, content: true },
  })

  const validated = { ...simulations }

  for (const moduleSlug of moduleSlugs) {
    const moduleRows = rows.filter((row) => row.moduleSlug === moduleSlug)
    if (!moduleRows.length) continue

    const submitted = simulations[moduleSlug] || {}
    const stepsComplete = { ...(submitted.stepsComplete || {}) }

    for (const row of moduleRows) {
      if (row.kind !== 'walk-around') continue
      const state = submitted.walkAround?.[row.id] || emptyPhaseState()
      stepsComplete[row.id] = isPhaseComplete(row.data || {}, state, submitted.engineStarted)
    }

    const gradedStepIds = moduleRows.filter(isGraded).map((row) => row.id)

    validated[moduleSlug] = buildSimulationState({ ...submitted, stepsComplete }, gradedStepIds)
  }

  return validated
}
