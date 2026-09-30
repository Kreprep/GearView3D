import {
  LOAD_LAND_CLEARANCE,
  LOAD_TIP_HEIGHT,
  LOAD_TIP_TILT_RATIO,
  LOAD_TIP_WEIGHT_RATIO,
  SLIP_FAIL_RATIO,
  TILT_RELEASE_ANGLE,
} from '../../data/palletProfile.js'
import { RACK_LEVEL_HEIGHTS, RACK_LEVEL_TOLERANCE, RACK_LEVELS, RACK_PLACE_MAX_SPEED } from '../../data/rackProfile.js'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { engagementRisk, evaluateForkEngagement, gripQuality, slipThisFrame } from '../loadPhysics.js'
import { forkPose } from './forkPose.js'
import { targetRackSlot } from './rackSlot.js'
import { triggerFail } from './stepFail.js'
import {
  CLEAR_DISTANCE,
  FORK_ENGAGE_HEIGHT,
  HIGH_TRAVEL_MIN_SPEED,
  LIFT_THRESHOLD,
  LOAD_GRAVITY,
  LOAD_REST_TILT,
  LOAD_TUMBLE_RATE,
  OVERLOAD_TIP_HEIGHT,
  PALLET_CARRY_Y,
  SAFE_TRAVEL_HEIGHT,
  SUDDEN_STOP_DECEL,
  SUDDEN_STOP_MIN_SPEED,
  TILT_FORWARD_MAX,
  TILT_SECURE_ANGLE,
} from './constants.js'

// Pallet pickup/carry/release. Still kinematic, no physics engine, but
// lib/loadPhysics.js grades how far the forks actually went in and how
// squarely, and that grade decides whether the load survives being thrown
// about. Multi-pallet aware: only one pallet can be carried at a time, and a
// course's `capacityKg`/`failConditions` layer the overload, slip and
// tip-over rules on top of the module-2 flow. Also grades delivery into a
// dropZone (a rack delivery is graded inline, in the 'carried' branch, since
// setting a load onto its target shelf and setting it on the floor are the
// same "landed + tilt forward" release gesture).
//
// Scratch maths objects, reused every step.
const carriageMatrix = new Matrix4()
const carriageInverse = new Matrix4()
const carriageQuat = new Quaternion()
const carriagePos = new Vector3()
const carriageScale = new Vector3()
const palletQuat = new Quaternion()
const palletEuler = new Euler(0, 0, 0, 'YXZ')
const gripWorld = new Vector3()

function emitPalletEvent(state, event, nextState) {
  state.hud.palletState = nextState
  if (event.type === 'pallet-lifted') state.hud.carriedLoadKg = event.weightKg ?? null
  if (event.type === 'pallet-dropped' || event.type === 'pallet-delivered') state.hud.carriedLoadKg = null
  state.events.push({ type: 'pallet', event, nextState })
}

