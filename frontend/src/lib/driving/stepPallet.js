import { FORK_POCKET_TOLERANCE, LOAD_LOSS_WINDOW_SECONDS, SHARP_TURN_LATERAL_ACCEL } from '../../data/palletProfile.js'
import { PALLETS, TINE, TINE_HEEL_Z, TINE_REST_Y } from '../../data/physicsProfile.js'
import { RACK_SLOT_HALF_WIDTH } from '../../data/rackProfile.js'
import { FORKS_TRAVEL_HEIGHT } from '../../data/safetyThresholds.js'
import { evaluateForkEngagement, forkGrip } from '../loadPhysics.js'
import { deratedCapacityKg } from '../physics/loadChart.js'
import { nextPalletState } from '../physics/palletState.js'
import { toRectLocal } from '../simCollision.js'
import { HIGH_TRAVEL_MIN_SPEED, SUDDEN_STOP_DECEL, SUDDEN_STOP_MIN_SPEED, TILT_SECURE_ANGLE } from './constants.js'
import { triggerFail } from './stepFail.js'
import { toMetres } from './units.js'

// Pallets, as the simulation sees them. The pallets themselves are physics
// bodies (lib/physics/world.js): the forks lift one because they are under
// it, it slides on them by friction, and it lands where it is lowered. This
// step reads what stepPhysics brought back and keeps the course's side of it:
//
// - each pallet's state (lib/physics/palletState.js) and the viewer's
//   pallet-lifted / pallet-dropped / pallet-delivered events, unchanged;
// - the dashboard's grip lamp (lib/loadPhysics.js) and the load on the forks
//   against the load chart (lib/physics/loadChart.js);
// - the load-handling fails a course switches on (lib/courseGoals.js,
//   resolveFailConditions): lifting over the derated capacity, travelling
//   with a load too high, and losing a load.
//
// Must run after stepPhysics.

const GRIP_RANK = { none: 0, shallow: 1, partial: 2, secure: 3 }

function emitPalletEvent(state, event, nextState) {
  state.hud.palletState = nextState
  if (event.type === 'pallet-lifted') state.hud.carriedLoadKg = event.weightKg ?? null
  if (event.type === 'pallet-dropped' || event.type === 'pallet-delivered') state.hud.carriedLoadKg = null
  state.events.push({ type: 'pallet', event, nextState })
}

// Whether the tines are at the height of a pallet's pockets, for one they
// are not touching yet.
function tinesAtPockets(pallet, forks) {
  const [pocketBottom, pocketTop] = PALLETS[pallet.kind].pockets.z.y
  const underside = forks.height + TINE_REST_Y - pallet.position.y
  return underside >= pocketBottom - FORK_POCKET_TOLERANCE && underside + TINE.thickness <= pocketTop + FORK_POCKET_TOLERANCE
}

// Why a load was lost, from what the operator did in the second before: the
// fail message teaches the cause, the physics only knows it came off.
function lossReason(state) {
  const within = (at) => at !== null && state.time - at <= LOAD_LOSS_WINDOW_SECONDS
  if (within(state.recent.hardBrakeAt)) return 'load-dropped'
  if (within(state.recent.sharpTurnAt)) return 'load-slipped'
  if (state.forks.tilt > TILT_SECURE_ANGLE) return 'unsecured-load'
  return 'load-dropped'
}

// Whether a pallet is where it was going: on the floor inside the drop zone,
// or on its target rack's target shelf, in the centre bay.
export function atDestination(pallet, world) {
  const { course, racks } = world
  const { def, touch, position } = pallet
  if (def.targetRack && def.targetLevel) {
    if (touch.rackId !== def.targetRack || touch.rackLevel !== def.targetLevel) return false
    const rack = racks.find((entry) => entry.id === def.targetRack)
    if (!rack) return false
    const slot = toRectLocal(position.x, position.z, { x: rack.position[0], z: rack.position[2], rotation: rack.rotation || 0 })
    return Math.abs(slot.x) <= RACK_SLOT_HALF_WIDTH
  }
  const zone = course.dropZone
  if (!zone || touch.rackId !== null) return false
  return Math.hypot(position.x - zone.position[0], position.z - zone.position[2]) <= zone.radius
}

