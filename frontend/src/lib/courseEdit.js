// Pure helpers behind the admin course editor. The stored course geometry is a
// handful of separate lists (checkpoints, decorations, pallets) plus three
// singletons (start, dropZone, parkingBay); the canvas needs one flat list of
// selectable items, so items are addressed by a `key` of the form
// "<list>:<index>" or the singleton's own name.

import { DECOR_RACK_KINDS, DECOR_RACK_LABELS } from '../data/rackProfile.js'

const SINGLETON_KEYS = ['start', 'dropZone', 'parkingBay']

export const OBJECT_LABELS = {
  start: 'Start',
  checkpoint: 'Checkpoint',
  cone: 'Cone',
  wall: 'Wall',
  vehicle: 'Parked vehicle',
  pallet: 'Pallet',
  rack: 'Pallet rack',
  dropZone: 'Drop zone',
  parkingBay: 'Parking bay',
  ...DECOR_RACK_LABELS,
}

// Kinds an admin can drop onto the canvas. Singletons are filtered out of the
// palette once the course already has one.
export const PLACEABLE_KINDS = [
  'cone',
  'wall',
  'vehicle',
  'checkpoint',
  'pallet',
  'rack',
  ...DECOR_RACK_KINDS,
  'dropZone',
  'parkingBay',
]

// The parked-obstacle kind was called 'forklift' until migration
// 20260814110000 renamed it 'vehicle'. Read stored decorations through this
// so a row the migration missed still renders and still collides.
export function decorationType(item) {
  return item?.type === 'forklift' ? 'vehicle' : item?.type
}

function parseKey(key) {
  if (SINGLETON_KEYS.includes(key)) return { list: null, name: key, index: -1 }
  const [list, index] = key.split(':')
  return { list, name: null, index: Number(index) }
}

function positionOf(entry) {
  return { x: entry.position?.[0] ?? 0, z: entry.position?.[2] ?? 0 }
}

export function listCourseItems(data) {
  const items = []

  if (data.start) {
    items.push({ key: 'start', kind: 'start', entry: data.start, ...positionOf(data.start) })
  }

  for (const [index, entry] of (data.checkpoints || []).entries()) {
    items.push({ key: `checkpoints:${index}`, kind: 'checkpoint', entry, ...positionOf(entry) })
  }

  for (const [index, entry] of (data.decorations || []).entries()) {
    items.push({ key: `decorations:${index}`, kind: decorationType(entry), entry, ...positionOf(entry) })
  }

  for (const [index, entry] of (data.pallets || []).entries()) {
    items.push({ key: `pallets:${index}`, kind: 'pallet', entry, ...positionOf(entry) })
  }

  for (const [index, entry] of (data.racks || []).entries()) {
    items.push({ key: `racks:${index}`, kind: 'rack', entry, ...positionOf(entry) })
  }

  if (data.dropZone) {
    items.push({ key: 'dropZone', kind: 'dropZone', entry: data.dropZone, ...positionOf(data.dropZone) })
  }
  if (data.parkingBay) {
    items.push({ key: 'parkingBay', kind: 'parkingBay', entry: data.parkingBay, ...positionOf(data.parkingBay) })
  }

  return items
}

export function getItem(data, key) {
  if (!key) return null
  return listCourseItems(data).find((item) => item.key === key) || null
}

export function updateItem(data, key, patch) {
  const { list, name, index } = parseKey(key)

  if (name) {
    return { ...data, [name]: { ...data[name], ...patch } }
  }

  return {
    ...data,
    [list]: data[list].map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
  }
}

export function moveItem(data, key, x, z) {
  const item = getItem(data, key)
  if (!item) return data
  return updateItem(data, key, { position: [x, item.entry.position?.[1] ?? 0, z] })
}

// A pallet's targetRack/targetLevel point at a rack by id, not by list index
// (ids survive reordering, indices don't), so deleting a rack has to clear
// any pallet still pointing at it or the reference would silently dangle.
function clearPalletsTargeting(data, removedIds) {
  if (!removedIds.size || !data.pallets?.length) return data
  return {
    ...data,
    pallets: data.pallets.map((pallet) =>
      pallet.targetRack && removedIds.has(pallet.targetRack)
        ? { ...pallet, targetRack: undefined, targetLevel: undefined }
        : pallet,
    ),
  }
}

