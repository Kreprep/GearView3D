import { clamp } from '../math.js'
import { MAX_STEER_ANGLE, STEERING_WHEEL_LOCK } from './constants.js'
import { mps } from './units.js'

// Faults in the truck's controls, for the defect test's cab scenarios
// (docs/modules/module-improvements-plan.md, section 3.4). Unlike an
// instrument fault (lib/inspection/instruments.js), which only changes what
// the dashboard reads, these change what the truck does, so they live in the
// simulation core: simCore's setFaults() stores them on state.faults, and
// stepDrive / stepForks read them.
//
// All off by default. With every fault off the steps do exactly what they did
// before faults existed, which is what keeps the characterization trace
// unchanged. Pure, backend-importable.
//
//   brakeFade      fraction of the service brake lost, 0..0.9. 0.5 halves
//                  the deceleration, which doubles the stopping distance.
//                  The parking brake is a separate, mechanical brake and is
//                  not affected.
//   steeringPlay   free play in the steering wheel, in radians of the
//                  wheel's own turn: the wheel moves this far before the
//                  rear wheels follow (backlash, either way).
//   liftDrift      how fast raised forks sink with the lift lever released
//                  (an internal leak in the lift cylinder), scene units per
//                  second.

export const NO_CONTROL_FAULTS = Object.freeze({ brakeFade: 0, steeringPlay: 0, liftDrift: 0 })

export const CONTROL_FAULT_KEYS = Object.keys(NO_CONTROL_FAULTS)

const MAX_BRAKE_FADE = 0.9
// More play than half the wheel's lock would leave nothing to steer with.
const MAX_STEERING_PLAY = STEERING_WHEEL_LOCK / 2
const MAX_LIFT_DRIFT = mps(0.5)

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

// A fault set with every key present and every value in range. Unknown keys
// are dropped; a missing or malformed value is off.
export function normalizeControlFaults(faults) {
  if (!faults || typeof faults !== 'object') return NO_CONTROL_FAULTS
  return {
    brakeFade: clamp(finite(faults.brakeFade), 0, MAX_BRAKE_FADE),
    steeringPlay: clamp(finite(faults.steeringPlay), 0, MAX_STEERING_PLAY),
    liftDrift: clamp(finite(faults.liftDrift), 0, MAX_LIFT_DRIFT),
  }
}

// The steering play as a fraction of the input's range (-1..1 is lock to
// lock): the steering wheel turns STEERING_WHEEL_LOCK each way at full input.
export const steeringPlayInput = (faults) => (faults.steeringPlay > 0 ? faults.steeringPlay / STEERING_WHEEL_LOCK : 0)

// Backlash between the steering wheel and the rear wheels. `engaged` is where
// the steering linkage was left last step (an input, -1..1); the wheel can
// move up to `play` either side of it before taking the linkage along.
// Returns the new engaged position. The linkage's travel is rescaled so the
// rear wheels still reach full lock at full input, as a worn box still does.
export function takeUpPlay(engaged, input, play) {
  if (play <= 0) return input
  const half = play / 2
  if (input > engaged + half) return input - half
  if (input < engaged - half) return input + half
  return engaged
}

// The rear wheels' target angle for a linkage position with backlash `play`.
export const linkageSteerAngle = (engaged, play) => clamp(engaged / (1 - play / 2), -1, 1) * MAX_STEER_ANGLE
