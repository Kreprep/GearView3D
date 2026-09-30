// Physics settings and collider geometry for the Rapier model
// (docs/revisions/post-defense-plan.md, sections 3.1 and 4.6).
//
// Pure data, no imports beyond the units helpers: like the rest of data/, this
// file must stay backend-safe.
//
// Scene units throughout (1 unit is about 4 m, lib/driving/units.js). Every
// box is { center: [x, y, z], half: [x, y, z] } in its owner's frame, glTF
// axes (+Y up, +Z forward).
import { G, kmh, m } from '../lib/driving/units.js'

// --- World ---------------------------------------------------------------
// Chosen in the Phase 2 spike (lib/physics/world.test.js pins them).
// Rapier steps at PHYSICS_DT, SUBSTEPS times per 1/60 s sim step.
export const PHYSICS_WORLD = {
  gravity: [0, -G, 0],
  // Rapier's "units per metre": scales its internal length tolerances
  // (allowed penetration, prediction distance) to the scene's quarter scale.
  lengthUnit: m(1),
  dt: 1 / 120,
  substeps: 2,
  solverIterations: 8,
}

// --- Materials ------------------------------------------------------------
// Friction coefficients from general engineering tables. The tines use
// Rapier's Min combine rule, so tine-on-anything is the tine value; every
// other pair averages, and the pallet and the floor share one value so
// wood-on-concrete is exactly it.
export const FRICTION = {
  steelOnWood: 0.35,
  woodOnConcrete: 0.5,
  rubberOnConcrete: 0.8,
}

// Two colliders count as touching when Rapier's contact distance between
// them is within this: its own allowed penetration at this scale, with room
// for a resting body's hover.
export const TOUCH_DISTANCE = m(0.004)

// --- Forks ----------------------------------------------------------------
// Measured off forklift.glb in Blender (2026-09-29, plan section 2). The
// carriage frame's origin is the tine heel on the tines' underside, centred
// between them; +Z runs along the tines. In the truck's frame the heel is at
// z = TINE_HEEL_Z when the mast is upright.
export const TINE_HEEL_Z = 0.308
// The tines' underside above the floor with the carriage fully lowered and the
// mast upright (3.4 cm; measured off forklift.glb on 2026-09-30).
export const TINE_REST_Y = 0.0086
export const TINE = {
  centreX: 0.0675,
  width: 0.031,
  thickness: 0.011,
  length: 0.606 - 0.308,
}
export const FORK_COLLIDERS = [
  ...[-1, 1].map((side) => ({
    center: [side * TINE.centreX, TINE.thickness / 2, TINE.length / 2],
    half: [TINE.width / 2, TINE.thickness / 2, TINE.length / 2],
  })),
  // Load backrest / carriage face: x +/-0.12, up to y ~0.23 above the tines.
  { center: [0, 0.115, -0.004], half: [0.12, 0.115, 0.004] },
]

// The truck's body, as one box over its footprint (the vehicle profile's, the
// same rectangle the 2D collision uses): y from just clear of the floor to
// the top of the body panels.
export const CHASSIS_Y = [0.01, 0.49]
// A truck that has gone over is a dynamic body (lib/physics/world.js,
// releaseTruck): it stands on its two front wheels and the rear axle's pivot,
// the stability triangle, as three small feet, with the body's box starting
// at the underside of the panels so it is the feet that bear on the floor.
export const WRECK = { footRadius: 0.01, bodyBottom: 0.04 }

// --- Pallets ----------------------------------------------------------------
// Measured off each pallet GLB in Blender on 2026-09-30 and scaled by its
// MODEL_TRANSFORM entry (lib/driving/models.js). The pallet's frame is its
// render group: origin on the floor at the pallet's centre. Each model's fork
// pockets are listed with the axis a fork enters along, so the course editor
// and the physics can tell a four-way pallet from a two-way one.