export function removeItem(data, key) {
  const { list, name, index } = parseKey(key)

  // The start marker is where the forklift spawns - a course without one has
  // nowhere to begin, so it can be moved but not deleted.
  if (name === 'start') return data
  if (name) return { ...data, [name]: null }

  if (list === 'racks') {
    const removedId = data.racks[index]?.id
    const next = { ...data, racks: data.racks.filter((_, i) => i !== index) }
    return removedId ? clearPalletsTargeting(next, new Set([removedId])) : next
  }

  return { ...data, [list]: data[list].filter((_, i) => i !== index) }
}

// Removes several items at once. Indices are resolved against the original
// lists first so earlier deletions cannot shift later ones.
export function removeItems(data, keys) {
  const byList = { checkpoints: new Set(), decorations: new Set(), pallets: new Set(), racks: new Set() }
  let next = data

  for (const key of keys) {
    const { list, name, index } = parseKey(key)
    if (name === 'start') continue
    if (name) next = { ...next, [name]: null }
    else byList[list]?.add(index)
  }

  const removedRackIds = new Set(
    [...byList.racks].map((index) => data.racks[index]?.id).filter(Boolean),
  )

  for (const [list, indices] of Object.entries(byList)) {
    if (!indices.size) continue
    next = { ...next, [list]: next[list].filter((_, i) => !indices.has(i)) }
  }

  return clearPalletsTargeting(next, removedRackIds)
}

function nextId(entries, prefix) {
  let n = entries.length + 1
  const taken = new Set(entries.map((entry) => entry.id))
  while (taken.has(`${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}

export function addItem(data, kind, x, z) {
  const position = [x, 0, z]

  switch (kind) {
    case 'cone':
      return { ...data, decorations: [...data.decorations, { type: 'cone', position }] }
    case 'wall':
      return { ...data, decorations: [...data.decorations, { type: 'wall', position, rotation: 0, length: 3 }] }
    case 'vehicle':
      return { ...data, decorations: [...data.decorations, { type: 'vehicle', position, rotation: 0 }] }
    case 'checkpoint': {
      const id = nextId(data.checkpoints, 'checkpoint')
      const label = `Checkpoint ${data.checkpoints.length + 1}`
      return {
        ...data,
        checkpoints: [
          ...data.checkpoints,
          { id, type: 'pass', position, radius: 0.9, label, completeMessage: `${label} clear.` },
        ],
      }
    }
    case 'pallet': {
      const id = nextId(data.pallets, 'pallet')
      return { ...data, pallets: [...data.pallets, { id, position, rotation: 0, weightKg: 500 }] }
    }
    case 'rack': {
      const id = nextId(data.racks || [], 'rack')
      return { ...data, racks: [...(data.racks || []), { id, position, rotation: 0 }] }
    }
    case 'rack-empty':
    case 'rack-loaded':
    case 'rack-spare':
      return { ...data, decorations: [...data.decorations, { type: kind, position, rotation: 0 }] }
    case 'dropZone':
      return { ...data, dropZone: { position, radius: 0.9, label: 'Drop Zone' } }
    case 'parkingBay':
      return { ...data, parkingBay: { position, width: 0.45, depth: 1, heading: 0, label: 'Parking Bay' } }
    default:
      return data
  }
}

export function appendDecorations(data, decorations) {
  return { ...data, decorations: [...data.decorations, ...decorations] }
}

// World-space bounding box of everything in the course, padded, with a floor so
// an empty course still gets a usable canvas. `driveBounds` (resolveCourseBounds()
// from lib/courseGoals) is folded in too, so the driveable-area rectangle stays
// on screen even when no object has been placed near its edges yet.
export function courseBounds(data, padding = 3, driveBounds = null) {
  const items = listCourseItems(data)
  let minX = -4
  let maxX = 4
  let minZ = -2
  let maxZ = 12

  for (const item of items) {
    minX = Math.min(minX, item.x)
    maxX = Math.max(maxX, item.x)
    minZ = Math.min(minZ, item.z)
    maxZ = Math.max(maxZ, item.z)
  }

  if (driveBounds) {
    minX = Math.min(minX, -driveBounds.halfWidth)
    maxX = Math.max(maxX, driveBounds.halfWidth)
    minZ = Math.min(minZ, driveBounds.minZ)
    maxZ = Math.max(maxZ, driveBounds.maxZ)
  }

  return {
    minX: Math.floor(minX - padding),
    maxX: Math.ceil(maxX + padding),
    minZ: Math.floor(minZ - padding),
    maxZ: Math.ceil(maxZ + padding),
  }
}

export function snapTo(value, step) {
  if (!step) return Math.round(value * 1000) / 1000
  return Math.round(value / step) * step
}
