import {
  RACK_FOOTPRINT,
  RACK_LEVEL_HEIGHTS,
  RACK_LEVEL_TOLERANCE,
  RACK_SLOT_APPROACH_MARGIN,
  RACK_SLOT_HALF_WIDTH,
} from '../../data/rackProfile.js'
import { toRectLocal } from '../simCollision.js'
import { RACK_HIT_MARGIN } from './constants.js'

// Where a rack-targeted pallet is set down: the mouth of its target rack's
// centre bay. stepPallet grades a delivery against it, and the safety rules
// (safetySnapshot.js) read a rack's bay as the stack: the one place raised
// forks and a raised load tilted forward are the correct move. Pure.

// How far past the rack's centre line the fork tip may be and still count as
// in the bay. Racking blocks the truck body, so the fork tip can only ever
// reach a little way past the rack's front face - and how far depends on the
// vehicle, since a short fork on a long body reaches less. Derive the depth
// the slot accepts from that geometry rather than trusting a fixed margin, or
// a body footprint tuned longer in Equipment Settings could never deliver.
export function rackSlotReach(world) {
  return (
    RACK_FOOTPRINT.halfDepth +
    Math.max(RACK_SLOT_APPROACH_MARGIN, world.halfLength + RACK_HIT_MARGIN - world.geometry.forkTipOffset + 0.05)
  )
}

// Whether a fork tip at (tipX, tipZ) is lined up with a rack's centre bay:
// inside its mouth, from either face, at any height.
export function inRackSlot(tipX, tipZ, rack, world) {
  const slot = toRectLocal(tipX, tipZ, { x: rack.position[0], z: rack.position[2], rotation: rack.rotation || 0 })
  return Math.abs(slot.x) <= RACK_SLOT_HALF_WIDTH && Math.abs(slot.z) <= rackSlotReach(world)
}

// A pallet's target rack and how the forks stand against it, for a fork tip
// at (tipX, tipZ) and the forks at `forkHeight`:
//   targetRack, targetHeight  the rack and its shelf's height, or null
//   inSlotRect    lined up with the bay, at any height: what puts a shelf
//                 under the load instead of the floor
//   atTargetSlot  lined up and at the target level as well: what makes
//                 setting the load down a delivery
export function targetRackSlot({ tipX, tipZ, forkHeight }, palletDef, world) {
  const targetRack = palletDef.targetRack ? world.racks.find((rack) => rack.id === palletDef.targetRack) : null
  const targetHeight = targetRack && palletDef.targetLevel ? RACK_LEVEL_HEIGHTS[palletDef.targetLevel] : null
  const rackRot = targetRack?.rotation || 0
  let inSlotRect = false
  let atTargetSlot = false

  if (targetRack && targetHeight != null) {
    inSlotRect = inRackSlot(tipX, tipZ, targetRack, world)
    atTargetSlot = inSlotRect && Math.abs(forkHeight - targetHeight) <= RACK_LEVEL_TOLERANCE
  }

  return { targetRack, targetHeight, rackRot, inSlotRect, atTargetSlot }
}
