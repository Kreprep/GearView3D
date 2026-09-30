// Thresholds for the fork/pallet interaction in the driving simulation.
//
// Same shape of file as rackProfile.js: plain constants, no three.js, so
// lib/loadPhysics.js and lib/courseGoals.js can both import it and still run
// inside the Node backend process (backend/src/lib/courses.js imports
// courseGoals directly to validate a course on publish).
//
// What a load does on the forks is the physics engine's business since
// Phase 7 (lib/physics/, data/physicsProfile.js): it slides under braking and
// comes off a short bite by friction and inertia, not by a gain in this file.
// What is left here is how the simulation *reads* that: the fork-insertion
// bands behind the dashboard's grip lamp, and when a pallet counts as lifted,
// set down or lost. GearView defaults, in real units where they have one.
import { G, kmh, m } from '../lib/driving/units.js'

const deg = (degrees) => (degrees * Math.PI) / 180

// A pallet's footprint when there is nothing to measure it from (the course
// validator, which has no physics data to hand).
export const PALLET_FALLBACK_FOOTPRINT = { halfWidth: 0.15, halfDepth: 0.15 }

// --- Insertion quality --------------------------------------------------
// How far the forks are into the pallet, as a fraction of the pallet's depth
// along the approach axis. Below MIN the lamp reads "shallow"; at or above
// SECURE (and centred, and square) it reads "secure".
export const FORK_INSERT_MIN_RATIO = 0.35
export const FORK_INSERT_SECURE_RATIO = 0.8

// Sideways offset of the fork centreline from the pallet centreline, as a
// fraction of the pallet's half-width. Past MAX the forks are not lined up
// with the pockets at all.
export const FORK_LATERAL_SECURE_RATIO = 0.35
export const FORK_LATERAL_MAX_RATIO = 0.85

// Heading error between the vehicle and the pallet face it is entering,
// in radians. Folded into +/- PI/4 by the engagement maths, because a
// four-way pallet accepts forks on any of its faces.
export const FORK_YAW_SECURE = 0.12
export const FORK_YAW_MAX = 0.35

// How far above or below a pocket a tine may read and still count as in it
// (the lamp's height check, for a pallet the forks are not yet touching).
export const FORK_POCKET_TOLERANCE = m(0.012)

// --- Lifted, set down, lost -----------------------------------------------
// lib/physics/palletState.js. A pallet is lifted once the forks alone have
// held it this long, and off the forks once they have not touched it this
// long: long enough not to be one step's bounce.
export const PALLET_CONFIRM_SECONDS = 0.1
// Set down is coming off the forks slower than this. Lowering a load at the
// truck's full lowering speed (0.5 m/s, 1.8 km/h) is inside it; a load that
// slides off a moving truck is not.
export const PALLET_SET_DOWN_SPEED = kmh(3)
// At rest: slower than this for this long.
export const PALLET_REST_SPEED = m(0.03)
export const PALLET_REST_SECONDS = 0.3
// Level enough to count as set down and delivered, and the lean past which a
// load has fallen over.
export const PALLET_LEVEL_LEAN = deg(5)
export const PALLET_DROP_LEAN = deg(20)

// --- Why a load was lost ------------------------------------------------
// A lost load's fail message names what the operator did in the second
// before it: braked hard (SUDDEN_STOP_DECEL, lib/driving/constants.js),
// cornered harder than this, or travelled with the mast not tilted back.
export const SHARP_TURN_LATERAL_ACCEL = 0.2 * G
export const LOAD_LOSS_WINDOW_SECONDS = 1

// A load sliding along the tines faster than this is shifting (the
// load-shifting safety rule).
export const LOAD_SHIFT_SPEED = m(0.08)

// --- Mast tilt gates ----------------------------------------------------
// Forward tilt (positive rotation.x on the rig's tiltPivot) past which the
// dashboard reads the mast as tilted forward.
export const TILT_RELEASE_ANGLE = 0.06
