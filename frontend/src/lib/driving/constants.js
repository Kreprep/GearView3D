import { G, kmh, mps, mps2 } from './units.js'

// Tuning constants for the driving simulation's kinematic "physics" (no
// physics engine yet). The headless core (simCore.js) runs the steps that read
// them - stepDrive.js / stepCollision.js / stepForks.js / stepPallet.js /
// stepFail.js / stepGoals.js - at a fixed step (simLoop.js). Grouped by which
// step reads them. New constants are written in real units via units.js.
//
// The drive, lift and tilt numbers are the reference truck's, the Toyota
// 8FGU25 (docs/revisions/post-defense-plan.md, section 2), taken from public
// spec listings (constructionequipmentguide.com, heavy-spec.com): no official
// spec sheet was available (question Q-A). Values the listings don't give
// are GearView defaults, marked as such.

const deg = (degrees) => (degrees * Math.PI) / 180

// stepDrive: the drive train. Throttle sets a target speed (a torque-
// converter truck creeps at part throttle rather than accelerating forever)
// and the truck accelerates toward it at DRIVE_ACCEL; brake, inching and the
// parking brake slow it.
export const MAX_SPEED = kmh(17.6) // 8FGU25 max travel speed (public listing)
export const MAX_REVERSE_SPEED = kmh(11.5) // GearView default (the pre-Phase 4 value)
export const DRIVE_ACCEL = mps2(1.2) // GearView default: 0 to 17.6 km/h in about 4 s
// Full service-brake pedal. About 0.35 g is ordinary service braking (70% of
// the pedal); 0.5 g is an industrial truck's hard stop.
export const BRAKE_DECEL = 0.5 * G
export const COAST_DECEL = mps2(0.6) // GearView default: engine braking and rolling resistance
// The IC truck's inching pedal declutches the drive over its first travel,
// then applies the service brake over the rest.
export const INCHING_BRAKE_START = 0.7
export const STOP_SPEED_EPSILON = 0.04

// stepDrive: rear-wheel-steer bicycle model. The front (drive) axle rolls
// without slipping, so the truck turns about a point on the front axle line
// and the counterweight swings out, as a real forklift's does. Yaw rate is
// v * tan(steer) / WHEELBASE, with the wheelbase measured off forklift.glb
// (1.53 m) rather than the spec's 1.65 m, so the wheels don't visibly skid.
//
// MAX_STEER_ANGLE is the rear wheels' lock. The 8FGU25's 2,220 mm outside
// turning radius puts the turning centre almost on the truck's centreline, a
// wheel angle of about 80 degrees: a forklift pivots nearly on the spot.
export const MAX_STEER_ANGLE = deg(80)
export const STEER_SIGN = -1 // rear-steer vehicle: rear wheels point away from the turn
// How fast the rear wheels follow the steering (hydraulic steering lag).
export const STEER_DAMP = 8

// keyboardSource: A/D work a virtual steering wheel. It turns at
// KEYBOARD_STEER_RATE (fractions of full lock per second) while a key is
// held and self-centres at KEYBOARD_STEER_RETURN_RATE when released. Its lock
// shrinks with speed so the yaw rate at speed is what the keyboard gave
// before the bicycle model (KEYBOARD_YAW_RATE, scaled down to
// KEYBOARD_YAW_MIN_SCALE at low speed), while at a crawl it still reaches
// full lock for a tight pivot. A physical wheel gets the full lock at any
// speed, as on a real truck.
export const KEYBOARD_STEER_RATE = 2.5
export const KEYBOARD_STEER_RETURN_RATE = 4
export const KEYBOARD_YAW_RATE = 0.85
export const KEYBOARD_YAW_MIN_SCALE = 0.35
export const KEYBOARD_YAW_FULL_SPEED = 1.5 // the old MAX_SPEED, where the old yaw scale reached 1

