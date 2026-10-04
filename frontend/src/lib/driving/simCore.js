import { clamp } from '../math.js'
import { loadedRapier } from '../physics/rapier.js'
import { FORK_MAX_HEIGHT, TILT_BACK_MAX, TILT_FORWARD_MAX } from './constants.js'
import { normalizeControlFaults } from './controlFaults.js'
import { startInterlockMissing } from './interlock.js'
import { createSimState, createSimWorld } from './simState.js'
import { stepDrive } from './stepDrive.js'
import { stepCollisionBody, stepCollisionHazards } from './stepCollision.js'
import { stepForks } from './stepForks.js'
import { stepPallet } from './stepPallet.js'
import { createScenePhysics, stepPhysics, truckPoses } from './stepPhysics.js'
import { stepStability } from './stepStability.js'
import { stepCheckpoints, stepParking } from './stepGoals.js'

// The headless driving simulation: one course, one attempt. No three.js
// scene, no React, no browser - DrivingSimulationViewer runs it inside its
// frame loop (through simLoop.js, at a fixed step) and copies the state onto
// the scene with syncView.js; the characterization tests run it directly in
// node --test.
//
//   await loadRapier()               // once, before the first core
//   const core = createSimCore(course, profile)
//   core.command('engineStart')      // or 'engineStop'
//   core.step(SIM_DT, controls)      // controls: lib/driving/controls.js
//   core.drainEvents()               // what happened, in order
//   core.setFaults({ brakeFade })    // a defect scenario's control faults
//   core.dispose()                   // frees the physics world
//
// The truck is driven by the steps' own model. Pallets and cones are bodies
// in a Rapier physics world (lib/physics/world.js) that the core owns and
// stepPhysics steps; the world is built on the first step, so a core that is
// created and never stepped allocates nothing.
//
// Events (all plain data):
//   { type: 'engine', on }
//   { type: 'engine-blocked', missing }  the pre-start interlock refused a start
//   { type: 'fail', reason }
//   { type: 'checkpoint', index, checkpoint, isLast }
//   { type: 'pallet', event, nextState }   event is the viewer's pallet-* event
//   { type: 'parking', status, isParked }
//   { type: 'impact', what, speed }  something struck or landed hard enough to
//                                    hear: 'pallet' | 'cone' | 'landing' | 'structure'
export function createSimCore(course, profile, { geometry, rapier } = {}) {
  let world = createSimWorld(course, profile, geometry)
  const state = createSimState(course)
  let commands = []
  let events = []
  let physics = null
  let disposed = false

  const ensurePhysics = () => {
    if (!physics && !disposed) physics = createScenePhysics(rapier || loadedRapier(), state, world)
    return physics
  }

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
    // Editor preview runs) applies without restarting the attempt. The
    // physics world keeps the body it was built with until the next attempt.
    setProfile(nextProfile) {
      world = createSimWorld(course, nextProfile, geometry)
    },

    // Faults in the truck's controls (controlFaults.js) for the defect
    // test's cab scenarios; replaces the whole set. Off unless called.
    setFaults(faults) {
      state.faults = normalizeControlFaults(faults)
    },

    // The physics world, for the collider debug view: null until the first
    // step and after dispose().
    get physics() {
      return physics
    },

    // Queue an edge-triggered command; it applies at the start of the next
    // step.
    command(name) {
      commands.push(name)
    },

    // The ordered pipeline. Each step reads what the previous ones wrote on
    // state.frame, in this order.
    step(dt, controls) {
      if (!ensurePhysics()) return
      applyCommands(controls)
      stepDrive(state, world, controls, dt)
      stepCollisionBody(state, world)
      stepForks(state, world, dt)
      // The truck is where this step put it: move it in the physics world,
      // step that, and read the pallets and cones back. A truck that tipped
      // over last step (stepStability, below) becomes a body in that world
      // here, and is read back too.
      stepPhysics(state, world, physics, dt)
      stepCollisionHazards(state, world)
      stepCheckpoints(state, world)
      stepPallet(state, world, dt)
      stepStability(state, world, dt)
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

    // Free the physics world. The core does nothing after this.
    dispose() {
      disposed = true
      physics?.dispose()
      physics = null
    },

    // Test and automation hook (window.__drivingDebugSet): warp the truck and
    // forks directly instead of faking held keys. The cab switches
    // (seatbelt, parking brake, direction lever) are the dashboard source's,
    // so the viewer handles those itself. A load on the forks goes with
    // them: the truck is put there, it does not travel there.
    debugSet(patch = {}) {
      const { truck, forks } = state
      const held = state.pallets.flatMap((pallet, index) => (pallet.touch.forks ? [index] : []))
      if (typeof patch.x === 'number') truck.x = patch.x
      if (typeof patch.z === 'number') truck.z = patch.z
      if (typeof patch.heading === 'number') truck.heading = patch.heading
      if (typeof patch.speed === 'number') truck.speed = patch.speed
      if (typeof patch.forkHeight === 'number') forks.height = clamp(patch.forkHeight, 0, FORK_MAX_HEIGHT)
      if (typeof patch.tilt === 'number') forks.tilt = clamp(patch.tilt, -TILT_BACK_MAX, TILT_FORWARD_MAX)
      if (typeof patch.engineOn === 'boolean') truck.engineOn = patch.engineOn
      physics?.teleport(truckPoses(state, world.geometry), held)
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
        palletPositions: state.pallets.map(({ position }) => [position.x, position.y, position.z]),
        palletHeights: state.pallets.map((pallet) => pallet.position.y),
        palletLanded: state.pallets.map((pallet) => pallet.landed),
        palletOnForks: state.pallets.map((pallet) => pallet.touch.forks),
        palletSlipSpeeds: state.pallets.map((pallet) => pallet.slipSpeed),
        conesHit: state.cones.flatMap((cone, index) => (cone.hit ? [index] : [])),
        load: state.load,
        stability: { longitudinal: state.stability.longitudinalMargin, lateral: state.stability.lateralMargin },
        limits: state.limits,
        carriedIndex: state.carriedIndex,
        deliveredCount: state.deliveredCount,
        checkpointIndex: state.checkpointIndex,
        failed: state.failed,
        failReason: state.failReason,
        tipAngle: state.tip.angle,
        tipAxis: state.tip.axis,
        parkingStatus: state.parking.status,
        parked: state.parking.parked,
        time: state.time,
      }
    },
  }
}
