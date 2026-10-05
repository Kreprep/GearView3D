import { checkpointReached } from './stepGoals.js'

// A mission course (docs/modules/module-improvements-plan.md, section 3.6):
// `course.tasks`, done in order. Each task is complete by the same test the
// single-goal courses use, nothing new:
//
//   start       the engine is running (through the pre-start interlock)
//   checkpoint  `ref` is a checkpoint id: reached while it is the active
//               task, as stepCheckpoints reaches one (a stop, the horn)
//   deliver     `ref` is a pallet id: that pallet is delivered to its target
//               (lib/coursePallets.js, palletTarget; stepPallet.js)
//   park        the truck is parked and secured in the bay (stepParking)
//
// Tasks complete in order. A checkpoint counts only while it is the active
// task; a task that is a state of the course (a pallet delivered, the truck
// parked, the engine on) and already holds when it becomes active completes
// at once, so doing a later job early is not undone.
//
// Raises { type: 'task', index, task, isLast } for each. The viewer passes it
// on as `mission-task`, and the last as `course-complete` too. Validation is
// lib/missionTasks.js's. Runs after stepParking, which it reads.

function taskDone(state, world, task, since) {
  switch (task.type) {
    case 'start':
      return state.truck.engineOn
    case 'checkpoint': {
      const checkpoint = world.checkpoints.find((entry) => entry.id === task.ref)
      return Boolean(checkpoint) && state.truck.engineOn && !state.frame.controlsLocked && checkpointReached(state, checkpoint, since)
    }
    case 'deliver':
      return state.pallets.some((pallet) => pallet.def.id === task.ref && pallet.state === 'delivered')
    case 'park':
      return state.parking.parked
    default:
      return false
  }
}

export function stepMission(state, world) {
  const { mission } = state
  if (!mission || state.failed) return
  const tasks = world.mission
  while (mission.index < tasks.length) {
    const task = tasks[mission.index]
    if (!taskDone(state, world, task, mission.since)) return
    const index = mission.index
    mission.index += 1
    mission.since = state.time
    state.events.push({ type: 'task', index, task, isLast: mission.index === tasks.length })
  }
}
