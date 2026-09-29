// Parts-quiz attempts live at `parts.quizAttempts`, newest first. Two older
// shapes can still arrive - from a snapshot a stale browser tab pushes, or a
// copy a client kept in localStorage:
//
//   parts.quizzes[equipmentId]   one list per equipment, before the app was
//                                narrowed to the forklift (migration
//                                20260929120000)
//   parts.practiceAttempts       the forklift's list before migration
//                                20260814100000
//
// This folds both into `quizAttempts`, so the next write carries the current
// shape and the old keys disappear on their own. Only the forklift's list is
// kept; another equipment's attempts were for content that no longer exists.
// Order is newest-first throughout, and each older shape only ever received
// attempts older than the one before it, so they append.
//
// Pure, no browser APIs - progressService.js (client reads/writes) and the
// backend's grading.js and progressSummary.js run this over the same JSON
// shape, so it lives here rather than in any one of them.

// The key the forklift's list was stored under in `parts.quizzes`.
const LEGACY_EQUIPMENT_KEY = 'forklift'

function list(value) {
  return Array.isArray(value) ? value : []
}

export function migrateParts(parts) {
  return {
    viewedPartIds: list(parts?.viewedPartIds),
    quizAttempts: [
      ...list(parts?.quizAttempts),
      ...list(parts?.quizzes?.[LEGACY_EQUIPMENT_KEY]),
      ...list(parts?.practiceAttempts),
    ],
  }
}
