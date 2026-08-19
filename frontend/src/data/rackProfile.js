// Shared geometry for the pallet-racking prop used by the Module 4 "store the
// pallet on a shelf" driving step. Numbers were measured off
// public/models/pallet-racking.glb in Blender: raw bounding box 2.9 x 1.2 x
// 3.02 world units (width x depth x height), a triple-bay, 3-tier warehouse
// unit.
//
// Its height is squashed independently of its width/depth: the fork's
// fixed 0-0.3 travel range (FORK_MAX_HEIGHT in DrivingSimulationViewer.jsx)
// forces the three shelf tiers into a band a real rack's height would never
// fit in, but there is no such constraint on footprint - a uniform scale
// tight enough to satisfy the height limit rendered the whole rack as a
// barely-visible sliver. Squashing only the Y axis keeps the rack a legible,
// pallet-proportioned footprint while still landing its shelves in reach.
//
// Only the rack's centre bay is used as the single storable slot per level;
// the two side bays render for visual scale but have no gameplay target.
export const RACK_MODEL_URL = '/models/pallet-racking.glb'

// --- Tuning knobs -----------------------------------------------------
// RACK_SCALE_XZ: footprint size (width/depth). Purely visual - bump this
// freely to make the rack bigger/smaller on screen. No upper limit; a huge
// value just makes a huge rack. Keep RACK_SLOT_RADIUS below the resulting
// RACK_FOOTPRINT.halfWidth (printed below) or the target ring will poke out
// past the model's edges.
//
// RACK_SCALE_Y: height squash. This ONE has a ceiling - raw top-shelf height
// is 2.579 model units, and it must clear FORK_MAX_HEIGHT (now 0.8, raised
// from 0.3 specifically so the carriage can reach past the overhead guard -
// see DrivingSimulationViewer.jsx) or the top shelf becomes unreachable. Max
// safe value is therefore ~0.8 / 2.579 = 0.31; stay a bit under that for
// margin (e.g. 0.29). RACK_LEVEL_HEIGHTS below is computed from this
// automatically, so there is nothing else to keep in sync when you change it.
export const RACK_SCALE_XZ = 0.50
export const RACK_SCALE_Y = 0.250
export const RACK_MODEL_SCALE = [RACK_SCALE_XZ, RACK_SCALE_Y, RACK_SCALE_XZ]

// Half-extents of the rack's footprint (world units, X = width, Z = depth) -
// used only for the 2D admin map icon. The rack is deliberately not a live
// collider: the learner has to drive the fork tip inside this footprint to
// place a pallet, so treating it as a solid obstacle like a wall would make
// delivery impossible.
export const RACK_FOOTPRINT = { halfWidth: (2.9 / 2) * RACK_SCALE_XZ, halfDepth: (1.2 / 2) * RACK_SCALE_XZ }

export const RACK_LEVELS = ['bottom', 'middle', 'top']

export const RACK_LEVEL_LABELS = {
  bottom: 'Bottom shelf',
  middle: 'Middle shelf',
  top: 'Top shelf',
}

// Raw (unscaled) height of each shelf's top surface, measured in Blender off
// the model's centre bay - the model's own geometry, never changes.
const RACK_LEVEL_RAW_Y = { bottom: 0.379, middle: 1.479, top: 2.579 }

// Height (world units, off the ground) of each shelf's top surface -
// RACK_LEVEL_RAW_Y scaled by RACK_SCALE_Y, so changing the scale above moves
// these automatically. `top` should sit inside the fork's 0-0.3 travel range
// with headroom, reachable by holding Raise to its cap.
export const RACK_LEVEL_HEIGHTS = Object.fromEntries(
  RACK_LEVELS.map((level) => [level, Number((RACK_LEVEL_RAW_Y[level] * RACK_SCALE_Y).toFixed(4))]),
)

// How close the carried pallet's fork height must be to a level's target,
// and how close (XZ, world units) the fork tip must be to the rack, to place
// it there. Generous on both counts - this is untimed practice and the
// learner has no numeric height readout, only the chase-cam view.
export const RACK_LEVEL_TOLERANCE = 0.05
export const RACK_SLOT_RADIUS = 0.32
export const RACK_PLACE_MAX_SPEED = 0.25

// --- Decorative racks ---------------------------------------------------
// Background dressing, not a course object: no id, no target, not graded, not
// addressed by anything else - just a `decorations` entry like a cone or
// wall (see courseEdit.js/DrivingSimulationViewer.jsx), placed and rotated
// like any other prop but carrying no gameplay data. Three kinds cover the
// common warehouse looks; all three render the same rack model/scale as the
// functional rack so a course doesn't mix two differently-sized racks.
export const DECOR_RACK_KINDS = ['rack-empty', 'rack-loaded', 'rack-spare']

export const DECOR_RACK_LABELS = {
  'rack-empty': 'Empty rack (decoration)',
  'rack-loaded': 'Loaded rack (decoration)',
  'rack-spare': 'Spare rack (decoration)',
}

// Raw (unscaled) X of each of the model's three bays, left/centre/right -
// the functional rack only ever uses the centre one as its gameplay slot,
// but decoration can fill all three for a fuller warehouse look.
const RACK_BAY_RAW_X = [-0.825, 0, 0.825]

// Every bay x every level = 9 slots. `rack-loaded` fills all of them;
// `rack-spare` fills a handful, left visibly uneven rather than a tidy
// pattern, like a shelf that has been partly picked from.
const RACK_ALL_SLOTS = RACK_BAY_RAW_X.flatMap((bayX) => RACK_LEVELS.map((level) => ({ bayX, level })))

export const RACK_SLOTS_BY_KIND = {
  'rack-empty': [],
  'rack-loaded': RACK_ALL_SLOTS,
  'rack-spare': [
    { bayX: RACK_BAY_RAW_X[0], level: 'bottom' },
    { bayX: RACK_BAY_RAW_X[2], level: 'bottom' },
    { bayX: RACK_BAY_RAW_X[1], level: 'middle' },
    { bayX: RACK_BAY_RAW_X[2], level: 'top' },
  ],
}

// World-space offset (relative to the rack's own position/rotation) of a
// slot's load - X follows the footprint scale, Y is the level's real height.
export function rackSlotOffset(slot) {
  return [slot.bayX * RACK_SCALE_XZ, RACK_LEVEL_HEIGHTS[slot.level], 0]
}
