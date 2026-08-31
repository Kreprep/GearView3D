// Pure, no browser APIs - simCollision.js imports this and also runs inside
// the Node backend process (via courseGoals.js, which backend/src/lib/courses.js
// imports directly to validate a course on publish).
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