// Must run after stepForks (reads the fork height and tilt it just
// integrated) and after stepCollisionBody (reads the committed position).
export function stepPallet(state, world, dt) {
  const { truck, forks, pallets, frame } = state
  const { course, geometry } = world
  const { forwardX, forwardZ, lateralAccel, prevSpeed } = frame

  if (!pallets.length) return

  const capacity = typeof course.capacityKg === 'number' ? course.capacityKg : Infinity
  const failConditions = course.failConditions || {}
  const attachOffset = geometry.forkTipOffset
  const attachReach = geometry.forkReach
  const tipX = truck.x + forwardX * attachOffset
  const tipZ = truck.z + forwardZ * attachOffset
  const decel = prevSpeed > SUDDEN_STOP_MIN_SPEED ? (prevSpeed - truck.speed) / dt : 0
  const brakingHard = decel > SUDDEN_STOP_DECEL
  const turnLoad = Math.abs(lateralAccel)
  let liveQuality = 'none'

  // A carried pallet is pinned to the carriage rather than chased toward a
  // point in front of the truck: its pose is captured in the carriage's own
  // local frame the moment it lifts, then replayed from the carriage's world
  // matrix every step. That matrix (forkPose.js) carries the truck's position
  // and heading, the fork height and the mast tilt, so the load stays exactly
  // where it was picked up - including a shallow or off-centre bite - and
  // pitches with the mast, with no lag.
  forkPose(state, geometry, carriageMatrix)
  carriageMatrix.decompose(carriagePos, carriageQuat, carriageScale)

  const captureGrip = (pallet, engagement) => {
    const worldPos = gripWorld.copy(pallet.position)
    // Only the *bite* is captured - how far in along the tines and how far
    // off their centreline the pallet is. Its height is the tines
    // themselves: measure from the deck it is being picked off rather than
    // from wherever the forks have already lifted or pitched it to, or that
    // head start is baked into the grip and the load rides that far above
    // the tines for the rest of the carry.
    worldPos.y = 0
    const local = worldPos.applyMatrix4(carriageInverse.copy(carriageMatrix).invert()).clone()
    // Undo however far the carriage has already lifted: lift travels along
    // the carriage's local +Y (up the tilted mast), so this is its exact
    // inverse, and leaves an offset that holds at any fork height.
    local.y += forks.height + PALLET_CARRY_Y
    return {
      local,
      quat: carriageQuat.clone().invert().multiply(palletQuat.setFromEuler(pallet.rotation)),
      insertDepth: engagement.insertDepth,
      seatedDepth: engagement.seatedDepth,
    }
  }

  const applyGrip = (pallet, grip) => {
    pallet.position.copy(grip.local).applyMatrix4(carriageMatrix)
    pallet.rotation.setFromQuaternion(palletQuat.copy(carriageQuat).multiply(grip.quat))
  }

  // A load resting on the floor or a shelf is held up by that surface, not
  // by the tines. It keeps its own yaw, pitches only with a mast tilted
  // *back* - tilting forward would drive its far edge through the deck -
  // and rises just enough to keep its near edge on the surface as it does.
  const settleLoad = (pallet, surfaceY, halfDepth, pitch) => {
    palletEuler.setFromQuaternion(palletQuat.setFromEuler(pallet.rotation), 'YXZ')
    const yaw = palletEuler.y
    pallet.rotation.order = 'YXZ'
    pallet.rotation.set(pitch, yaw, 0)
    pallet.position.y = surfaceY + halfDepth * Math.sin(-pitch)
  }

  // How much of the mast's tilt a supported load actually shows.
  const restingPitch = () => Math.min(forks.tilt, 0)

  // What is under a carried load: the shelf it is lined up with, or the
  // floor. Only a level the load has already been raised above counts, so
  // lowering past one shelf settles on the next one down rather than
  // snapping back up to the one it just cleared.
  const supportHeight = (loadY, inSlot) => {
    if (!inSlot) return 0
    let best = 0
    for (const level of RACK_LEVELS) {
      const height = RACK_LEVEL_HEIGHTS[level] ?? 0
      if (height <= loadY + RACK_LEVEL_TOLERANCE && height > best) best = height
    }
    return best
  }

  const dropLoad = (sim, reason, launchSpeed) => {
    sim.state = 'falling'
    sim.grip = null
    sim.engaged = false
    state.carriedIndex = -1
    sim.vx = forwardX * launchSpeed
    sim.vz = forwardZ * launchSpeed
    sim.vy = 0.1
    triggerFail(state, reason)
  }

  // Each entry in state.pallets is both a pallet's pose (position, rotation)
  // and its carry state, so `pallet` and `sim` below are the same object; the
  // two names keep the rules readable.
  pallets.forEach((pallet, i) => {
    const sim = pallet
    const palletDef = pallet.def
    const palletHalf = pallet.footprint

    if ((sim.state === 'ground' || sim.state === 'released') && state.carriedIndex === -1 && !state.failed) {
      const engagement = evaluateForkEngagement({
        palletX: pallet.position.x,
        palletZ: pallet.position.z,
        palletRot: pallet.rotation.y,
        palletHalf,
        vehicleX: truck.x,
        vehicleZ: truck.z,
        heading: truck.heading,
        forkTipOffset: attachOffset,
        forkReach: attachReach,
      })
      const forksDown = forks.height <= FORK_ENGAGE_HEIGHT

      // Engagement latches: the forks have to go in with the carriage down,
      // but raising them from there must not undo it - the learner passes
      // through FORK_ENGAGE_HEIGHT on the way to LIFT_THRESHOLD. It only
      // clears when the pallet stops being forkable at all, which also
      // freezes `risk` at the quality the forks actually went in with.
      if (engagement.canLift && forksDown) {
        sim.engaged = true
        sim.risk = engagementRisk(engagement)
      } else if (!engagement.canLift) {
        sim.engaged = false
        sim.risk = 0
        sim.grip = null
      }

      if (sim.engaged) {
        // Keep the grip current right up until the load leaves the ground,
        // so it lifts from exactly where it is sitting. Capturing it only
        // at the lift threshold would record the carriage already raised
        // and pin the pallet to the floor.
        sim.grip = captureGrip(pallet, engagement)
        liveQuality = gripQuality({ risk: sim.risk, canLift: true })
        // Tines in, load still on the deck: it already answers the mast.
        // Raising the carriage lifts it, and tilting back rolls its outer
        // edge up off the floor - which is exactly why an operator tilts
        // back before travelling, so it has to be visible here.
        settleLoad(pallet, forks.height + PALLET_CARRY_Y, palletHalf.halfDepth, restingPitch())
      } else if (engagement.canEnter && forksDown && engagement.insertDepth > 0) {
        liveQuality = 'shallow'
      }

      if (sim.engaged && truck.engineOn) {
        const overweight = (palletDef.weightKg ?? 0) > capacity
        if (failConditions.overload && overweight && forks.height >= OVERLOAD_TIP_HEIGHT) {
          // Overload: the truck pitches forward and throws the load off.
          sim.engaged = false
          sim.state = 'falling'
          sim.vx = forwardX * (Math.abs(truck.speed) + 0.5)
          sim.vz = forwardZ * (Math.abs(truck.speed) + 0.5)
          sim.vy = 0.35
          state.tip.active = true
          triggerFail(state, 'overload')
        } else if (!overweight && forks.height >= LIFT_THRESHOLD) {
          sim.engaged = false
          sim.state = 'carried'
          sim.slipCause = null
          state.carriedIndex = i
          emitPalletEvent(state, { type: 'pallet-lifted', palletId: palletDef.id, weightKg: palletDef.weightKg }, 'carried')
        }
      }
    } else if (sim.state === 'carried') {
      liveQuality = gripQuality({ risk: sim.risk, canLift: true })

      // Rack-targeted pallets place directly from the carried state: the
      // learner holds the pallet at the target shelf's height, drives it
      // into the bay and tilts the mast forward to set it down, rather than
      // lowering to the ground like a dropZone delivery - a shelf is
      // elevated, so there is no "lower to release" step.
      //
      // Lined up with the bay at any height is what puts a shelf under the
      // load instead of the floor; being at the *target* level as well is
      // what makes setting it down a delivery (rackSlot.js). The set-down
      // itself happens in the carry branch below, so the floor and the shelf
      // are one rule.
      const { targetRack, targetHeight, rackRot, inSlotRect, atTargetSlot } = targetRackSlot(
        { tipX, tipZ, forkHeight: forks.height },
        palletDef,
        world,
      )

      // Lined up at the target shelf, tilting forward is the correct move -
      // exempt it, or storing a heavy pallet up high would be impossible
      // whenever the tip-over rule is on.
      const tipsForward =
        failConditions.loadTipping &&
        !state.failed &&
        !atTargetSlot &&
        !sim.landed &&
        forks.height > LOAD_TIP_HEIGHT &&
        forks.tilt >= TILT_FORWARD_MAX * LOAD_TIP_TILT_RATIO &&
        (palletDef.weightKg ?? 0) > capacity * LOAD_TIP_WEIGHT_RATIO

      if (tipsForward) {
        // A heavy load, high up and tilted forward, puts the combined
        // centre of gravity past the front wheels.
        state.tip.active = true
        dropLoad(sim, 'load-tipping', Math.abs(truck.speed) + 0.4)
      } else if (
        failConditions.highTravel &&
        !state.failed &&
        Math.abs(truck.speed) > HIGH_TRAVEL_MIN_SPEED &&
        forks.height > SAFE_TRAVEL_HEIGHT
      ) {
        // Driving at speed with the forks raised above standard travel
        // height: unsafe practice, not a physical spill - fail in place.
        triggerFail(state, 'high-travel')
      } else {
        // A partially engaged load creeps out along the tines when the
        // truck is braked hard, swung round or carried with the mast not
        // tilted back. A load seated to the carriage and square has risk 0
        // and never moves, which is the habit the step is teaching.
        if (!state.failed && sim.grip && !sim.landed) {
          const { slip, cause } = slipThisFrame({
            risk: sim.risk,
            tiltAngle: forks.tilt,
            tiltSecureAngle: TILT_SECURE_ANGLE,
            decel: brakingHard ? decel : 0,
            turnLoad,
            dt,
            enabled: failConditions,
          })
          if (slip > 0) {
            sim.grip.insertDepth = Math.max(sim.grip.insertDepth - slip, 0)
            // The carriage's local +Z runs out along the forks, so losing
            // insertion depth slides the pallet toward the tips.
            if (sim.grip.local) sim.grip.local.z += slip
            sim.slipCause = cause
          }
        }

        const depthRatio = sim.grip?.seatedDepth > 0 ? sim.grip.insertDepth / sim.grip.seatedDepth : 1

        if (!state.failed && sim.grip && depthRatio < SLIP_FAIL_RATIO) {
          dropLoad(sim, sim.slipCause || 'load-dropped', Math.max(Math.abs(prevSpeed), 0.35) * 1.15)
        } else {
          applyGrip(pallet, sim.grip)

          // Setting a load down is two moves, on the floor and on a shelf
          // alike: lower it until the surface takes its weight, then tilt
          // the mast forward to let it off the tines. Between the two the
          // pallet is landed - it stops following the forks down and sits
          // on whatever is holding it up while the forks keep moving.
          // A surface that has taken the load keeps it until the forks
          // raise it clear again. Re-deriving the support from the load's
          // live height every frame would let tilting the mast forward -
          // which drops it a few centimetres - sink it straight through
          // the shelf it is already resting on, which is exactly the move
          // that is supposed to release it.
          const holding = sim.landed && (inSlotRect || sim.restY === 0)
          const surfaceY = holding ? sim.restY : supportHeight(pallet.position.y, inSlotRect)
          sim.landed = pallet.position.y <= surfaceY + LOAD_LAND_CLEARANCE

          if (sim.landed) {
            sim.restY = surfaceY
            settleLoad(pallet, surfaceY, palletHalf.halfDepth, restingPitch())

            const tiltedForward = forks.tilt >= TILT_RELEASE_ANGLE
            const onTargetShelf = targetHeight != null && Math.abs(surfaceY - targetHeight) < 1e-3
            const steady = !onTargetShelf || Math.abs(truck.speed) <= RACK_PLACE_MAX_SPEED

            if (tiltedForward && steady && !state.failed) {
              sim.grip = null
              sim.engaged = false
              sim.landed = false
              state.carriedIndex = -1
              settleLoad(pallet, surfaceY, palletHalf.halfDepth, 0)

              if (onTargetShelf) {
                // Square the delivered pallet up in its bay. The truck body
                // is stopped at the rack's face, so the load comes off the
                // tines at the mouth of the shelf rather than over its
                // middle - the only place they can reach.
                sim.state = 'delivered'
                pallet.position.set(targetRack.position[0], targetHeight, targetRack.position[2])
                pallet.rotation.set(0, rackRot, 0)
                state.deliveredCount += 1
                emitPalletEvent(
                  state,
                  {
                    type: 'pallet-delivered',
                    palletId: palletDef.id,
                    weightKg: palletDef.weightKg,
                    deliveredCount: state.deliveredCount,
                  },
                  'delivered',
                )
              } else {
                sim.state = 'released'
                emitPalletEvent(state, { type: 'pallet-dropped', palletId: palletDef.id }, 'released')
              }
            }
          }
        }
      }
    } else if (sim.state === 'falling') {
      sim.vy -= LOAD_GRAVITY * dt
      pallet.position.x += sim.vx * dt
      pallet.position.y += sim.vy * dt
      pallet.position.z += sim.vz * dt
      pallet.rotation.x += LOAD_TUMBLE_RATE * dt
      if (pallet.position.y <= 0.01 && sim.vy < 0) {
        pallet.position.y = 0.02
        pallet.rotation.x = 0
        pallet.rotation.z = LOAD_REST_TILT
        sim.state = 'dropped'
      }
    }

    if (sim.state === 'released' && course.dropZone && !state.failed) {
      const inZone = Math.hypot(
        pallet.position.x - course.dropZone.position[0],
        pallet.position.z - course.dropZone.position[2],
      ) <= course.dropZone.radius
      const cleared = Math.hypot(pallet.position.x - tipX, pallet.position.z - tipZ) >= CLEAR_DISTANCE
      if (inZone && cleared) {
        sim.state = 'delivered'
        state.deliveredCount += 1
        emitPalletEvent(
          state,
          {
            type: 'pallet-delivered',
            palletId: palletDef.id,
            weightKg: palletDef.weightKg,
            deliveredCount: state.deliveredCount,
          },
          'delivered',
        )
      }
    }
  })

  state.grip = liveQuality
}
