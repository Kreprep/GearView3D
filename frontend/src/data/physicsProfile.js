// Physics settings and collider geometry for the Rapier model
// (docs/revisions/post-defense-plan.md, sections 3.1 and 4.6).
//
// Pure data, no imports beyond the units helpers: like the rest of data/, this
// file must stay backend-safe.
//
// Scene units throughout (1 unit is about 4 m, lib/driving/units.js). Every
// box is { center: [x, y, z], half: [x, y, z] } in its owner's frame, glTF
// axes (+Y up, +Z forward).
import { G, m } from '../lib/driving/units.js'

// --- World ---------------------------------------------------------------
// Chosen in the Phase 2 spike (lib/physics/forkSpike.test.js pins them).
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

// --- Forks ----------------------------------------------------------------
// Measured off forklift.glb in Blender (2026-09-29, plan section 2). The
// carriage frame's origin is the tine heel on the tines' underside, centred
// between them; +Z runs along the tines. In the truck's frame the heel is at
// z = TINE_HEEL_Z when the mast is upright.
export const TINE_HEEL_Z = 0.308
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
const CEMENT_SCALE = 0.25
const CEMENT_STRINGERS_Z = [[-0.592, -0.492], [-0.052, 0.048], [0.492, 0.592]]
export const CEMENT_PALLET = {
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
