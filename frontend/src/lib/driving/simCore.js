import { clamp } from '../math.js'
import { FORK_MAX_HEIGHT, TILT_BACK_MAX, TILT_FORWARD_MAX } from './constants.js'
import { startInterlockMissing } from './interlock.js'
import { createSimState, createSimWorld } from './simState.js'
import { stepDrive } from './stepDrive.js'
import { stepCollisionBody, stepCollisionHazards } from './stepCollision.js'
import { stepForks } from './stepForks.js'
import { stepFail } from './stepFail.js'
import { stepPallet } from './stepPallet.js'
import { stepCheckpoints, stepParking } from './stepGoals.js'

// The headless driving simulation: one course, one attempt. No three.js
// scene, no React, no browser - DrivingSimulationViewer runs it inside its
// frame loop (through simLoop.js, at a fixed step) and copies the state onto
// the scene with syncView.js; the characterization tests run it directly in
// node --test.
//
//   const core = createSimCore(course, profile)
//   core.command('engineStart')      // or 'engineStop'
//   core.step(SIM_DT, controls)      // controls: lib/driving/controls.js
//   core.drainEvents()               // what happened, in order
//
// Events (all plain data):
//   { type: 'engine', on }
//   { type: 'engine-blocked', missing }  the pre-start interlock refused a start
//   { type: 'fail', reason }
//   { type: 'checkpoint', index, checkpoint, isLast }
//   { type: 'pallet', event, nextState }   event is the viewer's pallet-* event
//   { type: 'parking', status, isParked }
export function createSimCore(course, profile, { palletFootprint, geometry } = {}) {
  let world = createSimWorld(course, profile, geometry)
  const state = createSimState(course, { palletFootprint })
  let commands = []
  let events = []

  // Commands apply against the controls of the step they land in, since the
  // interlock reads the seatbelt, parking brake and direction lever.
  const applyCommands = (controls) => {
    for (const command of commands) {
      // A failed attempt is frozen: the engine stays as it was.
      if (state.failed) continue
      const { truck } = state
      if (command === 'engineStart' && !truck.engineOn) {
        const missing = startInterlockMissing(controls)
        if (missing.length) {
          state.interlock = { missing, at: state.time }
          state.events.push({ type: 'engine-blocked', missing })
          continue
        }
        state.interlock = { missing: [], at: null }
        truck.engineOn = true
        state.events.push({ type: 'engine', on: true })
      } else if (command === 'engineStop' && truck.engineOn) {
        truck.engineOn = false
        state.events.push({ type: 'engine', on: false })
      }
    }
    commands = []
  }

  return {
    state,
    get world() {
      return world
    },

    // A new vehicle profile (an admin editing the footprint while the Course
    // Editor preview runs) applies without restarting the attempt.
    setProfile(nextProfile) {
      world = createSimWorld(course, nextProfile, geometry)
    },

    // Queue an edge-triggered command; it applies at the start of the next
    // step.
    command(name) {
      commands.push(name)
    },

    // The ordered pipeline. Each step reads what the previous ones wrote on
    // state.frame, in this order.
    step(dt, controls) {
      applyCommands(controls)
      stepDrive(state, world, controls, dt)
      stepCollisionBody(state, world)
      stepForks(state, dt)
      // The tip-over animation advances one step before whatever sets
      // tip.active (stepPallet, below), so a fail that starts the tip shows
      // its first degree of pitch on the next step. Kept from the original
      // frame loop; it changes no grading.
      stepFail(state, dt)
      stepCollisionHazards(state, world, dt)
      stepCheckpoints(state, world)
      stepPallet(state, world, dt)
      stepParking(state, world)
      state.truck.prevSpeed = state.truck.speed
      state.time += dt
      if (state.events.length) {
        events.push(...state.events)
        state.events.length = 0
      }
    },

    // Everything the steps raised since the last drain, in order.
    drainEvents() {
      const drained = events
      events = []
      return drained
    },

    setPalletFootprint(index, footprint) {
      if (state.pallets[index] && footprint) state.pallets[index].footprint = footprint
    },

    // Test and automation hook (window.__drivingDebugSet): warp the truck and
    // forks directly instead of faking held keys. The cab switches
    // (seatbelt, parking brake, direction lever) are the dashboard source's,
    // so the viewer handles those itself.
    debugSet(patch = {}) {
      const { truck, forks } = state
      if (typeof patch.x === 'number') truck.x = patch.x
      if (typeof patch.z === 'number') truck.z = patch.z
      if (typeof patch.heading === 'number') truck.heading = patch.heading
      if (typeof patch.speed === 'number') truck.speed = patch.speed
      if (typeof patch.forkHeight === 'number') forks.height = clamp(patch.forkHeight, 0, FORK_MAX_HEIGHT)
      if (typeof patch.tilt === 'number') forks.tilt = clamp(patch.tilt, -TILT_BACK_MAX, TILT_FORWARD_MAX)
      if (typeof patch.engineOn === 'boolean') truck.engineOn = patch.engineOn
    },

    // What window.__drivingDebug reports. The cab controls are the ones
    // the last step ran with.
    debugSnapshot() {
      const { truck, forks } = state
      const controls = state.frame.controls
      return {
        x: truck.x,
        z: truck.z,
        heading: truck.heading,
        speed: truck.speed,
        forkHeight: forks.height,
        tilt: forks.tilt,
        steer: truck.steer,
        engineOn: truck.engineOn,
        direction: controls?.direction ?? 'N',
        seatbelt: Boolean(controls?.seatbelt),
        parkingBrake: Boolean(controls?.parkingBrake),
        interlockMissing: state.interlock.missing,
        grip: state.grip,
        palletStates: state.pallets.map((pallet) => pallet.state),
        palletRisks: state.pallets.map((pallet) => pallet.risk),
        palletInsertDepths: state.pallets.map((pallet) => pallet.grip?.insertDepth ?? null),
        palletHeights: state.pallets.map((pallet) => pallet.position.y),
        palletLanded: state.pallets.map((pallet) => Boolean(pallet.landed)),
        carriedIndex: state.carriedIndex,
        deliveredCount: state.deliveredCount,
        checkpointIndex: state.checkpointIndex,
        failed: state.failed,
        failReason: state.failReason,
        tipAngle: state.tip.angle,
        parkingStatus: state.parking.status,
        parked: state.parking.parked,
        time: state.time,
      }
    },
  }
}
