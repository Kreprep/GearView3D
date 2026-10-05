// How a stored course's pallets, drop zones and targets are read
// (docs/modules/module-improvements-plan.md, Phase 5). One reader for every
// shape a course has been stored in, so the simulation, the viewer, the
// Course Editor and validateCourse() agree:
//
//   pallets          `pallets`, or the older singular `pallet`
//   drop zones       `dropZones` (each with an `id`), plus the older single
//                    `dropZone`, read as a zone with the id DEFAULT_DROP_ZONE_ID
//   a pallet's target  `target`: { zone: id } or { rack: id, level }; the
//                    older `targetRack` + `targetLevel` read as { rack, level };
//                    none means "any drop zone", which is what a pallet with
//                    no target always meant
//   a pallet's start  on the floor at `position`, or with `startShelf:
//                    { rack, level }` resting on that rack's centre bay at
//                    that level, at the front of the bay (the side a truck
//                    facing the way the rack is turned comes from), turned
//                    with the rack. At the front because the truck's body
//                    stops at the rack's face: the forks reach only the front
//                    of the bay, which is also where a stored load is left.
//
// Pure and backend-safe, like lib/courseGoals.js, which imports it: plain
// data in and out, no three.js, Rapier or browser APIs.
import { palletPhysics, RACK_RAW } from '../data/physicsProfile.js'
import { RACK_LEVEL_HEIGHTS, RACK_LEVELS, RACK_MODEL_SCALE } from '../data/rackProfile.js'

export const DEFAULT_DROP_ZONE_ID = 'drop-zone'

// A shelf-start pallet is placed this far above the decking (scene units), so
// its physics body starts just clear of it rather than inside it.
const SHELF_CLEARANCE = 0.0005
// ...and this far back from the decking's front edge.
const SHELF_EDGE_INSET = 0.0025
const DECK_HALF_DEPTH = RACK_RAW.decking.halfDepth * RACK_MODEL_SCALE[2]

export function courseDropZones(course) {
  const zones = Array.isArray(course?.dropZones) ? course.dropZones : []
  if (!course?.dropZone) return zones
  return [...zones, { ...course.dropZone, id: course.dropZone.id ?? DEFAULT_DROP_ZONE_ID }]
}

// { zone }, { rack, level } or null (any drop zone).
export function palletTarget(def) {
  const target = def?.target
  if (target?.zone) return { zone: target.zone }
  if (target?.rack && target.level) return { rack: target.rack, level: target.level }
  if (def?.targetRack && def.targetLevel) return { rack: def.targetRack, level: def.targetLevel }
  return null
}

// The shelf a pallet starts on, or null when it starts on the floor.
export function palletStartShelf(def) {
  const shelf = def?.startShelf
  return shelf?.rack && RACK_LEVELS.includes(shelf.level) ? { rack: shelf.rack, level: shelf.level } : null
}

// Where a pallet starts: { position: [x, y, z], rotation }. A shelf-start
// pallet whose rack is missing starts where its own position says, on the
// floor (validateCourse reports the missing rack).
export function palletStartPose(def, racks = []) {
  const shelf = palletStartShelf(def)
  const rack = shelf && racks.find((entry) => entry.id === shelf.rack)
  if (rack) {
    const rotation = rack.rotation || 0
    // Back from the rack's centre toward its front, along the rack's own Z.
    const front = -(DECK_HALF_DEPTH - palletPhysics(def).footprint.halfDepth - SHELF_EDGE_INSET)
    return {
      position: [rack.position[0] + Math.sin(rotation) * front, RACK_LEVEL_HEIGHTS[shelf.level] + SHELF_CLEARANCE, rack.position[2] + Math.cos(rotation) * front],
      rotation,
    }
  }
  return { position: [def.position[0], 0, def.position[2]], rotation: def.rotation || 0 }
}

// The course's pallets as the simulation and the viewer place them: each
// stored pallet with its start pose resolved. A pallet that starts on the
// floor comes back with the same position and rotation it was stored with.
export function coursePallets(course) {
  const stored = course?.pallets || (course?.pallet ? [course.pallet] : [])
  const racks = course?.racks || []
  return stored.map((def) => ({ ...def, ...palletStartPose(def, racks) }))
}
