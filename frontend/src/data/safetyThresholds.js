// Thresholds for the driving simulation's safety rules (docs/revisions/
// post-defense-plan.md, section 4.5): the one place to tune them and to cite
// what each one implements. lib/driving/safetyRules.js reads them.
//
// OSHA 29 CFR 1910.178 is the reference for every rule, but it gives no
// numbers: "authorized plant speed limits", forks "raised only as far as
// necessary to clear the road surface". So every value here is a GearView
// default, written in real units (lib/driving/units.js) and labelled with the
// paragraph whose principle it puts a number on.
//
// Pure data, no browser APIs: backend-importable like the rest of data/.

import { kmh, m } from '../lib/driving/units.js'

const deg = (degrees) => (degrees * Math.PI) / 180

// Below this the truck is creeping or stopped, not travelling. GearView
// default. The rules that are about travelling (raised forks, mast not back,
// lifting on the move, shuttling the lever) only count above it.
export const CREEP_SPEED = kmh(1)

// (n)(8): a speed that permits a safe stop. Time until the truck reaches what
// is in its path at its present speed. GearView defaults: under 2 s is a
// caution, under 1 s is "stop".
export const OBSTACLE_CAUTION_SECONDS = 2
export const OBSTACLE_DANGER_SECONDS = 1
// Below this the truck is being positioned, not driven at something: from
// 3 km/h it stops in under 10 cm at full brake, and parking in a bay or
// nosing up to a wall means closing on it slowly. The obstacle rules only
// time the truck above it. GearView default.
export const OBSTACLE_MIN_SPEED = kmh(3)
// The path swept is the truck's own width plus this much each side. GearView
// default.
export const PATH_MARGIN = m(0.1)

// (n)(15): the tail of a rear-steer truck swings out in a turn. An obstacle
// this close to the rear corner on the outside of the turn, with the rear
// wheels turned at least this fraction of full lock. GearView defaults.
export const TAIL_SWING_REACH = m(0.5)
export const TAIL_SWING_MIN_STEER = 0.2

// (n)(1): plant speed limits. OSHA sets no figure; 8 km/h is a common indoor
// site rule and the default for a course that sets none (course.speedLimitKmh).
export const DEFAULT_SPEED_LIMIT_KMH = 8

// (n)(15): reduce speed for turns, steer smoothly. Above this speed, the rear
// wheels past half lock, or the steering wheel turned faster than this many
// full locks per second, is a fast turn. GearView defaults.
export const TURN_SPEED = kmh(5)
export const TURN_MAX_STEER = 0.5
export const TURN_MAX_STEER_RATE = 1.5

// (n)(7)(iii): forks raised only as far as necessary to clear the road
// surface. GearView default: 30 cm, the team's value (2026-09-30) once a
// load rode on physical forks. The usual real travel height is about 15 cm;
// a load leaves the floor at about 4 cm of fork height, so 30 cm leaves the
// keyboard's all-or-nothing lift key a band it can stop in. (Before Phase 7 a
// load lifted at a scripted 48 cm, and the sign stood at 50 cm.) It also
// counts as "raised" for tilt-forward-elevated.
//
// The highTravel fail is this rule's escalation and shares the value: above
// it, laden, faster than HIGH_TRAVEL_MIN_SPEED (lib/driving/constants.js).
export const FORKS_TRAVEL_HEIGHT = m(0.3)

// (o)(6): no forward tilt with the load elevated, except to deposit it. The
// mast this far forward of vertical counts as tilted forward. GearView
// default.
export const TILT_FORWARD_ANGLE = deg(1)

// (n)(6): look in the direction of travel. Reversing with the first-person
// view turned less than this off straight ahead. GearView default; a D-pad
// side glance turns the view exactly this far, which counts as looking round.
export const LOOK_AHEAD_HALF_ANGLE = deg(60)

// Operator's manual: pedal pressed this far against a set parking brake.
// GearView default.
export const PARKING_BRAKE_THROTTLE = 0.2

// (o)(6), (n)(15): stability. The smaller of the truck's two stability
// margins (lib/physics/stability.js: 1 with nothing acting, 0 at the point of
// tipping) under this is a tip risk. GearView default.
export const TIP_RISK_MARGIN = 0.3

// (m)(5)(i): forks fully lowered when the truck is left. Higher than this
// with the engine off or the parking brake set is "forks up". GearView
// default.
export const PARKED_FORKS_MAX = m(0.08)
