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
// value just makes a huge rack. RACK_SLOT_HALF_WIDTH below scales with it, so
// the target marker keeps tracking the centre bay.
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
// the 2D admin map icon, and the live collider the vehicle body is blocked by.
// Racking is structure: the truck body must never touch it, so a body hit
// fails the attempt like a wall. Only the *forks* reach into the bay, and they
// can, because the body is stopped a half-length back - see RACK_SLOT_* below
// and the placement check in DrivingSimulationViewer.
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

// How close the carried pallet's fork height must be to a level's target to
// place it there. Generous - this is untimed practice and the learner has no
// numeric height readout, only the chase-cam view.
export const RACK_LEVEL_TOLERANCE = 0.05
export const RACK_PLACE_MAX_SPEED = 0.25

// Speed above which touching a rack is a strike rather than a stop. The truck
// is blocked by racking at any speed, so a learner creeping up to a bay to
// place a pallet - which is the correct way to do it, and puts the body right
// at the rack's face - is stopped without being failed. Only hitting it at
// travelling speed counts as driving into the structure. Deliberately above
// RACK_PLACE_MAX_SPEED, so every approach slow enough to place a load is also
// slow enough not to fail.
export const RACK_STRIKE_SPEED = 0.3

// The centre bay's mouth, in the rack's own local frame. The fork tip has to
// be inside this rectangle to set a pallet down.
//
// This used to be a radius from the rack's *centre*, which stopped working
// once the rack became a collider: the vehicle body is blocked at the rack's
// front face, and the fork tip sits roughly a body half-length ahead of the
// vehicle centre, so the tip can only ever reach the face plane - never the
// middle of the rack. A rectangle spanning the bay's width, entered from
// either face, is both reachable and a fairer target than a circle.
//
// The approach margin is deliberately generous for the same reason: the body
// is stopped, and failed, at the rack's front face, so a tight margin would
// leave a delivery window barely wider than one frame of travel and the
// learner would strike the rack trying to hit it. Stopping short and tilting
// forward has to be the winning move, not threading a gap. The viewer widens
// this further for a vehicle whose forks reach less far past its own body.
export const RACK_SLOT_HALF_WIDTH = (0.825 / 2) * RACK_SCALE_XZ
export const RACK_SLOT_APPROACH_MARGIN = 0.32

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
