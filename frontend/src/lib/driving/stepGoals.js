import { PARKING_ALIGN_TOLERANCE, PARKING_FORK_MAX, PARKING_MARGIN_X, PARKING_MARGIN_Z, PARKING_SPEED_EPSILON } from './constants.js'

export function stepCheckpoints(state, world) {
  const { truck, frame } = state
  const { checkpoints } = world

  const idx = state.checkpointIndex
  if (!(truck.engineOn && !frame.controlsLocked && idx < checkpoints.length)) return

  const checkpoint = checkpoints[idx]
  let satisfied

  if (checkpoint.shape === 'line') {
    const lineDz = truck.z - checkpoint.position[2]
    const lineDx = Math.abs(truck.x - checkpoint.position[0])
    satisfied = lineDz >= -0.3 && lineDz <= (checkpoint.lineDepth ?? 1.2) && lineDx <= (checkpoint.halfWidth ?? 3)
  } else {
    const dx = truck.x - checkpoint.position[0]
    const dz = truck.z - checkpoint.position[2]
    const withinRadius = Math.hypot(dx, dz) <= checkpoint.radius
    const speedOk = checkpoint.type === 'stop' ? Math.abs(truck.speed) <= (checkpoint.maxSpeed ?? 0.25) : true
    satisfied = withinRadius && speedOk
  }

  if (satisfied) {
    state.checkpointIndex = idx + 1
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
