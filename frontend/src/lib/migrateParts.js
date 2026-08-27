// Forklift's parts-quiz attempts used to live at `parts.practiceAttempts`,
// separate from every other equipment's `parts.quizzes[equipmentId]`.
// Migration 20260814100000 moved the stored copies; this folds in a copy a
// client (or the backend, writing a new attempt) still holds under the old
// key, so the next write carries the merged shape and the old key disappears
// on its own.
//
// Pure, no browser APIs - progressService.js (client reads/writes) and the
// backend's grading.js (server-side attempt writes) both run this over the
// same JSON shape, so it lives here rather than in either one.
export function migrateParts(parts) {
  const legacy = Array.isArray(parts?.practiceAttempts) ? parts.practiceAttempts : []
  const quizzes = parts?.quizzes || {}

  return {
    viewedPartIds: parts?.viewedPartIds || [],
    quizzes: legacy.length
      ? { ...quizzes, forklift: [...(quizzes.forklift || []), ...legacy] }
      : quizzes,
  }
}
