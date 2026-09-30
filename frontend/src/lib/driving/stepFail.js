// The one place state.failed flips true. Idempotent - a second cause hitting
// in the same or a later step is a no-op, so whichever fails first is the
// reason reported to the learner.
export function triggerFail(state, reason) {
  if (state.failed) return
  state.failed = true
  state.failReason = reason
  state.hud.carriedLoadKg = null
  state.events.push({ type: 'fail', reason })
}
