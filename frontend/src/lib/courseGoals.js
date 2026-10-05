// The completion modes DrivingSimulationViewer implements: checkpoints in
// order, parking, a pallet to a drop zone, a pallet to a rack shelf, a
// mission (several of those as tasks in order, lib/missionTasks.js) and free
// practice. Admin created courses store their goal explicitly; seeded courses
// are classified from the markers they contain, which is also the fallback
// when a stored `goalType` is missing.

import { DECOR_RACK_KINDS, RACK_FOOTPRINT } from '../data/rackProfile.js'
import { PALLET_FALLBACK_FOOTPRINT } from '../data/palletProfile.js'
import { STABILITY_DEFAULTS } from '../data/vehicleProfile.js'
import { alertProblems } from './courseAlerts.js'
import { courseDropZones, coursePallets, palletStartShelf, palletTarget } from './coursePallets.js'
import { missionProblems } from './missionTasks.js'
import { orientedRectsOverlap } from './simCollision.js'

export const COURSE_GOAL_TYPES = ['checkpoints', 'parking', 'pallet', 'racking', 'mission', 'free']

// The driveable box every course used to share as a hardcoded constant in
// DrivingSimulationViewer.jsx. `course.bounds` now overrides it per course;
// an admin who never touches the field gets exactly the old fixed size.
export const DEFAULT_COURSE_BOUNDS = { halfWidth: 6, minZ: -3, maxZ: 44 }

export function resolveCourseBounds(course) {
  const bounds = course?.bounds || {}
  return {
    halfWidth: typeof bounds.halfWidth === 'number' ? bounds.halfWidth : DEFAULT_COURSE_BOUNDS.halfWidth,
    minZ: typeof bounds.minZ === 'number' ? bounds.minZ : DEFAULT_COURSE_BOUNDS.minZ,
    maxZ: typeof bounds.maxZ === 'number' ? bounds.maxZ : DEFAULT_COURSE_BOUNDS.maxZ,
  }
}

// The truck's rated capacity for a course: its own capacity plate, or the
// reference truck's when the course sets none. The overload rule, the load
// chart and the stability model all read this.
export function resolveCapacityKg(course) {
  return typeof course?.capacityKg === 'number' && course.capacityKg > 0 ? course.capacityKg : STABILITY_DEFAULTS.ratedCapacityKg
}

// The load-handling fails a course has switched on: { overload, highTravel,
// loadDrop }. Collisions, a pallet struck at speed and a tip-over always
// fail, whatever a course stores.
//
// A tolerant reader, like decorationType() in courseEdit.js: before Phase 7 a
// load was lost by one of three scripted rules (suddenStop, sharpTurn,
// unsecuredTravel), each with its own switch. Physics made them one thing, a
// load that leaves the forks, so any of the three reads as `loadDrop`.
// `loadTipping` is gone: a tip-over is physics and cannot be switched off.
// The Course Editor writes only the three keys returned here.
export function resolveFailConditions(course) {
  const stored = course?.failConditions || {}
  const legacyLoadDrop = Boolean(stored.suddenStop || stored.sharpTurn || stored.unsecuredTravel)
  return {
    overload: Boolean(stored.overload),
    highTravel: Boolean(stored.highTravel),
    loadDrop: typeof stored.loadDrop === 'boolean' ? stored.loadDrop : legacyLoadDrop,
  }
}

export function courseGoalType(course) {
  if (!course) return 'free'
  if (course.goalType && COURSE_GOAL_TYPES.includes(course.goalType)) return course.goalType
  // A mission names its tasks, and may have a bay, pallets and checkpoints
  // too, so it is recognised first.
  if (course.tasks?.length) return 'mission'
  if (course.parkingBay) return 'parking'
  if (course.racks?.length && course.pallets?.some((pallet) => palletTarget(pallet)?.rack)) return 'racking'
  if ((course.pallets?.length || course.pallet) && courseDropZones(course).length) return 'pallet'
  if (course.checkpoints?.length) return 'checkpoints'
  return 'free'
}

