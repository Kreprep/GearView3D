// Server-side mirror of the per-module progress math in
// frontend/src/lib/progressService.js (getModuleProgress): a
// simulation-reported percentage wins, otherwise checklist completion is
// averaged with the latest quiz score.

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

// Builds the admin dashboard's progress rows and activity log entries from
// every user's stored progress snapshot.
export function buildAdminProgressReport(snapshots, modules, checklistTotals) {
  const progress = []
  const activityLogs = []

  for (const snapshot of snapshots) {
    const user = { email: snapshot.user.email, fullName: snapshot.user.fullName }
    const data = snapshot.data || {}

    for (const module of modules) {
      progress.push({
        id: `${snapshot.userId}-${module.slug}`,
        moduleSlug: module.slug,
        progress: moduleProgressFromSnapshot(data, module.slug, checklistTotals),
        updatedAt: snapshot.updatedAt,
        user,
      })
    }

    for (const [moduleSlug, attempts] of Object.entries(data.quizzes || {})) {
      for (const attempt of attempts) {
        activityLogs.push({
          id: attempt.id,
          action: 'quiz_attempt',
          detail: moduleSlug,
          createdAt: attempt.attemptedAt,
          user,
        })
      }
    }

    // Every equipment's parts-quiz attempts, including the Forklift ones that
    // used to sit under `parts.practiceAttempts` before migration 20260814100000.
    for (const [equipmentId, attempts] of Object.entries(data.parts?.quizzes || {})) {
      for (const attempt of attempts) {
        activityLogs.push({
          id: attempt.id,
          action: 'parts_quiz_attempt',
          detail: `${equipmentId} ${attempt.score}/${attempt.total}`,
          createdAt: attempt.attemptedAt,
          user,
        })
      }
    }
  }

  activityLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return { progress, activityLogs }
}
