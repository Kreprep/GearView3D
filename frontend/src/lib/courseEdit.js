// Pure helpers behind the admin course editor. The stored course geometry is a
// handful of separate lists (checkpoints, decorations, pallets, racks,
// dropZones) plus three singletons (start, the older single dropZone,
// parkingBay); the canvas needs one flat list of selectable items, so items
// are addressed by a `key` of the form "<list>:<index>" or the singleton's own
// name. A mission's task list (`tasks`) has its own helpers at the end.

import { DECOR_RACK_KINDS, DECOR_RACK_LABELS } from '../data/rackProfile.js'
import { DEFAULT_DROP_ZONE_ID } from './coursePallets.js'
import { MISSION_TASK_LABELS } from './missionTasks.js'

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

// Kinds an admin can drop onto the canvas. The parking bay is filtered out of
// the palette once the course already has one; drop zones are a list.
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

  for (const [index, entry] of (data.dropZones || []).entries()) {
    items.push({ key: `dropZones:${index}`, kind: 'dropZone', entry, ...positionOf(entry) })
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

// A pallet's target (and the older targetRack/targetLevel) and its start
// shelf point at a rack or a drop zone by id, not by list index (ids survive
// reordering, indices don't), so deleting one has to clear every pallet still
// pointing at it or the reference would silently dangle. A pallet whose target
// goes is delivered to any drop zone, as one with no target always was.
function clearPalletTargets(data, { racks, zones }) {
  if ((!racks.size && !zones.size) || !data.pallets?.length) return data
  return {
    ...data,
    pallets: data.pallets.map((pallet) => {
      let next = pallet
      if (racks.has(pallet.targetRack)) next = { ...next, targetRack: undefined, targetLevel: undefined }
      if (racks.has(pallet.target?.rack) || zones.has(pallet.target?.zone)) next = { ...next, target: undefined }
      if (racks.has(pallet.startShelf?.rack)) next = { ...next, startShelf: undefined }
      return next
    }),
  }
}

// The rack and drop zone ids the items at `keys` take with them.
function removedIds(data, keys) {
  const racks = new Set()
  const zones = new Set()
  for (const key of keys) {
    const { list, name, index } = parseKey(key)
    if (list === 'racks' && data.racks?.[index]?.id) racks.add(data.racks[index].id)
    if (list === 'dropZones' && data.dropZones?.[index]?.id) zones.add(data.dropZones[index].id)
    if (name === 'dropZone' && data.dropZone) zones.add(data.dropZone.id ?? DEFAULT_DROP_ZONE_ID)
  }
  return { racks, zones }
}

export function removeItem(data, key) {
  return removeItems(data, [key])
}

// Removes several items at once. Indices are resolved against the original
// lists first so earlier deletions cannot shift later ones.
export function removeItems(data, keys) {
  const byList = { checkpoints: new Set(), decorations: new Set(), pallets: new Set(), racks: new Set(), dropZones: new Set() }
  let next = data

  for (const key of keys) {
    const { list, name, index } = parseKey(key)
    // The start marker is where the forklift spawns - a course without one
    // has nowhere to begin, so it can be moved but not deleted.
    if (name === 'start') continue
    if (name) next = { ...next, [name]: null }
    else byList[list]?.add(index)
  }

  for (const [list, indices] of Object.entries(byList)) {
    if (!indices.size) continue
    next = { ...next, [list]: next[list].filter((_, i) => !indices.has(i)) }
  }

  return clearPalletTargets(next, removedIds(data, keys))
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
    case 'dropZone': {
      // A zone a pallet's target can name. The older single `dropZone` is
      // counted, so the first new zone beside it is not a second "Drop Zone 1".
      const zones = data.dropZones || []
      const taken = data.dropZone ? [...zones, { id: data.dropZone.id ?? DEFAULT_DROP_ZONE_ID }] : zones
      const id = nextId(taken, 'zone')
      return { ...data, dropZones: [...zones, { id, position, radius: 0.9, label: `Drop Zone ${taken.length + 1}` }] }
    }
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

// --- A mission's tasks -------------------------------------------------------
//
// `data.tasks` (lib/missionTasks.js): what the Course Editor's Tasks panel
// does to the list. Each returns new course data; an index out of range
// leaves it as it was.

const TASKS_WITHOUT_REF = ['start', 'park']

export function addTask(data, type) {
  const tasks = data.tasks || []
  const task = { id: nextId(tasks, type), type, ...(TASKS_WITHOUT_REF.includes(type) ? {} : { ref: '' }), label: MISSION_TASK_LABELS[type] || '' }
  return { ...data, tasks: [...tasks, task] }
}

export function updateTask(data, index, patch) {
  const tasks = data.tasks || []
  if (!tasks[index]) return data
  return { ...data, tasks: tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)) }
}

export function moveTask(data, index, delta) {
  const tasks = [...(data.tasks || [])]
  const target = index + delta
  if (!tasks[index] || target < 0 || target >= tasks.length) return data
  const [task] = tasks.splice(index, 1)
  tasks.splice(target, 0, task)
  return { ...data, tasks }
}

export function removeTask(data, index) {
  const tasks = data.tasks || []
  if (!tasks[index]) return data
  return { ...data, tasks: tasks.filter((_, i) => i !== index) }
}

// The map key of the object a task names, to select it on the canvas, or
// null (a start task, or a ref that no longer resolves).
export function taskItemKey(data, task) {
  if (task?.type === 'park') return data.parkingBay ? 'parkingBay' : null
  const list = task?.type === 'checkpoint' ? 'checkpoints' : task?.type === 'deliver' ? 'pallets' : null
  if (!list) return null
  const index = (data[list] || []).findIndex((entry) => entry.id === task.ref)
  return index === -1 ? null : `${list}:${index}`
}