// stepForks: lift and mast tilt.
// Raised from the original 0.3 so the carriage can clear the overhead guard
// and reach the rack's upper shelves - the rig has no baked ceiling of its
// own (mastLift/carriageLift are plain Group.position.y offsets, not morph
// or skeletal animation, see buildVehicleRig in lib/vehicleRig.js). 3.2 m is
// close to the 8FGU25's 3.34 m standard mast and matches the rack levels.
export const FORK_MAX_HEIGHT = 0.8
export const LIFT_SPEED = mps(0.6) // 8FGU25 lift speed, laden (public listing)
export const LOWER_SPEED = mps(0.5) // 8FGU25 lowering speed, laden (public listing)
export const MAST_LIFT_RATIO = 0.5

// Mast tilt: rotation.x on the rig's tiltPivot (see buildVehicleRig). Negative
// tilts the mast top back toward the operator (secures a carried load),
// positive tilts it forward (used to level the forks against a rack/floor
// before engaging a pallet). A load is only considered "secured" against a
// sudden-stop fail once tilted back past TILT_SECURE_ANGLE.
export const TILT_FORWARD_MAX = deg(6) // 8FGU25 (public listing)
export const TILT_BACK_MAX = deg(11) // 8FGU25 (public listing)
export const TILT_SPEED = deg(4) // GearView default, per second
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
// Braking harder than 0.4 g while carrying is a sudden stop: full pedal
// (0.5 g) is, ordinary service braking (0.35 g) is not. GearView default.
export const SUDDEN_STOP_DECEL = 0.4 * G
// Hard braking only counts from above this speed: 10 km/h, the same fraction
// of top speed (0.57) the pre-Phase 4 value was. GearView default.
export const SUDDEN_STOP_MIN_SPEED = kmh(10)
// Standard travel height: forks should stay low and close to the ground while
// moving with a load. Above LIFT_THRESHOLD (0.12) so a normal pickup doesn't
// immediately trip it, well below FORK_MAX_HEIGHT (0.8) - exact value tuned
// for gameplay feel, not a real-world cm conversion.
//
// This is the highTravel *fail*. The forks-high-travel safety sign warns from
// 30 cm (FORKS_TRAVEL_HEIGHT, data/safetyThresholds.js); the two values unify
// in Phase 7, since moving this one changes the simulation.
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

// syncView: the cab controls. With keyboard steering the cab's wheel turns
// this far at full steering lock each way - fewer turns than a real truck's
// (about two), so keyboard steering doesn't blur the wheel. A connected
// steering wheel shows its own real rotation instead. The hydraulic levers rock LEVER_THROW at full input, easing
// toward it at LEVER_DAMP per second.
export const STEERING_WHEEL_LOCK = Math.PI * 1.25
export const LEVER_THROW = 0.35
export const LEVER_DAMP = 14

// stepCamera: first-person mouse-drag look-around. Yaw is unclamped (looking
// over your shoulder is normal); pitch is clamped short of straight up/down
// so lookAt never flips.
export const LOOK_SENSITIVITY = 0.005
export const LOOK_MAX_PITCH = 1.3

export const PALLET_STATE_LABEL_KEYS = {
  ground: 'driving.hud.pallet.ground',
  carried: 'driving.hud.pallet.carried',
  released: 'driving.hud.pallet.released',
  delivered: 'driving.hud.pallet.delivered',
}

// How well the forks are in, as the learner sees it on the dashboard.
// 'shallow' is lined up with a pallet but not far enough in to lift it;
// 'none' means no pallet is engaged at all, and hides the reading.
export const GRIP_LABEL_KEYS = {
  shallow: 'driving.hud.grip.shallow',
  partial: 'driving.hud.grip.partial',
  secure: 'driving.hud.grip.secure',
}

// TILT_RELEASE_ANGLE comes from data/palletProfile.js (shared with
// lib/loadPhysics.js's slip grading), so tiltStateName takes it as a
// parameter rather than importing it here and risking two copies drifting.
export function tiltStateName(angle, tiltReleaseAngle) {
  if (angle <= TILT_SECURE_ANGLE) return 'back'
  if (angle >= tiltReleaseAngle) return 'forward'
  return 'level'
}
