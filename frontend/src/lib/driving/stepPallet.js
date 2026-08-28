import {
  LOAD_LAND_CLEARANCE,
  LOAD_TIP_HEIGHT,
  LOAD_TIP_TILT_RATIO,
  LOAD_TIP_WEIGHT_RATIO,
  PALLET_FALLBACK_FOOTPRINT,
  SLIP_FAIL_RATIO,
  TILT_RELEASE_ANGLE,
} from '../../data/palletProfile'
import {
  RACK_FOOTPRINT,
  RACK_LEVEL_HEIGHTS,
  RACK_LEVEL_TOLERANCE,
  RACK_LEVELS,
  RACK_PLACE_MAX_SPEED,
  RACK_SLOT_APPROACH_MARGIN,
  RACK_SLOT_HALF_WIDTH,
} from '../../data/rackProfile'
import { engagementRisk, evaluateForkEngagement, gripQuality, slipThisFrame } from '../loadPhysics'
import { toRectLocal } from '../simCollision'
import { triggerFail } from './stepFail'
import {
  CLEAR_DISTANCE,
  FORK_ENGAGE_HEIGHT,
  FORK_REACH_FALLBACK,
  FORK_TIP_OFFSET_FALLBACK,
  HIGH_TRAVEL_MIN_SPEED,
  LIFT_THRESHOLD,
  LOAD_GRAVITY,
  LOAD_REST_TILT,
  LOAD_TUMBLE_RATE,
  OVERLOAD_TIP_HEIGHT,
  PALLET_CARRY_Y,
  RACK_HIT_MARGIN,
  SAFE_TRAVEL_HEIGHT,
  SUDDEN_STOP_DECEL,
  SUDDEN_STOP_MIN_SPEED,
  TILT_MAX_ANGLE,
  TILT_SECURE_ANGLE,
} from './constants'

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
// Must run after stepForks (reads forkHeightRef/tiltAngleRef and the
// carriage/tilt-pivot world transform it just animated) and after
// stepCollisionBody (reads the committed posRef).
export function stepPallet(ctx, dt) {
  const {
    pallets, palletSimRef, course, rigRef, posRef, headingRef, forkHeightRef, tiltAngleRef,
    palletRefs, palletFootprintsRef, carriedIndexRef, failedRef, engineOnRef, racks, profile,
    gripQualityRef, deliveredCountRef, onPalletEvent, halfLength, speedRef,
    gripLocalRef, palletEulerRef, gripQuatRef, carriageQuatRef, tipStateRef, frame,
  } = ctx
  const { forwardX, forwardZ, turnInput, prevSpeed } = frame

  if (!pallets.length) return

  if (!palletSimRef.current) {
    palletSimRef.current = pallets.map(() => ({
      state: 'ground',
      engaged: false,
      vx: 0,
      vy: 0,
      vz: 0,
      risk: 0,
      grip: null,
      slipCause: null,
      landed: false,
      restY: 0,
    }))
  }

  const rig = rigRef.current
  const capacity = typeof course.capacityKg === 'number' ? course.capacityKg : Infinity
  const failConditions = course.failConditions || {}
  const attachOffset = rig?.forkTipOffset || FORK_TIP_OFFSET_FALLBACK
  const attachReach = rig?.forkReach || FORK_REACH_FALLBACK
  const tipX = posRef.current.x + forwardX * attachOffset
  const tipZ = posRef.current.z + forwardZ * attachOffset
  const decel = prevSpeed > SUDDEN_STOP_MIN_SPEED ? (prevSpeed - speedRef.current) / dt : 0
  const brakingHard = decel > SUDDEN_STOP_DECEL
  const turnLoad = Math.abs(turnInput) * Math.abs(speedRef.current)
  let liveQuality = 'none'
  // Racking blocks the truck body, so the fork tip can only ever reach a
  // little way past the rack's front face - and how far depends on the
  // vehicle, since a short fork on a long body reaches less. Derive the
  // depth the slot accepts from that geometry rather than trusting a fixed
  // margin, or a vehicle profile with a shorter fork could never deliver.
  const slotReach =
    RACK_FOOTPRINT.halfDepth +
    Math.max(RACK_SLOT_APPROACH_MARGIN, halfLength + RACK_HIT_MARGIN - attachOffset + 0.05)

  // A carried pallet is pinned to the carriage rather than chased toward a
  // point in front of the truck: its pose is captured in the carriage's own
  // local frame the moment it lifts, then replayed from that node's world
  // matrix every frame. The carriage sits under the tilt pivot (see
  // lib/vehicleRig.js), so one matrix already carries the truck's position
  // and heading, the fork height and the mast tilt. The load therefore
  // stays exactly where it was picked up - including a shallow or
  // off-centre bite - and pitches with the mast, with no lag.
  const carriage = rig?.carriageLift || null

  const captureGrip = (pallet, engagement) => {
    if (!carriage) return { local: null, quat: null, insertDepth: engagement.insertDepth, seatedDepth: engagement.seatedDepth }
    carriage.updateWorldMatrix(true, false)
    pallet.updateWorldMatrix(true, false)
    carriage.getWorldQuaternion(carriageQuatRef.current)
    const world = pallet.getWorldPosition(gripLocalRef.current)
    // Only the *bite* is captured - how far in along the tines and how far
    // off their centreline the pallet is. Its height is the tines
    // themselves: measure from the deck it is being picked off rather than
    // from wherever the forks have already lifted or pitched it to, or that
    // head start is baked into the grip and the load rides that far above
    // the tines for the rest of the carry.
    world.y = 0
    const local = carriage.worldToLocal(world).clone()
    // Undo however far the carriage has already lifted: lift travels along
    // the carriage's local +Y (up the tilted mast), so this is its exact
    // inverse, and leaves an offset that holds at any fork height.
    local.y += forkHeightRef.current + PALLET_CARRY_Y
    return {
      local,
      quat: carriageQuatRef.current.clone().invert().multiply(pallet.getWorldQuaternion(gripQuatRef.current)),
      insertDepth: engagement.insertDepth,
      seatedDepth: engagement.seatedDepth,
    }
  }

  const applyGrip = (pallet, grip) => {
    if (carriage && grip?.local) {
      carriage.updateWorldMatrix(true, false)
      carriage.getWorldQuaternion(carriageQuatRef.current)
      pallet.position.copy(grip.local).applyMatrix4(carriage.matrixWorld)
      pallet.quaternion.copy(carriageQuatRef.current).multiply(grip.quat)
      return
    }
    // No carriage node in this vehicle's rig: pin the load to the fork tip
    // point instead. Same result minus lift and tilt, neither of which such
    // a model animates anyway.
    pallet.position.set(tipX, forkHeightRef.current + PALLET_CARRY_Y, tipZ)
    pallet.rotation.set(0, headingRef.current, 0)
  }

  // A load resting on the floor or a shelf is held up by that surface, not
  // by the tines. It keeps its own yaw, pitches only with a mast tilted
  // *back* - tilting forward would drive its far edge through the deck -
  // and rises just enough to keep its near edge on the surface as it does.
  const settleLoad = (pallet, surfaceY, halfDepth, pitch) => {
    palletEulerRef.current.setFromQuaternion(pallet.quaternion, 'YXZ')
    const yaw = palletEulerRef.current.y
    pallet.rotation.order = 'YXZ'
    pallet.rotation.set(pitch, yaw, 0)
    pallet.position.y = surfaceY + halfDepth * Math.sin(-pitch)
  }

  // How much of the mast's tilt a supported load actually shows.
  const restingPitch = () => Math.min(tiltAngleRef.current, 0)

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

  const dropLoad = (pallet, sim, reason, launchSpeed) => {
    sim.state = 'falling'
    sim.grip = null
    sim.engaged = false
    carriedIndexRef.current = -1
    sim.vx = forwardX * launchSpeed
    sim.vz = forwardZ * launchSpeed
    sim.vy = 0.1
    triggerFail(ctx, reason)
  }

  pallets.forEach((palletDef, i) => {
    const pallet = palletRefs.current[i]
    const sim = palletSimRef.current[i]
    if (!pallet || !sim) return
    const palletHalf = palletFootprintsRef.current[i] || PALLET_FALLBACK_FOOTPRINT

    if ((sim.state === 'ground' || sim.state === 'released') && carriedIndexRef.current === -1 && !failedRef.current) {
      const engagement = evaluateForkEngagement({
        palletX: pallet.position.x,
        palletZ: pallet.position.z,
        palletRot: pallet.rotation.y,
        palletHalf,
        vehicleX: posRef.current.x,
        vehicleZ: posRef.current.z,
        heading: headingRef.current,
        forkTipOffset: attachOffset,
        forkReach: attachReach,
      })
      const forksDown = forkHeightRef.current <= FORK_ENGAGE_HEIGHT

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
        settleLoad(pallet, forkHeightRef.current + PALLET_CARRY_Y, palletHalf.halfDepth, restingPitch())
      } else if (engagement.canEnter && forksDown && engagement.insertDepth > 0) {
        liveQuality = 'shallow'
      }

      if (sim.engaged && engineOnRef.current) {
        const overweight = (palletDef.weightKg ?? 0) > capacity
        if (failConditions.overload && overweight && forkHeightRef.current >= OVERLOAD_TIP_HEIGHT) {
          // Overload: the truck pitches forward and throws the load off.
          sim.engaged = false
          sim.state = 'falling'
          sim.vx = forwardX * (Math.abs(speedRef.current) + 0.5)
          sim.vz = forwardZ * (Math.abs(speedRef.current) + 0.5)
          sim.vy = 0.35
          tipStateRef.current.active = true
          triggerFail(ctx, 'overload')
        } else if (!overweight && forkHeightRef.current >= LIFT_THRESHOLD) {
          sim.engaged = false
          sim.state = 'carried'
          sim.slipCause = null
          carriedIndexRef.current = i
          onPalletEvent({ type: 'pallet-lifted', palletId: palletDef.id, weightKg: palletDef.weightKg }, 'carried')
        }
      }
    } else if (sim.state === 'carried') {
      liveQuality = gripQuality({ risk: sim.risk, canLift: true })

      // Rack-targeted pallets place directly from the carried state: the
      // learner holds the pallet at the target shelf's height, drives it
      // into the bay and tilts the mast forward to set it down, rather than
      // lowering to the ground like a dropZone delivery - a shelf is
      // elevated, so there is no "lower to release" step.
      const targetRack = palletDef.targetRack ? racks.find((rack) => rack.id === palletDef.targetRack) : null
      const targetHeight = targetRack && palletDef.targetLevel ? RACK_LEVEL_HEIGHTS[palletDef.targetLevel] : null
      const rackRot = targetRack?.rotation || 0
      // Lined up with the bay at any height is what puts a shelf under the
      // load instead of the floor; being at the *target* level as well is
      // what makes setting it down a delivery. The set-down itself happens
      // in the carry branch below, so the floor and the shelf are one rule.
      let inSlotRect = false
      let atTargetSlot = false

      if (targetRack && targetHeight != null) {
        const slot = toRectLocal(tipX, tipZ, { x: targetRack.position[0], z: targetRack.position[2], rotation: rackRot })
        inSlotRect = Math.abs(slot.x) <= RACK_SLOT_HALF_WIDTH && Math.abs(slot.z) <= slotReach
        atTargetSlot = inSlotRect && Math.abs(forkHeightRef.current - targetHeight) <= RACK_LEVEL_TOLERANCE
      }

      // Lined up at the target shelf, tilting forward is the correct move -
      // exempt it, or storing a heavy pallet up high would be impossible
      // whenever the tip-over rule is on.
      const tipsForward =
        failConditions.loadTipping &&
        !failedRef.current &&
        !atTargetSlot &&
        !sim.landed &&
        profile.hasForks &&
        forkHeightRef.current > LOAD_TIP_HEIGHT &&
        tiltAngleRef.current >= TILT_MAX_ANGLE * LOAD_TIP_TILT_RATIO &&
        (palletDef.weightKg ?? 0) > capacity * LOAD_TIP_WEIGHT_RATIO

      if (tipsForward) {
        // A heavy load, high up and tilted forward, puts the combined
        // centre of gravity past the front wheels.
        tipStateRef.current.active = true
        dropLoad(pallet, sim, 'load-tipping', Math.abs(speedRef.current) + 0.4)
      } else if (
        failConditions.highTravel &&
        !failedRef.current &&
        Math.abs(speedRef.current) > HIGH_TRAVEL_MIN_SPEED &&
        forkHeightRef.current > SAFE_TRAVEL_HEIGHT
      ) {
        // Driving at speed with the forks raised above standard travel
        // height: unsafe practice, not a physical spill - fail in place.
        triggerFail(ctx, 'high-travel')
      } else {
        // A partially engaged load creeps out along the tines when the
        // truck is braked hard, swung round or carried with the mast not
        // tilted back. A load seated to the carriage and square has risk 0
        // and never moves, which is the habit the step is teaching.
        if (!failedRef.current && sim.grip && !sim.landed) {
          const { slip, cause } = slipThisFrame({
            risk: sim.risk,
            tiltAngle: tiltAngleRef.current,
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

        if (!failedRef.current && sim.grip && depthRatio < SLIP_FAIL_RATIO) {
          dropLoad(pallet, sim, sim.slipCause || 'load-dropped', Math.max(Math.abs(prevSpeed), 0.35) * 1.15)
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

            const tiltedForward = !profile.hasForks || tiltAngleRef.current >= TILT_RELEASE_ANGLE
            const onTargetShelf = targetHeight != null && Math.abs(surfaceY - targetHeight) < 1e-3
            const steady = !onTargetShelf || Math.abs(speedRef.current) <= RACK_PLACE_MAX_SPEED

            if (tiltedForward && steady && !failedRef.current) {
              sim.grip = null
              sim.engaged = false
              sim.landed = false
              carriedIndexRef.current = -1
              settleLoad(pallet, surfaceY, palletHalf.halfDepth, 0)

              if (onTargetShelf) {
                // Square the delivered pallet up in its bay. The truck body
                // is stopped at the rack's face, so the load comes off the
                // tines at the mouth of the shelf rather than over its
                // middle - the only place they can reach.
                sim.state = 'delivered'
                pallet.position.set(targetRack.position[0], targetHeight, targetRack.position[2])
                pallet.rotation.set(0, rackRot, 0)
                deliveredCountRef.current += 1
                onPalletEvent(
                  {
                    type: 'pallet-delivered',
                    palletId: palletDef.id,
                    weightKg: palletDef.weightKg,
                    deliveredCount: deliveredCountRef.current,
                  },
                  'delivered',
                )
              } else {
                sim.state = 'released'
                onPalletEvent({ type: 'pallet-dropped', palletId: palletDef.id }, 'released')
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

    if (sim.state === 'released' && course.dropZone && !failedRef.current) {
      const inZone = Math.hypot(
        pallet.position.x - course.dropZone.position[0],
        pallet.position.z - course.dropZone.position[2],
      ) <= course.dropZone.radius
      const cleared = Math.hypot(pallet.position.x - tipX, pallet.position.z - tipZ) >= CLEAR_DISTANCE
      if (inZone && cleared) {
        sim.state = 'delivered'
        deliveredCountRef.current += 1
        onPalletEvent(
          {
            type: 'pallet-delivered',
            palletId: palletDef.id,
            weightKg: palletDef.weightKg,
            deliveredCount: deliveredCountRef.current,
          },
          'delivered',
        )
      }
    }
  })

  gripQualityRef.current = liveQuality
}
