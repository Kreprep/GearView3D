// Real units for the driving simulation, in one place.
//
// The scene is built at roughly a quarter of real size: one scene unit is
// about 4 m (forklift.glb's chassis is 0.56 x 0.30 units, about 2.25 x 1.2 m).
// New tuning constants are written in real units through these helpers, e.g.
// `MAX_SPEED = kmh(17.6)`, so they can be checked against the reference
// truck's spec sheet (docs/revisions/post-defense-plan.md, section 2).
// Existing constants in constants.js are converted as each phase touches
// them.
//
// Pure, no imports: backend-safe like everything the course validator reads.

export const METRES_PER_UNIT = 4

// Real -> scene units.
export const m = (metres) => metres / METRES_PER_UNIT
export const kmh = (kilometresPerHour) => kilometresPerHour / 3.6 / METRES_PER_UNIT
export const mps = (metresPerSecond) => metresPerSecond / METRES_PER_UNIT
export const mps2 = (metresPerSecondSquared) => metresPerSecondSquared / METRES_PER_UNIT

// Gravity in scene units per second squared.
export const G = 9.81 / METRES_PER_UNIT

// Scene -> real units, for readouts.
export const toMetres = (units) => units * METRES_PER_UNIT
export const toKmh = (unitsPerSecond) => unitsPerSecond * METRES_PER_UNIT * 3.6
