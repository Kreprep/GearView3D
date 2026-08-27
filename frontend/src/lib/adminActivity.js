// Shared by the Overview tab's recent-activity list and the Reports tab's
// timeline, so the two read identically. Backed by activityLogs entries from
// GET /api/admin/content (see backend/src/lib/progressSummary.js).

const DAY_MS = 24 * 60 * 60 * 1000

export function formatRelativeTime(dateString) {
  const elapsed = Date.now() - new Date(dateString).getTime()
  if (elapsed < 60 * 1000) return 'just now'
  if (elapsed < 60 * 60 * 1000) return `${Math.floor(elapsed / (60 * 1000))}m ago`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / (60 * 60 * 1000))}h ago`
  return `${Math.floor(elapsed / DAY_MS)}d ago`
}

export function describeActivity(entry, moduleTitle) {
  const who = entry.user?.fullName || entry.user?.email || 'A learner'
  if (entry.action === 'quiz_attempt') return `${who} completed a quiz in ${moduleTitle || entry.detail}`
  if (entry.action === 'parts_quiz_attempt') return `${who} scored ${entry.detail} on the parts quiz`
  return `${who} - ${entry.action}`
}