const box = (x0, x1, y0, y1, z0, z1, scale = 1) => ({
  center: [((x0 + x1) / 2) * scale, ((y0 + y1) / 2) * scale, ((z0 + z1) / 2) * scale],
  half: [(Math.abs(x1 - x0) / 2) * scale, (Math.abs(y1 - y0) / 2) * scale, (Math.abs(z1 - z0) / 2) * scale],
})

// A box turned a quarter turn about +Y, the way three.js turns a model by
// rotation.y = PI / 2: what was along +Z now runs along +X.
const quarterTurn = ({ center: [x, y, z], half: [hx, hy, hz] }) => ({ center: [z, y, -x], half: [hz, hy, hx] })

// The cardboard box drawn on the wooden and plastic pallets
// (cardboard-box.glb at its MODEL_TRANSFORM scale), as half-extents. It
// stands on the pallet's deck.
const CARGO_BOX_HALF = [0.0944, 0.0486, 0.0764]
const cargoBoxOn = (deckY) => ({ center: [0, deckY + CARGO_BOX_HALF[1], 0], half: CARGO_BOX_HALF })

// wooden-pallet.glb: a 1.2 m block pallet, four-way. Raw model units, x
// re-centred on the model's own centre (raw x -2.5..-0.5). Three bottom
// boards and three stringer boards run along Z over the block columns, nine
// 0.2-unit blocks, and a top deck. The deck and stringer boards are one slab
// here: the forks never reach them.
const WOODEN_SCALE = 0.15
const WOODEN_COLUMNS = [-0.9, 0, 0.9]
export const WOODEN_PALLET = {
  mass: 25,
  height: 0.243 * WOODEN_SCALE,
  load: cargoBoxOn(0.243 * WOODEN_SCALE),
  colliders: [
    ...WOODEN_COLUMNS.map((x) => box(x - 0.1, x + 0.1, 0, 0.02, -1, 1, WOODEN_SCALE)),
    ...WOODEN_COLUMNS.flatMap((x) => WOODEN_COLUMNS.map((z) => box(x - 0.1, x + 0.1, 0.02, 0.2, z - 0.1, z + 0.1, WOODEN_SCALE))),
    box(-1, 1, 0.2, 0.243, -1, 1, WOODEN_SCALE),
  ],
  // Entering along Z the forks pass between the block columns; along X,
  // between the block rows (over the bottom boards). Both open to the floor.
  pockets: {
    z: { centres: [-0.45 * WOODEN_SCALE, 0.45 * WOODEN_SCALE], width: 0.7 * WOODEN_SCALE, y: [0, 0.2 * WOODEN_SCALE] },
    x: { centres: [-0.45 * WOODEN_SCALE, 0.45 * WOODEN_SCALE], width: 0.7 * WOODEN_SCALE, y: [0.02 * WOODEN_SCALE, 0.2 * WOODEN_SCALE] },
  },
}

// plastic-pallet.glb: a nine-leg plastic pallet, four-way. Raw units are
// centimetre-like (x +/-50.9, z +/-61.2, 14 high). Legs 0..11.457, deck
// above, and low runners joining the legs along Z under the outer columns.
const PLASTIC_SCALE = 0.00245
const PLASTIC_LEGS_X = [[-50.894, -38.867], [-9.019, 9.019], [38.867, 50.894]]
const PLASTIC_LEGS_Z = [[-61.231, -43.283], [-7.619, 7.619], [43.283, 61.231]]
export const PLASTIC_PALLET = {
  mass: 20,
  height: 14 * PLASTIC_SCALE,
  load: cargoBoxOn(14 * PLASTIC_SCALE),
  colliders: [
    ...PLASTIC_LEGS_X.flatMap(([x0, x1]) => PLASTIC_LEGS_Z.map(([z0, z1]) => box(x0, x1, 0, 11.457, z0, z1, PLASTIC_SCALE))),
    box(-50.894, -38.867, 0, 2.19, -61.231, 61.231, PLASTIC_SCALE),
    box(38.867, 50.894, 0, 2.19, -61.231, 61.231, PLASTIC_SCALE),
    box(-50.894, 50.894, 11.457, 14, -61.231, 61.231, PLASTIC_SCALE),
  ],
  pockets: {
    z: { centres: [-23.943 * PLASTIC_SCALE, 23.943 * PLASTIC_SCALE], width: 29.848 * PLASTIC_SCALE, y: [0, 11.457 * PLASTIC_SCALE] },
    x: { centres: [-25.451 * PLASTIC_SCALE, 25.451 * PLASTIC_SCALE], width: 35.664 * PLASTIC_SCALE, y: [2.19 * PLASTIC_SCALE, 11.457 * PLASTIC_SCALE] },
  },
}