// Default learner-facing instruction for a course whose step has no bespoke
// copy - notably any step an admin adds in the course editor.
//
// Returns the catalog key for this course's task copy plus the values it
// needs, rather than the sentence itself: this file is imported by
// backend/src/lib/courses.js (for validateCourse), so it must not pull the i18n
// catalog into the Node process. The caller translates.
export function courseTaskKey(course) {
  switch (courseGoalType(course)) {
    case 'parking':
      return { key: 'driving.task.parking' }
    case 'pallet':
      return { key: 'driving.task.pallet' }
    case 'racking':
      return { key: 'driving.task.racking' }
    case 'checkpoints':
      return {
        key: 'driving.task.checkpoints',
        values: { count: course.checkpoints?.length || 0 },
      }
    case 'mission':
      return { key: 'driving.task.mission', values: { count: course.tasks?.length || 0 } }
    default:
      return { key: 'driving.task.free' }
  }
}

// Racking and pallets are solid (see rackProfile.js / DrivingSimulationViewer),
// so a course that starts the vehicle inside one, or stacks two racks on the
// same spot, is unplayable. The vehicle's own footprint is not known here -
// this file also runs in the backend, with no equipment row to hand - so the
// start check uses the forklift default, rounded up: the truck's chassis is
// 0.29 half-long, and the extra covers the mast and forks reaching ahead of
// it, which an authored start position should also keep clear of a rack.
const START_FOOTPRINT = { halfX: 0.15, halfZ: 0.45 }

function solidRects(course) {
  const racks = (course?.racks || []).map((rack) => ({
    x: rack.position[0],
    z: rack.position[2],
    rotation: rack.rotation || 0,
    halfX: RACK_FOOTPRINT.halfWidth,
    halfZ: RACK_FOOTPRINT.halfDepth,
    label: 'racking',
  }))
  const decorRacks = (course?.decorations || [])
    .filter((item) => DECOR_RACK_KINDS.includes(item.type))
    .map((item) => ({
      x: item.position[0],
      z: item.position[2],
      rotation: item.rotation || 0,
      halfX: RACK_FOOTPRINT.halfWidth,
      halfZ: RACK_FOOTPRINT.halfDepth,
      label: 'racking',
    }))
  // A pallet that starts on a shelf is inside its rack, where it belongs.
  const pallets = coursePallets(course).filter((pallet) => !palletStartShelf(pallet)).map((pallet) => ({
    x: pallet.position[0],
    z: pallet.position[2],
    rotation: pallet.rotation || 0,
    halfX: PALLET_FALLBACK_FOOTPRINT.halfWidth,
    halfZ: PALLET_FALLBACK_FOOTPRINT.halfDepth,
    label: 'a pallet',
  }))
  return [...racks, ...decorRacks, ...pallets]
}

// What a course's pallets and drop zones point at has to exist: the rack a
// pallet starts on or goes to, the drop zone it goes to.
function palletProblems(course) {
  const problems = []
  const add = (problem) => {
    if (!problems.includes(problem)) problems.push(problem)
  }
  const pallets = course?.pallets || (course?.pallet ? [course.pallet] : [])
  const rackIds = new Set((course?.racks || []).map((rack) => rack.id))
  const zones = courseDropZones(course)
  const zoneIds = new Set(zones.map((zone) => zone.id))
  const shelves = new Set()

  if (zoneIds.size < zones.length) add('Every drop zone needs its own id.')
  if (zones.some((zone) => !(zone.radius > 0))) add('A drop zone needs a radius above zero.')
  for (const pallet of pallets) {
    const target = palletTarget(pallet)
    if (target?.rack && !rackIds.has(target.rack)) add('A pallet targets a rack that no longer exists.')
    if (target?.zone && !zoneIds.has(target.zone)) add('A pallet targets a drop zone that no longer exists.')
    if (pallet.loadOffsetM != null && !Number.isFinite(pallet.loadOffsetM)) add("A pallet's load offset must be a number of metres.")
    const shelf = palletStartShelf(pallet)
    if (!shelf) continue
    if (!rackIds.has(shelf.rack)) add('A pallet starts on a rack that no longer exists.')
    const key = `${shelf.rack}:${shelf.level}`
    if (shelves.has(key)) add('Two pallets start on the same shelf.')
    shelves.add(key)
    if (target?.rack === shelf.rack && target.level === shelf.level) add('A pallet starts on the shelf it is meant to be delivered to.')
  }
  return problems
}

