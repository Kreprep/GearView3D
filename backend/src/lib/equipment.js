import { prisma } from './prisma.js'
import { EQUIPMENT_DEFAULTS } from '../../../frontend/src/data/equipment.js'

// The id of the one Equipment row. Content tables are not scoped by it; it
// only addresses the configuration row (title, hub artwork, hub copy, driving
// overrides) that prisma/seed.js creates.
export const EQUIPMENT_ID = EQUIPMENT_DEFAULTS.id

export function findEquipment() {
  return prisma.equipment.findUnique({ where: { id: EQUIPMENT_ID } })
}