// cement-bag-pallet.glb: a stringer pallet with the load modelled on it.
// Three stringers run along X (z centres -0.542, -0.002, +0.542), notched
// from below at x +/-0.102..0.398; two bottom boards run along Z at the X
// ends. So the wide pockets open along X, and entering along Z means
// threading the notches, which are only 0.052 raw (0.013 units, about 5 cm)
// high: 0.002 units (8 mm) of clearance over a 0.011 tine. See the Phase 2 notes in the plan.
//
// So the model is drawn, and these colliders are laid, a quarter turn round
// (PALLET_MODEL_TURN.heavy below, Phase 7): a course's `rotation: 0` then
// presents the open side to a truck driving up the course, like the other
// two pallets. The numbers here are the model's own, before the turn.
const CEMENT_SCALE = 0.25
const CEMENT_STRINGERS_Z = [[-0.592, -0.492], [-0.052, 0.048], [0.492, 0.592]]
const CEMENT_PALLET_AS_MODELLED = {
  mass: 25,
  height: 0.101 * CEMENT_SCALE,
  colliders: [
    box(-0.5, -0.397, 0, 0.012, -0.6, 0.6, CEMENT_SCALE),
    box(0.397, 0.5, 0, 0.012, -0.6, 0.6, CEMENT_SCALE),
    ...CEMENT_STRINGERS_Z.flatMap(([z0, z1]) => [
      box(-0.498, -0.398, 0.002, 0.087, z0, z1, CEMENT_SCALE),
      box(-0.102, 0.102, 0.002, 0.087, z0, z1, CEMENT_SCALE),
      box(0.398, 0.498, 0.002, 0.087, z0, z1, CEMENT_SCALE),
      box(-0.398, -0.102, 0.054, 0.087, z0, z1, CEMENT_SCALE),
      box(0.102, 0.398, 0.054, 0.087, z0, z1, CEMENT_SCALE),
    ]),
    box(-0.5, 0.5, 0.086, 0.101, -0.6, 0.6, CEMENT_SCALE),
  ],
  // The bag stack, as the load's collider.
  load: box(-0.518, 0.522, 0.102, 0.799, -0.583, 0.568, CEMENT_SCALE),
  pockets: {
    x: { centres: [-0.272 * CEMENT_SCALE, 0.27 * CEMENT_SCALE], width: 0.44 * CEMENT_SCALE, y: [0.012 * CEMENT_SCALE, 0.086 * CEMENT_SCALE] },
    z: { centres: [-0.25 * CEMENT_SCALE, 0.25 * CEMENT_SCALE], width: 0.296 * CEMENT_SCALE, y: [0.002 * CEMENT_SCALE, 0.054 * CEMENT_SCALE] },
  },
}
export const CEMENT_PALLET = {
  ...CEMENT_PALLET_AS_MODELLED,
  colliders: CEMENT_PALLET_AS_MODELLED.colliders.map(quarterTurn),
  load: quarterTurn(CEMENT_PALLET_AS_MODELLED.load),
  pockets: { x: CEMENT_PALLET_AS_MODELLED.pockets.z, z: CEMENT_PALLET_AS_MODELLED.pockets.x },
}

