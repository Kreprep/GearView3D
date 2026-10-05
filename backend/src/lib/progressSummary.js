// Server-side mirror of the per-module progress math in
// frontend/src/lib/progressService.js (getModuleProgress): a
// simulation-reported percentage wins, otherwise checklist completion is
// averaged with the latest quiz score.
import { migrateParts } from '../../../frontend/src/lib/migrateParts.js'
import { missionResults } from '../../../frontend/src/lib/simulationProgress.js'

export function moduleProgressFromSnapshot(snapshot, slug, checklistTotals) {
  const simulationProgress = snapshot?.simulations?.[slug]?.percentage
  if (typeof simulationProgress === 'number') {
    return simulationProgress
  }

  const completedCount = snapshot?.checklists?.[slug]?.completedItems?.length || 0
  const totalCount = checklistTotals[slug] || 0
  const checklistPercentage = totalCount ? Math.round((completedCount / totalCount) * 100) : 0
  const latestQuiz = snapshot?.quizzes?.[slug]?.[0]

  if (latestQuiz) {
    return Math.round((checklistPercentage + latestQuiz.percentage) / 2)
  }

  return checklistPercentage
}

// The most recent moment this module was actually touched, not the snapshot's
// overall updatedAt (which is the last write to *any* module and would show
// the same timestamp against every module a learner hasn't opened). Null when
// the learner has never touched this module.
function moduleUpdatedAtFromSnapshot(snapshot, slug) {
  const candidates = [
    snapshot?.simulations?.[slug]?.updatedAt,
    snapshot?.checklists?.[slug]?.updatedAt,
    snapshot?.quizzes?.[slug]?.[0]?.attemptedAt,
  ].filter(Boolean)

  if (!candidates.length) return null
  return candidates.reduce((latest, current) => (new Date(current) > new Date(latest) ? current : latest))
}

// A module's mission steps (the Final Driving Test) for the Reports row: the
// pass the learner has, if any, and their last finished run. Client-reported,
// like the rest of the snapshot.
function moduleMissions(snapshot, slug) {
  return missionResults(snapshot)
    .filter((result) => result.module === slug)
    .map(({ stepId, passedAt, bestScore, runs, lastRun }) => ({
      stepId,
      passedAt,
      bestScore,
      runs,
      lastRun: { finishedAt: lastRun.finishedAt, passed: lastRun.passed, score: lastRun.score },
    }))
}

// Builds the admin dashboard's progress rows and activity log entries from
// every user's stored progress snapshot.
export function buildAdminProgressReport(snapshots, modules, checklistTotals) {
  const progress = []
  const activityLogs = []

  for (const snapshot of snapshots) {
    const user = { id: snapshot.userId, email: snapshot.user.email, fullName: snapshot.user.fullName }
    const data = snapshot.data || {}

    for (const module of modules) {
      progress.push({
        id: `${snapshot.userId}-${module.slug}`,
        moduleSlug: module.slug,
        progress: moduleProgressFromSnapshot(data, module.slug, checklistTotals),
        updatedAt: moduleUpdatedAtFromSnapshot(data, module.slug),
        missions: moduleMissions(data, module.slug),
        user,
      })
    }

    for (const [moduleSlug, attempts] of Object.entries(data.quizzes || {})) {
      for (const attempt of attempts) {
        activityLogs.push({
          id: attempt.id,
          action: 'quiz_attempt',
          moduleSlug,
          detail: moduleSlug,
          createdAt: attempt.attemptedAt,
          user,
        })
      }
    }

    // Read through migrateParts(): PUT /api/progress stores the client payload
    // as-is, so a stale tab can still have pushed an older parts shape.
    for (const attempt of migrateParts(data.parts).quizAttempts) {
      activityLogs.push({
        id: attempt.id,
        action: 'parts_quiz_attempt',
        moduleSlug: null,
        detail: `${attempt.score}/${attempt.total}`,
        createdAt: attempt.attemptedAt,
        user,
      })
    }
  }

  activityLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return { progress, activityLogs }
}