export function stepPallet(state, world, dt) {
  const { truck, forks, pallets, frame, recent } = state
  const { geometry, failConditions, ratedCapacityKg } = world
  const { forwardX, forwardZ, lateralAccel, prevSpeed } = frame

  if (!pallets.length) return

  // What the operator has just done, for naming a lost load's cause.
  const decel = prevSpeed > SUDDEN_STOP_MIN_SPEED ? (prevSpeed - truck.speed) / dt : 0
  if (decel > SUDDEN_STOP_DECEL) recent.hardBrakeAt = state.time
  if (Math.abs(lateralAccel) > SHARP_TURN_LATERAL_ACCEL) recent.sharpTurnAt = state.time

  let grip = 'none'
  let load = null
  let carriedIndex = -1

  pallets.forEach((pallet, index) => {
    const engagement = evaluateForkEngagement({
      palletX: pallet.position.x,
      palletZ: pallet.position.z,
      palletRot: pallet.rotation.y,
      palletHalf: pallet.footprint,
      vehicleX: truck.x,
      vehicleZ: truck.z,
      heading: truck.heading,
      forkTipOffset: geometry.forkTipOffset,
      forkReach: geometry.forkReach,
    })
    const inPockets = engagement.canEnter && engagement.insertDepth > 0 && (pallet.touch.tines || tinesAtPockets(pallet, forks))

    // The load chart: how far out along the tines this load's centre of
    // gravity is, from the fork face.
    const centre = toMetres((pallet.com.x - truck.x) * forwardX + (pallet.com.z - truck.z) * forwardZ - TINE_HEEL_Z)
    const deratedKg = deratedCapacityKg(ratedCapacityKg, centre)

    const next = nextPalletState(
      pallet,
      {
        onForks: pallet.touch.forks,
        supported: pallet.touch.supported,
        speed: pallet.velocity.length(),
        lean: pallet.lean,
        delivered: !pallet.touch.forks && !inPockets && atDestination(pallet, world),
      },
      dt,
    )
    const { event: happened, ...timers } = next
    Object.assign(pallet, timers)
    // A failed attempt is over: the physics carries on, the course does not.
    const event = state.failed ? null : happened

    const { def } = pallet
    const carried = pallet.state === 'carried'
    // On the forks, a load is over capacity when it is more than the chart
    // allows where it sits. Before that it is over when it is more than the
    // plate allows anywhere, or when the lift is being worked with the forks
    // too short a way in: sliding the forks in and out passes through every
    // load centre, and that is not an attempt to lift.
    const lifting = frame.controls.lift > 0
    const overCapacity = carried || lifting ? pallet.loadKg > deratedKg : pallet.loadKg > ratedCapacityKg
    if (event === 'lifted') {
      if (overCapacity && failConditions.overload) triggerFail(state, 'overload')
      else emitPalletEvent(state, { type: 'pallet-lifted', palletId: def.id, weightKg: def.weightKg }, 'carried')
    } else if (event === 'set-down') {
      emitPalletEvent(state, { type: 'pallet-dropped', palletId: def.id }, 'released')
    } else if (event === 'delivered') {
      state.deliveredCount += 1
      emitPalletEvent(
        state,
        { type: 'pallet-delivered', palletId: def.id, weightKg: def.weightKg, deliveredCount: state.deliveredCount },
        'delivered',
      )
    } else if (event === 'lost' && failConditions.loadDrop) {
      triggerFail(state, lossReason(state))
    }

    if (carried && carriedIndex === -1) carriedIndex = index

    // The load the forks are in, or under: the one carried, else the one
    // they are furthest into.
    if (carried || inPockets) {
      const quality = forkGrip(engagement)
      if (carried || (carriedIndex === -1 && GRIP_RANK[quality] >= GRIP_RANK[grip])) {
        grip = carried && quality === 'none' ? 'shallow' : quality
        load = { index, kg: pallet.loadKg, centre, deratedKg, overCapacity }
      }
    }

    // Travelling with a raised load: unsafe practice rather than a spill, so
    // it fails in place.
    if (
      failConditions.highTravel &&
      carried &&
      !pallet.landed &&
      Math.abs(truck.speed) > HIGH_TRAVEL_MIN_SPEED &&
      forks.height > FORKS_TRAVEL_HEIGHT
    ) {
      triggerFail(state, 'high-travel')
    }
  })

  state.carriedIndex = carriedIndex
  state.grip = grip
  state.load = load
}
