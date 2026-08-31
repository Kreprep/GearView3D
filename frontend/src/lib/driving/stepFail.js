import { TIP_GRAVITY_ACCEL, TIP_MAX_ANGLE } from './constants'

// The one place failedRef flips true. Idempotent - a second cause hitting in
// the same or a later frame is a no-op, so whichever fails first is the
// reason reported to the learner.
export function triggerFail(ctx, reason) {
  const { failedRef, onFailRef } = ctx
  if (failedRef.current) return
  failedRef.current = true
  onFailRef.current?.(reason)
}

// Overload/tip-over tip animation: pitches the whole truck about the front
// axle with an accelerating fall until the forks hit the ground. `tip.active`
// is set from stepPallet (overload / load-tipping); this only continues an
// already-active fall, so it must run every frame regardless of whether this
// frame's collision/pallet steps set it just now or a frame ago.
export function stepFail(ctx, dt) {
  const { tipStateRef, tipPivotRef } = ctx
  const tip = tipStateRef.current
  if (tip.active && tip.angle < TIP_MAX_ANGLE) {
    tip.vel += TIP_GRAVITY_ACCEL * dt
    tip.angle = Math.min(tip.angle + tip.vel * dt, TIP_MAX_ANGLE)
    if (tipPivotRef.current) tipPivotRef.current.rotation.x = tip.angle
  }
}