// A course an admin can save must be winnable: every goal type needs the
// markers its completion check reads. Returns an array of problem strings.
export function validateCourse(course) {
  const problems = []
  const goal = courseGoalType(course)
  const bounds = resolveCourseBounds(course)
  const boundsSane = bounds.halfWidth > 0 && bounds.maxZ > bounds.minZ

  if (!course?.start?.position) problems.push('Course needs a start position.')

  if (course?.bounds && !boundsSane) {
    problems.push('Course size must have a positive width, and the forward limit must exceed the back limit.')
  }

  // Every placed object has to sit inside the box the vehicle is actually
  // clamped to, or it is permanently unreachable - most easily hit by
  // shrinking the size after objects were already placed.
  if (boundsSane) {
    const positions = [
      course?.start?.position,
      ...(course?.checkpoints || []).map((item) => item.position),
      ...(course?.decorations || []).map((item) => item.position),
      ...(course?.obstacles || []).map((item) => item.position),
      ...coursePallets(course).map((item) => item.position),
      ...(course?.racks || []).map((item) => item.position),
      ...courseDropZones(course).map((item) => item.position),
      course?.parkingBay?.position,
    ].filter(Boolean)

    const outOfBounds = positions.some(
      ([x, , z]) => x < -bounds.halfWidth || x > bounds.halfWidth || z < bounds.minZ || z > bounds.maxZ,
    )
    if (outOfBounds) problems.push('One or more objects are placed outside the course boundary.')
  }

  const solids = solidRects(course)
  if (course?.start?.position) {
    const startRect = {
      x: course.start.position[0],
      z: course.start.position[2],
      rotation: course.start.heading || 0,
      ...START_FOOTPRINT,
    }
    const blockingStart = solids.find((solid) => orientedRectsOverlap(startRect, solid))
    if (blockingStart) problems.push(`The start position sits inside ${blockingStart.label} - the vehicle cannot spawn there.`)
  }
  for (let i = 0; i < solids.length; i += 1) {
    for (let j = i + 1; j < solids.length; j += 1) {
      if (orientedRectsOverlap(solids[i], solids[j])) {
        problems.push('Two solid objects overlap - racking and pallets block the vehicle, so they cannot share a spot.')
        i = solids.length
        break
      }
    }
  }

  if (goal === 'checkpoints' && !course.checkpoints?.length) {
    problems.push('A checkpoint run needs at least one checkpoint.')
  }
  if (goal === 'parking' && !course.parkingBay) {
    problems.push('A parking course needs a parking bay.')
  }
  if (goal === 'pallet') {
    if (!course.pallets?.length && !course.pallet) problems.push('A pallet course needs at least one pallet.')
    if (!courseDropZones(course).length) problems.push('A pallet course needs a drop zone.')
  }
  if (goal === 'racking') {
    const rackPallets = course.pallets || []
    if (!course.racks?.length) problems.push('A racking course needs at least one rack.')
    if (!rackPallets.length) problems.push('A racking course needs at least one pallet.')
    if (rackPallets.some((pallet) => !palletTarget(pallet)?.rack)) {
      problems.push('Every pallet needs a target rack and shelf level.')
    }
  }
  if (goal === 'mission') problems.push(...missionProblems(course, resolveCapacityKg(course)))

  problems.push(...palletProblems(course))

  const pallets = course?.pallets || (course?.pallet ? [course.pallet] : [])
  if (typeof course?.capacityKg === 'number' && pallets.length) {
    const liftable = pallets.some((pallet) => (pallet.weightKg ?? 0) <= course.capacityKg)
    if (!liftable) problems.push('Every pallet is over the rated capacity - the course cannot be completed.')
  }

  problems.push(...alertProblems(course))

  if (goal === 'free') {
    if (!course?.completionCode) {
      problems.push('A free-practice course needs custom completion code.')
    } else {
      try {
        // The Function constructor compiles the body without running it, so
        // this is safe even though this file also runs inside the backend
        // process (backend/src/lib/courses.js imports it directly to validate
        // on publish). The result must never be called outside the
        // learner-side sandboxed Worker - see frontend/src/lib/customCompletion.js.
        new Function('context', course.completionCode)
      } catch (err) {
        problems.push(`Custom completion code has a syntax error: ${err.message}`)
      }
    }
  }

  return problems
}

// The stock completion code of a built-in free-practice course, laid into a
// stored course that has no value for it at all: what prisma/seed.js
// backfills into a row seeded before completion code existed, which
// otherwise has no completion rule and can never be finished. A value the row
// has always wins, a blanked one included. Returns `data` itself when there
// is nothing to add.
export function withMissingCompletionCode(data, defaults) {
  if (!data || !defaults?.completionCode || 'completionCode' in data) return data
  return { ...data, completionCode: defaults.completionCode }
}
