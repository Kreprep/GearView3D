// The four completion modes DrivingSimulationViewer already implements. Admin
// created courses store their goal explicitly; seeded courses are classified
// from the markers they contain, which is also the fallback when a stored
// `goalType` is missing.

export const COURSE_GOAL_TYPES = ['checkpoints', 'parking', 'pallet', 'free']

export function courseGoalType(course) {
  if (!course) return 'free'
  if (course.goalType && COURSE_GOAL_TYPES.includes(course.goalType)) return course.goalType
  if (course.parkingBay) return 'parking'
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
        ? 'Slide the lowered forks under the pallet, raise it with R, carry it to the drop zone, lower with F, then reverse away to release it.'
        : 'Line up with the load, lift it with R, carry it to the drop zone, lower it with F, then reverse away to release it.'
    case 'checkpoints': {
      const count = course.checkpoints?.length || 0
      return `Drive through ${count} checkpoint${count === 1 ? '' : 's'} in order to finish this step.`
    }
    default:
      return 'Press E to start the engine to finish this step.'
  }
}

// A course an admin can save must be winnable: every goal type needs the
// markers its completion check reads. Returns an array of problem strings.
export function validateCourse(course) {
  const problems = []
  const goal = courseGoalType(course)

  if (!course?.start?.position) problems.push('Course needs a start position.')

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

  const pallets = course?.pallets || (course?.pallet ? [course.pallet] : [])
  if (typeof course?.capacityKg === 'number' && pallets.length) {
    const liftable = pallets.some((pallet) => (pallet.weightKg ?? 0) <= course.capacityKg)
    if (!liftable) problems.push('Every pallet is over the rated capacity - the course cannot be completed.')
  }

  return problems
}
