// How well the forks are lined up with, and seated in, a pallet: the reading
// behind the dashboard's grip lamp and the forks-not-inserted safety rule.
// Pure functions over plain numbers - no three.js, no refs, no frame state.
//
// This is a reading, not a rule. What a load does on the forks is decided by
// the physics (lib/physics/): a short bite holds less of the pallet over the
// tines, so friction and inertia take it off under braking. Before Phase 7
// this file also held the kinematic slip model that stood in for that.

import {
  FORK_INSERT_MIN_RATIO,
  FORK_INSERT_SECURE_RATIO,
  FORK_LATERAL_MAX_RATIO,
  FORK_LATERAL_SECURE_RATIO,
  FORK_YAW_MAX,
  FORK_YAW_SECURE,
} from '../data/palletProfile.js'

// A four-way pallet takes forks on any face, so only the error against the
// nearest face matters: fold the heading delta into +/- PI/4.
export function foldYawError(delta) {
  const quarter = Math.PI / 2
  let folded = delta % quarter
  if (folded > quarter / 2) folded -= quarter
  if (folded < -quarter / 2) folded += quarter
  return folded
}

// Where the forks are relative to a pallet, in the vehicle's own frame.
//
// `palletHalf` is the pallet's `{ halfWidth, halfDepth }` measured off its
// model. The pallet is an oriented box, so its extent along the vehicle's
// approach axis is the box projected onto that axis - which is what lets the
// same maths handle a pallet approached at an angle.
export function evaluateForkEngagement({
  palletX,
  palletZ,
  palletRot = 0,
  palletHalf,
  vehicleX,
  vehicleZ,
  heading,
  forkTipOffset,
  forkReach = Infinity,
}) {
  const forwardX = Math.sin(heading)
  const forwardZ = Math.cos(heading)
  const dx = palletX - vehicleX
  const dz = palletZ - vehicleZ
  const localForward = dx * forwardX + dz * forwardZ
  const localRight = dx * forwardZ - dz * forwardX

  const delta = heading - palletRot
  const yawError = foldYawError(delta)
  const sin = Math.abs(Math.sin(delta))
  const cos = Math.abs(Math.cos(delta))
  const halfAlong = palletHalf.halfWidth * sin + palletHalf.halfDepth * cos
  const halfAcross = palletHalf.halfWidth * cos + palletHalf.halfDepth * sin

  // "Fully in" is the pallet's own depth, or the length of tine available to
  // hold it, whichever runs out first - a pallet deeper than the forks can
  // still be driven all the way on, it just never spans more than the tines.
  const palletDepth = halfAlong * 2
  const seatedDepth = Math.min(palletDepth, forkReach)
  const nearFace = localForward - halfAlong
  const insertDepth = Math.min(Math.max(forkTipOffset - nearFace, 0), seatedDepth)
  const depthRatio = seatedDepth > 0 ? insertDepth / seatedDepth : 0
  const lateralRatio = halfAcross > 0 ? Math.abs(localRight) / halfAcross : 1

  // The forks can only find the pockets from roughly square on, from in front.
  const canEnter =
    localForward > 0 && lateralRatio <= FORK_LATERAL_MAX_RATIO && Math.abs(yawError) <= FORK_YAW_MAX

  return {
    insertDepth,
    palletDepth,
    seatedDepth,
    depthRatio,
    lateralRatio,
    yawError,
    canEnter,
    canLift: canEnter && depthRatio >= FORK_INSERT_MIN_RATIO,
  }
}

// What the dashboard's grip lamp shows for an engagement:
//   'none'     not lined up with the pockets, or not in them yet
//   'shallow'  in, but too short a bite to carry
//   'partial'  far enough to lift, but short, off-centre or askew
//   'secure'   seated to the carriage, centred and square
export function forkGrip(engagement) {
  if (!engagement.canEnter || engagement.insertDepth <= 0) return 'none'
  if (!engagement.canLift) return 'shallow'
  const seated =
    engagement.depthRatio >= FORK_INSERT_SECURE_RATIO &&
    engagement.lateralRatio <= FORK_LATERAL_SECURE_RATIO &&
    Math.abs(engagement.yawError) <= FORK_YAW_SECURE
  return seated ? 'secure' : 'partial'
}
