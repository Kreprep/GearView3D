import { LOOK_AHEAD_HALF_ANGLE, PATH_MARGIN } from '../../data/safetyThresholds.js'
import { MAX_STEER_ANGLE, STEER_SIGN } from './constants.js'
import { neutralControls } from './controls.js'
import { startInterlockMissing } from './interlock.js'
import { pathClearance, proximityReadout } from './proximity.js'
import { inRackSlot } from './rackSlot.js'
import { activeCheckpoint, hornSoundedFor, inCheckpointArea } from './stepGoals.js'
import { atDestination } from './stepPallet.js'
import { kmh } from './units.js'

// What the safety rules (safetyRules.js) judge: one flat reading of the
// simulation as the last step left it, plus the two things only the view
// knows (which way the learner is looking, and the course's speed limit).
// Pure, and read-only over the sim state: building it changes nothing, so the
// characterization trace cannot depend on it.
//
// Speeds and distances are in scene units (lib/driving/units.js), like the
// thresholds they are compared with.

const NO_CONTROLS = neutralControls()
// A side glance lands on LOOK_AHEAD_HALF_ANGLE itself, give or take the
// rounding of the easing that got it there.
const ANGLE_EPSILON = 1e-3

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

// Where the fork tips are, in world space.
function forkTip(state, world) {
  const { x, z, heading } = state.truck
  const tipOffset = world.geometry.forkTipOffset
  return { tipX: x + Math.sin(heading) * tipOffset, tipZ: z + Math.cos(heading) * tipOffset }
}

// The load on the forks, or about to be: whether it is more than the load
// chart allows where it sits, whether it is off the ground, whether it is
// resting where it is going, and how fast it is sliding on the tines.
function loadReading(state, world) {
  const carried = state.pallets[state.carriedIndex] || null
  const landed = Boolean(carried?.landed)

  return {
    carrying: Boolean(carried),
    loadLanded: landed,
    // Lowered onto the floor of the drop zone or its shelf, the forks still
    // under it.
    loadAtDestination: landed && atDestination(carried, world),
    // Against the capacity derated for where the load's centre of gravity
    // is along the tines (lib/physics/loadChart.js).
    overCapacity: Boolean(state.load?.overCapacity),
    loadSlipSpeed: carried && !landed ? carried.slipSpeed : 0,
  }
}

// `view`: { firstPerson, lookYaw } from the camera. `speedLimitKmh`: the
// course's (lib/courseAlerts.js). `previous`: the snapshot before this one, or
// null, for how fast the steering is being turned.
// Whether the fork tips are in a rack's bay: storing a load there, or backing
// the forks out after it.
function forksAtStack(state, world) {
  const { tipX, tipZ } = forkTip(state, world)
  return world.racks.some((rack) => inRackSlot(tipX, tipZ, rack, world))
}

// Whether the truck is at a blind crossing (the checkpoint it is driving to,
// with `requireHorn`) and has not sounded the horn for it.
function hornDue(state, world) {
  const active = activeCheckpoint(state, world)
  if (!active?.checkpoint.requireHorn) return false
  return inCheckpointArea(state.truck, active.checkpoint) && !hornSoundedFor(state, active.checkpoint, active.since)
}

export function buildSafetySnapshot(state, world, { view, speedLimitKmh, previous = null }) {
  const { truck, forks } = state
  const controls = state.frame.controls || NO_CONTROLS
  const proximity = proximityReadout(state, world)
  const elapsed = previous ? state.time - previous.time : 0

  return {
    time: state.time,
    live: !state.failed,
    engineOn: truck.engineOn,
    // Signed: negative is reversing.
    speed: truck.speed,
    // A lever the operator set (a shifter, or the dashboard's), or null with
    // the keyboard's automatic direction.
    lever: controls.explicitDirection ? controls.direction : null,
    throttle: controls.throttle,
    lift: controls.lift,
    // How far the rear wheels are turned, as a fraction of full lock, and how
    // fast the steering input is moving, in locks per second.
    steer: Math.abs(truck.steer) / MAX_STEER_ANGLE,
    steerInput: controls.steer,
    steerRate: elapsed > 0 ? Math.abs(controls.steer - previous.steerInput) / elapsed : (previous?.steerRate ?? 0),
    // Which way the truck is turning: 1 left, -1 right, 0 straight or stopped.
    yaw: Math.sign(truck.speed * Math.tan(truck.steer * STEER_SIGN)),
    seatbelt: controls.seatbelt,
    parkingBrake: controls.parkingBrake,
    forkHeight: forks.height,
    // Negative is tilted back.
    mastTilt: forks.tilt,
    grip: state.grip,
    ...loadReading(state, world),
    atStack: forksAtStack(state, world),
    // The smaller of the truck's two stability margins (lib/physics/
    // stability.js): 1 with nothing acting, 0 at the point of tipping.
    stabilityMargin: Math.min(state.stability.longitudinalMargin, state.stability.lateralMargin),
    hornDue: hornDue(state, world),
    // What a refused start still wants, until the engine starts.
    interlockMissing: state.interlock.at !== null && !truck.engineOn ? startInterlockMissing(controls) : [],
    // Clearances, or null when there is nothing there.
    ahead: pathClearance(state, world, 1, PATH_MARGIN)?.distance ?? null,
    behind: pathClearance(state, world, -1, PATH_MARGIN)?.distance ?? null,
    rearLeft: proximity.rearLeft?.distance ?? null,
    rearRight: proximity.rearRight?.distance ?? null,
    // null outside first-person: a chase camera sees all round the truck.
    lookingAhead: view.firstPerson ? Math.abs(wrapAngle(view.lookYaw)) < LOOK_AHEAD_HALF_ANGLE - ANGLE_EPSILON : null,
    speedLimit: kmh(speedLimitKmh),
    speedLimitKmh,
  }
}
