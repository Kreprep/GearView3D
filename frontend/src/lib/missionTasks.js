// A mission course's tasks (docs/modules/module-improvements-plan.md,
// section 3.6): what each kind is, and what makes a list of them one a
// learner can finish. lib/driving/stepMission.js runs them.
//
//   { id, type, ref, label }
//   type  'start' (no ref) | 'checkpoint' (ref: a checkpoint id) |
//         'deliver' (ref: a pallet id; where to is the pallet's own target)
//         | 'park' (no ref; the course's parking bay)
//
// A stop or a blind crossing is a checkpoint task on a checkpoint of
// `type: 'stop'` or with `requireHorn`; storing a load on a rack and taking
// one off a shelf are deliver tasks on a pallet whose target is a rack, or
// that starts on a shelf (lib/coursePallets.js).
//
// Pure and backend-safe: validateCourse() (lib/courseGoals.js) calls
// missionProblems(), and the backend imports that file.
import { seatedLoadCentreM } from '../data/physicsProfile.js'
import { courseDropZones, coursePallets, palletTarget } from './coursePallets.js'
import { deratedCapacityKg } from './physics/loadChart.js'

export const MISSION_TASK_TYPES = ['start', 'checkpoint', 'deliver', 'park']

// The Course Editor's names for them (English admin chrome).
export const MISSION_TASK_LABELS = {
  start: 'Start the truck',
  checkpoint: 'Reach a checkpoint',
  deliver: 'Deliver a pallet',
  park: 'Park and secure',
}

// Problems with a mission's tasks, as sentences for the Course Editor and the
// publish check. `capacityKg` is the course's resolved capacity plate.
export function missionProblems(course, capacityKg) {
  const tasks = course?.tasks
  if (!Array.isArray(tasks) || !tasks.length) return ['A mission needs at least one task.']

  const problems = []
  const add = (problem) => {
    if (!problems.includes(problem)) problems.push(problem)
  }
  const checkpointIds = new Set((course.checkpoints || []).map((checkpoint) => checkpoint.id))
  const pallets = coursePallets(course)
  const zoneIds = new Set(courseDropZones(course).map((zone) => zone.id))
  const rackIds = new Set((course.racks || []).map((rack) => rack.id))
  const seen = new Set()
  const delivered = new Set()

  tasks.forEach((task, index) => {
    if (!task?.id) add('Every task needs an id.')
    else if (seen.has(task.id)) add(`Two tasks share the id "${task.id}".`)
    else seen.add(task.id)

    if (!task?.label?.trim()) add('Every task needs a label: it is what the learner reads.')
    if (!MISSION_TASK_TYPES.includes(task?.type)) {
      add(`Task ${index + 1} has an unknown type.`)
      return
    }
    if (task.type === 'start' && index !== 0) add('"Start the truck" can only be the first task.')
    if (task.type === 'park') {
      if (index !== tasks.length - 1) add('"Park and secure" can only be the last task: the engine is off once parked.')
      if (!course.parkingBay) add('A park task needs a parking bay on the course.')
    }
    if (task.type === 'checkpoint' && !checkpointIds.has(task.ref)) add(`Task ${index + 1} names a checkpoint that does not exist.`)
    if (task.type === 'deliver') {
      const pallet = pallets.find((entry) => entry.id === task.ref)
      if (!pallet) {
        add(`Task ${index + 1} names a pallet that does not exist.`)
        return
      }
      if (delivered.has(pallet.id)) add(`Pallet "${pallet.id}" is delivered by two tasks.`)
      delivered.add(pallet.id)
      const target = palletTarget(pallet)
      const reachable = target?.rack ? rackIds.has(target.rack) : target?.zone ? zoneIds.has(target.zone) : zoneIds.size > 0
      if (!reachable) add(`Pallet "${pallet.id}" has nowhere to be delivered to.`)
      const liftableKg = deratedCapacityKg(capacityKg, seatedLoadCentreM(pallet))
      if (typeof pallet.weightKg === 'number' && pallet.weightKg > liftableKg) {
        add(`Pallet "${pallet.id}" is over the capacity for its load centre: a task cannot ask for it.`)
      }
    }
  })

  return problems
}
