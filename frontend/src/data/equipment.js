// The one piece of equipment GearView3D trains on.
//
// Imported by backend/prisma/seed.js and backend/src/lib/equipment.js, so this
// file keeps explicit .js imports and touches no browser globals.

// Seeds the single Equipment row (create-if-missing). Admins can edit the title
// and image afterwards in Equipment Settings, so pages read the row, not this.
export const EQUIPMENT_DEFAULTS = {
  id: 'forklift',
  title: 'Forklift',
  imageUrl: '/images/forklift-card.png',
}

// The 3D model every viewer loads. This is code, not content: every hotspot
// position, the vehicle rig's node names (DEFAULT_RIG in vehicleProfile.js),
// the collision footprint and the first-person seat are measured against this
// exact file at its authored origin and scale, so swapping it means
// re-measuring all of them.
export const EQUIPMENT_MODEL_URL = '/models/forklift.glb'
