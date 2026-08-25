// The five completion modes DrivingSimulationViewer already implements. Admin
// created courses store their goal explicitly; seeded courses are classified
// from the markers they contain, which is also the fallback when a stored
// `goalType` is missing.

import { DECOR_RACK_KINDS, RACK_FOOTPRINT } from '../data/rackProfile.js'
import { PALLET_FALLBACK_FOOTPRINT } from '../data/palletProfile.js'
import { orientedRectsOverlap } from './simCollision.js'

export const COURSE_GOAL_TYPES = ['checkpoints', 'parking', 'pallet', 'racking', 'free']

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

export function courseGoalType(course) {
  if (!course) return 'free'
  if (course.goalType && COURSE_GOAL_TYPES.includes(course.goalType)) return course.goalType
  if (course.parkingBay) return 'parking'
  if (course.racks?.length && course.pallets?.some((pallet) => pallet.targetRack)) return 'racking'
  if ((course.pallets?.length || course.pallet) && course.dropZone) return 'pallet'
  if (course.checkpoints?.length) return 'checkpoints'
  return 'free'
}

// Default learner-facing instruction for a course whose step has no bespoke
// copy - notably any step an admin adds in the course editor.
//
// `profile` is the equipment's vehicle profile (lib/vehicleProfile.js). Fork
// steps are only described when the vehicle has forks, because `hasForks:
// false` also hides the R/F keys from the HUD - telling a learner to press a
// key that is not on screen is worse than saying nothing. A pallet course on a
// forkless vehicle still completes the same way; only the wording changes.
export function courseTaskCopy(course, profile) {
  const hasForks = profile?.hasForks !== false

  switch (courseGoalType(course)) {
    case 'parking':
      return hasForks
        ? 'Drive to the marked bay, straighten up between the lines, stop completely, lower the forks with F, then switch the engine off with E.'
        : 'Drive to the marked bay, straighten up between the lines, stop completely, then switch the engine off with E.'
    case 'pallet':
      return hasForks
        ? 'Line up square with the pallet and drive the lowered forks all the way in, raise it with R, tilt the mast back with T to secure it, carry it to the drop zone, lower with F until it rests on the ground, tilt forward with G to let it off the forks, then reverse away.'
        : 'Line up with the load, lift it with R, carry it to the drop zone, lower it with F until it rests on the ground, then reverse away to release it.'
    case 'racking':
      return hasForks
        ? 'Drive the lowered forks all the way into the pallet, raise it with R above the target shelf, tilt back with T to carry it there, stop square in front of the bay, lower with F until the load rests on the shelf, then tilt forward with G to set it down.'
        : 'Lift the load with R to the target shelf height, then drive it into the rack and hold steady to set it in place.'
    case 'checkpoints': {
      const count = course.checkpoints?.length || 0
      return `Drive through ${count} checkpoint${count === 1 ? '' : 's'} in order to finish this step.`
    }
    default:
      return 'Press E to start the engine to finish this step.'
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
  const pallets = (course?.pallets || (course?.pallet ? [course.pallet] : [])).map((pallet) => ({
    x: pallet.position[0],
    z: pallet.position[2],
    rotation: pallet.rotation || 0,
    halfX: PALLET_FALLBACK_FOOTPRINT.halfWidth,
    halfZ: PALLET_FALLBACK_FOOTPRINT.halfDepth,
    label: 'a pallet',
  }))
  return [...racks, ...decorRacks, ...pallets]
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
      ...(course?.pallets || (course?.pallet ? [course.pallet] : [])).map((item) => item.position),
      ...(course?.racks || []).map((item) => item.position),
      course?.dropZone?.position,
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
    if (!course.dropZone) problems.push('A pallet course needs a drop zone.')
  }
  if (goal === 'racking') {
    const rackPallets = course.pallets || []
    const rackIds = new Set((course.racks || []).map((rack) => rack.id))
    if (!course.racks?.length) problems.push('A racking course needs at least one rack.')
    if (!rackPallets.length) problems.push('A racking course needs at least one pallet.')
    if (rackPallets.some((pallet) => !pallet.targetRack || !pallet.targetLevel)) {
      problems.push('Every pallet needs a target rack and shelf level.')
    }
    if (rackPallets.some((pallet) => pallet.targetRack && !rackIds.has(pallet.targetRack))) {
      problems.push('A pallet targets a rack that no longer exists.')
    }
  }

  const pallets = course?.pallets || (course?.pallet ? [course.pallet] : [])
  if (typeof course?.capacityKg === 'number' && pallets.length) {
    const liftable = pallets.some((pallet) => (pallet.weightKg ?? 0) <= course.capacityKg)
    if (!liftable) problems.push('Every pallet is over the rated capacity - the course cannot be completed.')
  }

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
