import { RACK_FOOTPRINT, RACK_SLOT_APPROACH_MARGIN, RACK_SLOT_HALF_WIDTH } from '../../data/rackProfile.js'
import { toRectLocal } from '../simCollision.js'
import { RACK_HIT_MARGIN } from './constants.js'

// The mouth of a rack's centre bay, as the safety rules (safetySnapshot.js)
// read it: the stack, the one place raised forks and a raised load tilted
// forward are the correct move. Pure. (Whether a pallet has been delivered to
// a shelf is read off the physics: stepPallet.js, atDestination.)

// How far past the rack's centre line the fork tip may be and still count as
// in the bay. Racking blocks the truck body, so the fork tip can only ever
// reach a little way past the rack's front face - and how far depends on the
// vehicle, since a short fork on a long body reaches less.
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
