import { PARKING_ALIGN_TOLERANCE, PARKING_FORK_MAX, PARKING_MARGIN_X, PARKING_MARGIN_Z, PARKING_SPEED_EPSILON } from './constants'

export function stepCheckpoints(ctx) {
  const { checkpointIndexRef, engineOnRef, checkpoints, posRef, speedRef, onAdvanceCheckpoint, frame } = ctx
  const { controlsLocked } = frame

  const idx = checkpointIndexRef.current
  if (!(engineOnRef.current && !controlsLocked && idx < checkpoints.length)) return

  const checkpoint = checkpoints[idx]
  let satisfied

  if (checkpoint.shape === 'line') {
    const lineDz = posRef.current.z - checkpoint.position[2]
    const lineDx = Math.abs(posRef.current.x - checkpoint.position[0])
    satisfied = lineDz >= -0.3 && lineDz <= (checkpoint.lineDepth ?? 1.2) && lineDx <= (checkpoint.halfWidth ?? 3)
  } else {
    const dx = posRef.current.x - checkpoint.position[0]
    const dz = posRef.current.z - checkpoint.position[2]
    const withinRadius = Math.hypot(dx, dz) <= checkpoint.radius
    const speedOk = checkpoint.type === 'stop' ? Math.abs(speedRef.current) <= (checkpoint.maxSpeed ?? 0.25) : true
    satisfied = withinRadius && speedOk
  }

  if (satisfied) {
    onAdvanceCheckpoint(idx, checkpoint, idx + 1 === checkpoints.length)
  }
}

// Secure-parking proficiency: report the first unmet requirement while the
// learner works the bay, then latch "parked" once everything is satisfied.
export function stepParking(ctx) {
  const {
    course, parkedRef, failedRef, posRef, headingRef, speedRef, forkHeightRef, engineOnRef,
    parkingStatusRef, onParkingUpdateRef,
  } = ctx

  if (!(course.parkingBay && !parkedRef.current && !failedRef.current)) return

  const bay = course.parkingBay
  const halfW = (bay.width ?? 1.3) / 2
  const halfD = (bay.depth ?? 1.9) / 2
  const dx = posRef.current.x - bay.position[0]
  const dz = posRef.current.z - bay.position[2]
  const inside = Math.abs(dx) <= halfW - PARKING_MARGIN_X && Math.abs(dz) <= halfD - PARKING_MARGIN_Z
  const headingError = Math.atan2(
    Math.sin(headingRef.current - (bay.heading || 0)),
    Math.cos(headingRef.current - (bay.heading || 0)),
  )
  const aligned = Math.abs(headingError) <= (bay.headingTolerance ?? PARKING_ALIGN_TOLERANCE)

  let status
  let isParked = false
  if (!inside) status = 'Drive into the bay'
  else if (!aligned) status = 'Straighten up between the lines'
  else if (Math.abs(speedRef.current) > PARKING_SPEED_EPSILON) status = 'Come to a complete stop'
  else if (forkHeightRef.current > PARKING_FORK_MAX) status = 'Lower the forks (F)'
  else if (engineOnRef.current) status = 'Switch the engine off (E)'
  else {
    status = 'Parked - well done'
    isParked = true
    parkedRef.current = true
  }

  if (status !== parkingStatusRef.current || isParked) {
    parkingStatusRef.current = status
    onParkingUpdateRef.current?.(status, isParked)
  }
}
