// How well the forks are seated in a pallet, and what makes a badly seated
// load slide off. Pure functions over plain numbers - no three.js, no refs, no
// frame state - so the rules are readable and reviewable apart from the frame
// loop that drives them (DrivingSimulationViewer.jsx).
//
// The model is deliberately kinematic, like the rest of the simulation: a
// single `risk` scalar per carried load, derived once at pickup from how the
// forks went in, and a per-frame "slip" that eats away the insertion depth
// when the truck is mishandled. A perfectly seated load has risk 0 and is
// therefore immune, which is the behaviour the step is meant to teach.

import {
  FORK_INSERT_MIN_RATIO,
  FORK_INSERT_SECURE_RATIO,
  FORK_LATERAL_MAX_RATIO,
  FORK_LATERAL_SECURE_RATIO,
  FORK_YAW_MAX,
  FORK_YAW_SECURE,
  SHARP_TURN_LATERAL_ACCEL,
  SLIP_DECEL_GAIN,
  SLIP_TILT_GAIN,
  SLIP_TURN_GAIN,
  TILT_BACK_RISK_FACTOR,
} from '../data/palletProfile.js'

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1)
}

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

// 0 = seated squarely against the carriage and centred; 1 = barely hooked on.
// The three sub-risks combine as a probabilistic union so the result is
// monotone in each of them and exactly 0 only when all three are inside their
// secure bands.
export function engagementRisk({ depthRatio, lateralRatio, yawError }) {
  const depthRisk = clamp01(
    (FORK_INSERT_SECURE_RATIO - depthRatio) / (FORK_INSERT_SECURE_RATIO - FORK_INSERT_MIN_RATIO),
  )
  const lateralRisk = clamp01(
    (lateralRatio - FORK_LATERAL_SECURE_RATIO) / (FORK_LATERAL_MAX_RATIO - FORK_LATERAL_SECURE_RATIO),
  )
  const yawRisk = clamp01((Math.abs(yawError) - FORK_YAW_SECURE) / (FORK_YAW_MAX - FORK_YAW_SECURE))
  return clamp01(1 - (1 - depthRisk) * (1 - lateralRisk) * (1 - yawRisk))
}

// What the HUD shows. `secure` promises the load cannot be shaken off.
export function gripQuality({ risk, canLift }) {
  if (!canLift) return 'none'
  return risk > 0 ? 'partial' : 'secure'
}

// Metres of insertion depth lost this frame, and which rule to blame if the
// load ends up on the floor.
//
// `enabled` is the course's own `failConditions`, so a rule an admin left
// switched off contributes nothing at all rather than silently degrading the
// grip. Tilting the mast back past `tiltSecureAngle` is the operator's job
// while travelling, and scales every source right down.
export function slipThisFrame({
  risk,
  tiltAngle,
  tiltSecureAngle,
  decel,
  turnLoad,
  dt,
  enabled = {},
}) {
  if (risk <= 0) return { slip: 0, cause: null }

  const sources = []

  if (enabled.suddenStop && decel > 0) {
    sources.push({ amount: SLIP_DECEL_GAIN * decel * dt, cause: 'load-dropped' })
  }
  if (enabled.sharpTurn && turnLoad > SHARP_TURN_LATERAL_ACCEL) {
    sources.push({ amount: SLIP_TURN_GAIN * (turnLoad - SHARP_TURN_LATERAL_ACCEL) * dt, cause: 'load-slipped' })
  }
  if (enabled.unsecuredTravel && tiltAngle > tiltSecureAngle) {
    sources.push({ amount: SLIP_TILT_GAIN * (tiltAngle - tiltSecureAngle) * dt, cause: 'unsecured-load' })
  }

  if (!sources.length) return { slip: 0, cause: null }

  const secured = tiltAngle <= tiltSecureAngle
  const scale = risk * (secured ? TILT_BACK_RISK_FACTOR : 1)
  const total = sources.reduce((sum, source) => sum + source.amount, 0) * scale
  const worst = sources.reduce((best, source) => (source.amount > best.amount ? source : best))

  return { slip: total, cause: worst.cause }
}
