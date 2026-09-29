import { TIP_GRAVITY_ACCEL, TIP_MAX_ANGLE } from './constants.js'

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

// Overload/tip-over tip animation: pitches the whole truck about the front
// axle with an accelerating fall until the forks hit the ground. `tip.active`
// is set from stepPallet (overload / load-tipping); this only continues an
// already-active fall, so it must run every step regardless of whether this
// step's pallet step set it just now or a step ago.
export function stepFail(state, dt) {
  const { tip } = state
  if (tip.active && tip.angle < TIP_MAX_ANGLE) {
    tip.vel += TIP_GRAVITY_ACCEL * dt
    tip.angle = Math.min(tip.angle + tip.vel * dt, TIP_MAX_ANGLE)
  }
}
