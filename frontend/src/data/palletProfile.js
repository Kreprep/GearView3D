// Tuning for the fork/pallet interaction in DrivingSimulationViewer.
//
// Same shape of file as rackProfile.js: plain constants, no three.js, so
// lib/loadPhysics.js and lib/courseGoals.js can both import it and still run
// inside the Node backend process (backend/src/lib/courses.js imports
// courseGoals directly to validate a course on publish).
//
// Nothing here is a real-world measurement. The scene's convention is roughly
// metres/4 (lib/driving/units.js), and these are gameplay thresholds tuned for
// feel against that.

// Used when a pallet model's bounding box cannot be measured. The viewer
// measures each loaded pallet GLB instead, the same way buildVehicleRig
// measures the carriage to derive forkTipOffset.
import { G } from '../lib/driving/units.js'

export const PALLET_FALLBACK_FOOTPRINT = { halfWidth: 0.15, halfDepth: 0.15 }

// --- Insertion quality --------------------------------------------------
// How far the forks are into the pallet, as a fraction of the pallet's depth
// along the approach axis. Below MIN the pallet will not lift at all; at or
// above SECURE (and centred, and square) the load carries with zero risk.
export const FORK_INSERT_MIN_RATIO = 0.35
export const FORK_INSERT_SECURE_RATIO = 0.8

// Sideways offset of the fork centreline from the pallet centreline, as a
// fraction of the pallet's half-width. Past MAX the forks miss the pockets
// entirely and the pallet is treated as a solid obstacle instead.
export const FORK_LATERAL_SECURE_RATIO = 0.35
export const FORK_LATERAL_MAX_RATIO = 0.85

// Heading error between the vehicle and the pallet face it is entering,
// in radians. Folded into +/- PI/4 by the engagement maths, because a
// four-way pallet accepts forks on any of its faces.
export const FORK_YAW_SECURE = 0.12
export const FORK_YAW_MAX = 0.35

// --- Losing the load ----------------------------------------------------
// A partially engaged load creeps out along the tines when the truck is
// mishandled. Each gain converts one kind of mishandling into metres of lost
// insertion depth, scaled by the load's own risk (0 = perfectly seated, and
// therefore immune).
export const TILT_BACK_RISK_FACTOR = 0.15 // mast tilted back nearly immunises a partial load
export const SLIP_FAIL_RATIO = 0.3 // depth ratio at which the load leaves the forks
// All three are per second, so a longer mistake costs more than a brief one.
// Tuned so a half-inserted pallet is lost by one genuine hard stop, about a
// second of hard cornering, or a few seconds of travelling mast-forward, while
// a nearly-seated one survives all three.
export const SLIP_DECEL_GAIN = 0.2 // per unit of deceleration, while braking hard
// Per unit of lateral acceleration past SHARP_TURN_LATERAL_ACCEL. Scaled in
// Phase 4 (from 0.12 per unit of |steer| x speed) so a full-speed keyboard
// swerve sheds a half-seated load about as fast as it did before the
// bicycle model.
export const SLIP_TURN_GAIN = 0.33
export const SLIP_TILT_GAIN = 0.2 // per radian the mast is short of tilted back
// Sideways acceleration (scene units/s^2) that counts as a sharp turn: 0.2 g.
export const SHARP_TURN_LATERAL_ACCEL = 0.2 * G

// --- Setting a load down ------------------------------------------------
// How close to the surface below it a carried load has to get before that
// surface takes its weight: the pallet stops following the forks down, sits
// flat, and only comes off the tines once the mast is tilted forward.
export const LOAD_LAND_CLEARANCE = 0.02

// --- Mast tilt gates ----------------------------------------------------
// Forward tilt (positive rotation.x on the rig's tiltPivot) needed to set a
// load down on a shelf, and the combination that tips the truck instead.
export const TILT_RELEASE_ANGLE = 0.06
export const LOAD_TIP_HEIGHT = 0.45 // fork height above which forward tilt can tip the truck
export const LOAD_TIP_WEIGHT_RATIO = 0.6 // fraction of the course's capacityKg
export const LOAD_TIP_TILT_RATIO = 0.75 // fraction of TILT_FORWARD_MAX
