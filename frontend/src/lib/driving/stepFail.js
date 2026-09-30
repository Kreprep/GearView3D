import { TIP_GRAVITY_ACCEL, TIP_MAX_ANGLE, TIP_ROLL_MAX_ANGLE } from './constants.js'
import { tineGroundClearance } from './forkPose.js'

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

// The tip-over's fall: the truck pitches about its front axle until the forks
// meet the ground, or rolls about a side of its stability triangle until it
// lies on its side, accelerating as it goes. stepStability sets `tip.active`
// and the axis; this only continues a fall already under way, so it runs
// every step, failed attempt or not. The forks and the truck's body follow it
// in the physics world (forkPose.js), so a load on them is thrown off for
// real.
export function stepFail(state, world, dt) {
  const { tip } = state
  const forward = tip.axis === 'forward'
  const limit = forward ? TIP_MAX_ANGLE : TIP_ROLL_MAX_ANGLE
  if (!tip.active || tip.vel < 0 || tip.angle >= limit) return

  const from = tip.angle
  tip.vel += TIP_GRAVITY_ACCEL * dt
  tip.angle = Math.min(from + tip.vel * dt, limit)
  // Pitching forward, the truck comes to rest on its fork tips. A negative
  // speed marks the fall as over.
  if (forward && tineGroundClearance(state, world.geometry) < 0) {
    tip.angle = from
    tip.vel = -1
  }
}