// Which pallet a course pallet is, by its load: the same weight bands the
// viewer picks the model by (lib/driving/models.js).
export const PALLET_LIGHT_MAX_KG = 500
export const PALLET_HEAVY_MIN_KG = 1000
export const PALLETS = { light: WOODEN_PALLET, medium: PLASTIC_PALLET, heavy: CEMENT_PALLET }
// How far each pallet's model is turned about +Y from how it was modelled.
export const PALLET_MODEL_TURN = { light: 0, medium: 0, heavy: Math.PI / 2 }

export function palletKindForWeight(weightKg) {
  if (typeof weightKg !== 'number') return 'light'
  if (weightKg >= PALLET_HEAVY_MIN_KG) return 'heavy'
  if (weightKg > PALLET_LIGHT_MAX_KG) return 'medium'
  return 'light'
}

// What a course pallet that states no weight carries: a light carton.
export const DEFAULT_LOAD_KG = 250

// A course pallet as the physics builds it: its colliders, its load's box
// and weight, and its footprint (half-extents over every collider, which the
// fork-engagement maths and the 2D proximity read).
export function palletPhysics(palletDef) {
  const kind = palletKindForWeight(palletDef.weightKg)
  const pallet = PALLETS[kind]
  const extent = (axis) => Math.max(...pallet.colliders.map(({ center, half }) => Math.abs(center[axis]) + half[axis]))
  return {
    kind,
    pallet,
    loadKg: typeof palletDef.weightKg === 'number' ? palletDef.weightKg : DEFAULT_LOAD_KG,
    footprint: { halfWidth: extent(0), halfDepth: extent(2) },
  }
}

// --- Cone -------------------------------------------------------------------
// traffic-cone.glb at its MODEL_TRANSFORM scale (0.7 m tall): a square base
// plate and the cone standing on it. Measured on 2026-09-30.
export const CONE = {
  mass: 3,
  base: { center: [0, 0.004, 0], half: [0.0594, 0.004, 0.0594] },
  body: { centerY: 0.0915, halfHeight: 0.0835, radius: 0.0375 },
}

// --- Walls and parked vehicles --------------------------------------------
// A course wall as CourseDecorations draws it, and a parked truck's body.
export const WALL = { thickness: 0.05, height: 0.625 }
export const PARKED_VEHICLE_HEIGHT = 0.49

// --- Thresholds read off the physics ---------------------------------------
// GearView defaults, in real units.
//
// The truck's body or forks striking a pallet faster than this along the line
// of contact is an impact (the palletImpact fail). Driving the tines into
// the pockets touches nothing; meeting the pallet's face with the carriage
// at walking pace is how a load is seated.
export const PALLET_IMPACT_SPEED = kmh(5)
// Anything landing on, or struck at, more than this makes a sound.
export const IMPACT_SOUND_SPEED = kmh(1.5)

// --- Rack ------------------------------------------------------------------
// pallet-racking.glb, measured on 2026-09-30, raw model units (scale it by
// RACK_MODEL_SCALE in data/rackProfile.js). One 2.9-unit span with upright
// frames **only at the two ends** (no uprights between the three bays), two
// posts per frame (front and back). Each level has a front and a back beam
// and a decking panel per bay, repeating every 1.1 units.
export const RACK_RAW = {
  uprightX: [1.26, 1.4], // mirrored at -x
  uprightPostZ: [0.45, 0.55], // mirrored at -z
  height: 3.02,
  levelPitch: 1.1,
  beam: { halfLength: 1.295, y: [0.245, 0.345], z: [0.49, 0.54] }, // bottom level; mirrored at -z
  decking: { halfLength: 1.2563, y: [0.341, 0.379], halfDepth: 0.5454 },
  bayX: [-0.825, 0, 0.825],
  bayHalfWidth: 0.41,
}
