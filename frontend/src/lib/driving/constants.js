// Tuning constants for the driving simulation's kinematic "physics" (no
// physics engine - see DrivingScene's useFrame, split across stepDrive.js /
// stepCollision.js / stepForks.js / stepPallet.js / stepFail.js /
// stepGoals.js). Grouped by which step reads them.

// stepDrive: speed and heading integration.
export const MAX_SPEED = 1.5
export const MAX_REVERSE_SPEED = 0.8
export const ACCEL = 1.1
export const BRAKE_DECEL = 2.4
export const REVERSE_ACCEL = 0.7
export const DRAG = 0.7
export const TURN_RATE = 0.85
export const STOP_SPEED_EPSILON = 0.04

// stepForks: rig-derived steering/lift/tilt tuning (forklift.glb, world units
// ~= metres/4).
export const MAX_STEER_ANGLE = 0.45
export const STEER_SIGN = -1 // rear-steer vehicle: rear wheels point away from the turn
export const STEER_DAMP = 8
// Raised from the original 0.3 so the carriage can clear the overhead guard
// and reach the rack's upper shelves - the rig has no baked ceiling of its
// own (mastLift/carriageLift are plain Group.position.y offsets, not morph
// or skeletal animation, see buildVehicleRig in lib/vehicleRig.js), so this
// is a gameplay/visual choice, not a model limit. FORK_SPEED is scaled up to
// match so a full raise still takes about the same time.
export const FORK_MAX_HEIGHT = 0.8
export const FORK_SPEED = 0.6
export const MAST_LIFT_RATIO = 0.5
export const FORK_TIP_OFFSET_FALLBACK = 0.6
export const FORK_REACH_FALLBACK = 0.36

// Mast tilt: rotation.x on the rig's tiltPivot (see buildVehicleRig). Negative
// tilts the mast top back toward the operator (secures a carried load),
// positive tilts it forward (used to level the forks against a rack/floor
// before engaging a pallet). A load is only considered "secured" against a
// sudden-stop fail once tilted back past TILT_SECURE_ANGLE.
export const TILT_MAX_ANGLE = 0.12
export const TILT_SPEED = 0.5
export const TILT_SECURE_ANGLE = -0.06

// stepPallet: pallet pickup gameplay thresholds (no physics engine - see
// lib/loadPhysics.js for how far the forks are in, and data/palletProfile.js
// for the tiers it grades that against). These are the viewer's own
// fork-height gates.
export const FORK_ENGAGE_HEIGHT = 0.05
export const LIFT_THRESHOLD = 0.12
export const CLEAR_DISTANCE = 0.8
// How far a carried pallet sits above the tines - just enough to keep the two
// surfaces from z-fighting.
export const PALLET_CARRY_Y = 0
export const SUDDEN_STOP_DECEL = 1.6
export const SUDDEN_STOP_MIN_SPEED = 0.85
// Standard travel height: forks should stay low and close to the ground while
// moving with a load. Above LIFT_THRESHOLD (0.12) so a normal pickup doesn't
// immediately trip it, well below FORK_MAX_HEIGHT (0.8) - exact value tuned
// for gameplay feel, not a real-world cm conversion.
export const SAFE_TRAVEL_HEIGHT = 0.22
export const HIGH_TRAVEL_MIN_SPEED = 0.4
export const LOAD_GRAVITY = 2.0
export const LOAD_TUMBLE_RATE = 2.6
export const LOAD_REST_TILT = 0.16
export const OVERLOAD_TIP_HEIGHT = 0.08

// stepFail: tip-over "physics" (Module 4) - still kinematic, no physics
// engine. Tip-over pivots the whole truck about the front axle; dropped loads
// follow a simple ballistic arc; cones knock over about their base edge.
export const TIP_PIVOT_Y = 0.08
export const TIP_PIVOT_Z = 0.25
export const TIP_GRAVITY_ACCEL = 2.4
export const TIP_MAX_ANGLE = 1.15

// stepCollision: cone/wall/rack/pallet-as-obstacle checks.
// The 0.7m cone's real base radius, at this scene's metres/4 convention.
// Combined with the truck's own footprint (from the vehicle profile) in the
// exact rectangle-vs-point cone check.
export const CONE_RADIUS = 0.0375
export const CONE_MIN_HIT_SPEED = 0.05
export const CONE_FALL_SPEED = 6
export const CONE_FALL_ANGLE = 1.45
export const WALL_THICKNESS = 0.05 // matches CourseDecorations' wall boxGeometry
export const WALL_HALF_THICKNESS = WALL_THICKNESS / 2
export const WALL_HIT_MARGIN = 0.12
// Solid objects the truck is stopped by rather than driven through: racking
// (which also fails the attempt, like a wall) and pallets sitting on the floor
// (which do not - driving into a pallet is how you pick one up). Racking is
// given a small margin so the body stops just clear of the uprights.
export const RACK_HIT_MARGIN = 0.04
export const PALLET_NUDGE_MAX = 0.02
// Above this the pallet is on a shelf or mid-fall, not an obstacle on the floor.
export const PALLET_SOLID_MAX_Y = 0.1

// stepGoals: secure-parking proficiency (Module 3) - the bay completes when
// the truck is inside the painted lines, aligned with them, stopped, forks
// down, engine off.
export const PARKING_MARGIN_X = 0.052
export const PARKING_MARGIN_Z = 0.105
export const PARKING_ALIGN_TOLERANCE = 0.26
export const PARKING_SPEED_EPSILON = 0.03
export const PARKING_FORK_MAX = 0.02

// stepCamera: first-person mouse-drag look-around. Yaw is unclamped (looking
// over your shoulder is normal); pitch is clamped short of straight up/down
// so lookAt never flips.
export const LOOK_SENSITIVITY = 0.005
export const LOOK_MAX_PITCH = 1.3

export const PALLET_STATE_LABELS = {
  ground: 'Pallet: On Ground',
  carried: 'Pallet: Carried',
  released: 'Pallet: Set Down',
  delivered: 'Pallet: Delivered',
}

// How well the forks are in, as the learner sees it. 'shallow' is lined up
// with a pallet but not far enough in to lift it; 'none' means no pallet is
// engaged at all, and hides the badge.
export const GRIP_LABELS = {
  shallow: 'Forks not seated',
  partial: 'Partial grip',
  secure: 'Secure',
}

export const TILT_LABELS = {
  back: 'Mast: Back',
  level: 'Mast: Level',
  forward: 'Mast: Forward',
}

// TILT_RELEASE_ANGLE comes from data/palletProfile.js (shared with
// lib/loadPhysics.js's slip grading), so tiltStateName takes it as a
// parameter rather than importing it here and risking two copies drifting.
export function tiltStateName(angle, tiltReleaseAngle) {
  if (angle <= TILT_SECURE_ANGLE) return 'back'
  if (angle >= tiltReleaseAngle) return 'forward'
  return 'level'
}
