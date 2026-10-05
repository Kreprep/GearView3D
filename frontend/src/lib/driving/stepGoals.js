import { HORN_APPROACH_DISTANCE } from '../../data/safetyThresholds.js'
import { PARKING_ALIGN_TOLERANCE, PARKING_FORK_MAX, PARKING_MARGIN_X, PARKING_MARGIN_Z, PARKING_SPEED_EPSILON } from './constants.js'

// Whether the truck is in a checkpoint's marked area: across its line, or
// inside its circle.
export function inCheckpointArea(truck, checkpoint) {
  if (checkpoint.shape === 'line') {
    const lineDz = truck.z - checkpoint.position[2]
    const lineDx = Math.abs(truck.x - checkpoint.position[0])
    return lineDz >= -0.3 && lineDz <= (checkpoint.lineDepth ?? 1.2) && lineDx <= (checkpoint.halfWidth ?? 3)
  }
  return Math.hypot(truck.x - checkpoint.position[0], truck.z - checkpoint.position[2]) <= checkpoint.radius
}

// How far from a `requireHorn` checkpoint the horn counts for it: its own
// `hornDistance`, or its radius plus the approach distance.
export function hornReach(checkpoint) {
  return typeof checkpoint.hornDistance === 'number' ? checkpoint.hornDistance : (checkpoint.radius ?? 0) + HORN_APPROACH_DISTANCE
}

// Whether the horn sounded for a checkpoint: since it became the one to
// reach (`since`, state.time), and within its reach.
export function hornSoundedFor(state, checkpoint, since) {
  const { horn } = state
  if (horn.at === null || horn.at < since) return false
  return Math.hypot(horn.x - checkpoint.position[0], horn.z - checkpoint.position[2]) <= hornReach(checkpoint)
}

// Whether the truck has reached a checkpoint, with everything it asks for:
// at a crawl for a stop, the horn for a blind crossing (`requireHorn`).
export function checkpointReached(state, checkpoint, since) {
  const { truck } = state
  if (!inCheckpointArea(truck, checkpoint)) return false
  if (checkpoint.shape !== 'line' && checkpoint.type === 'stop' && Math.abs(truck.speed) > (checkpoint.maxSpeed ?? 0.25)) return false
  return !checkpoint.requireHorn || hornSoundedFor(state, checkpoint, since)
}

// The checkpoint the truck is driving to now and since when, or null: the
// next in order, or in a mission (stepMission.js) the active task's.
export function activeCheckpoint(state, world) {
  if (state.mission) {
    const task = world.mission[state.mission.index]
    if (task?.type !== 'checkpoint') return null
    const checkpoint = world.checkpoints.find((entry) => entry.id === task.ref)
    return checkpoint ? { checkpoint, since: state.mission.since } : null
  }
  const checkpoint = world.checkpoints[state.checkpointIndex]
  return checkpoint ? { checkpoint, since: state.checkpointSince } : null
}

// The checkpoints in order. A mission course runs its checkpoints as tasks
// instead (stepMission.js).
export function stepCheckpoints(state, world) {
  const { truck, frame } = state
  const { checkpoints } = world

  const idx = state.checkpointIndex
  if (state.mission || !(truck.engineOn && !frame.controlsLocked && idx < checkpoints.length)) return

  const checkpoint = checkpoints[idx]
  if (checkpointReached(state, checkpoint, state.checkpointSince)) {
    state.checkpointIndex = idx + 1
    state.checkpointSince = state.time
    state.events.push({ type: 'checkpoint', index: idx, checkpoint, isLast: idx + 1 === checkpoints.length })
  }
}

// Secure-parking proficiency: report the first unmet requirement while the
// learner works the bay, then latch "parked" once everything is satisfied.
// The requirements follow the shutdown order TESDA CON834216 element 5.2 and
// OSHA 1910.178(m)(5)(i) describe: stopped, controls in neutral, forks
// lowered, parking brake set, engine off.
export function stepParking(state, world) {
  const { truck, forks, parking, frame } = state
  const controls = frame.controls
  const { course } = world

  if (!(course.parkingBay && !parking.parked && !state.failed)) return

  const bay = course.parkingBay
  const halfW = (bay.width ?? 1.3) / 2
  const halfD = (bay.depth ?? 1.9) / 2
  const dx = truck.x - bay.position[0]
  const dz = truck.z - bay.position[2]
  const inside = Math.abs(dx) <= halfW - PARKING_MARGIN_X && Math.abs(dz) <= halfD - PARKING_MARGIN_Z
  const headingError = Math.atan2(
    Math.sin(truck.heading - (bay.heading || 0)),
    Math.cos(truck.heading - (bay.heading || 0)),
  )
  const aligned = Math.abs(headingError) <= (bay.headingTolerance ?? PARKING_ALIGN_TOLERANCE)

  // A catalog key, not a sentence. This runs every step, and the comparison
  // below is against the previous value - a short key literal is cheaper than
  // a line of prose, and this file has no React and no catalog to translate
  // with anyway. The viewer renders it.
  let status
  let isParked = false
  if (!inside) status = 'driving.parking.enterBay'
  else if (!aligned) status = 'driving.parking.straighten'
  else if (Math.abs(truck.speed) > PARKING_SPEED_EPSILON) status = 'driving.parking.stop'
  else if (controls.direction !== 'N') status = 'driving.parking.neutral'
  else if (forks.height > PARKING_FORK_MAX) status = 'driving.parking.lowerForks'
  else if (!controls.parkingBrake) status = 'driving.parking.parkingBrake'
  else if (truck.engineOn) status = 'driving.parking.engineOff'
  else {
    status = 'driving.parking.done'
    isParked = true
    parking.parked = true
  }

  if (status !== parking.status || isParked) {
    parking.status = status
    state.events.push({ type: 'parking', status, isParked })
  }
}
