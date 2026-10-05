// The headless simulation core behind the adapter the scripted drives run on
// (test-helpers/drivingScenarios.js, runScenario): the characterization test
// replays the golden trace through it, and the safety tests watch the same
// drives for the signs they should raise.

import assert from 'node:assert/strict'
import { defaultVehicleProfile } from '../data/vehicleProfile.js'
import { mergeControls } from '../lib/driving/controls.js'
import { applyCabCommand, createDashboardSource } from '../lib/driving/dashboardSource.js'
import { createKeyboardSource } from '../lib/driving/keyboardSource.js'
import { createSimCore } from '../lib/driving/simCore.js'
import { createSimLoop } from '../lib/driving/simLoop.js'
import { SCENARIO_DT } from './drivingScenarios.js'
import './physics.js'

const profile = defaultVehicleProfile('en')

const KEY_BY_HELD = {
  forward: 'w',
  back: 's',
  left: 'a',
  right: 'd',
  raise: 'r',
  lower: 'f',
  tiltBack: 't',
  tiltForward: 'g',
}

// The core, driven the way the viewer drives it: key events into the
// keyboard source, cab switches on the dashboard source, E through the
// dashboard's key switch, one fixed step per 1/60 s frame. `afterStep(core,
// cab)` runs after each step, for a test that watches the simulation as it
// goes (the safety monitor's, the inspection monitor's): `cab` is
// { switches, horn }, the dashboard's switches and whether the horn sounded
// this frame. `faults` are control faults for the core (lib/driving/
// controlFaults.js), off when left out.
export function createHeadlessDrive(course, { afterStep, faults } = {}) {
  const core = createSimCore(course, profile)
  if (faults) core.setFaults(faults)
  const keyboard = createKeyboardSource()
  const dashboard = createDashboardSource()
  const loop = createSimLoop((dt) => {
    const leverEngaged = dashboard.switches.lever !== null
    core.step(dt, mergeControls([keyboard.read(core.state, { leverEngaged, dt }), dashboard.read()]))
  })
  const events = []
  let frameNo = 0

  const view = () => {
    const { state } = core
    return {
      x: state.truck.x,
      z: state.truck.z,
      heading: state.truck.heading,
      speed: state.truck.speed,
      forkHeight: state.forks.height,
      tilt: state.forks.tilt,
      steer: state.truck.steer,
      grip: state.grip,
      checkpointIndex: state.checkpointIndex,
      failed: state.failed,
      tipAngle: state.tip.angle,
      tipAxis: state.tip.axis,
      longitudinalMargin: state.stability.longitudinalMargin,
      lateralMargin: state.stability.lateralMargin,
      carriedIndex: state.carriedIndex,
      deliveredCount: state.deliveredCount,
      parkingStatus: state.parking.status,
      parked: state.parking.parked,
      engineOn: state.truck.engineOn,
      pallets: state.pallets.map((pallet) => ({
        state: pallet.state,
        position: pallet.position,
        rotation: pallet.rotation,
        landed: pallet.landed,
        lean: pallet.lean,
        onForks: pallet.touch.forks,
        supported: pallet.touch.supported,
        slipSpeed: pallet.slipSpeed,
      })),
      cones: state.cones,
      load: state.load,
      missionIndex: state.mission?.index ?? null,
    }
  }

  // The old recorder logged events in the viewer's own vocabulary.
  const toRecorded = (event) => {
    if (event.type === 'engine') return { type: event.on ? 'engine-on' : 'engine-off' }
    if (event.type === 'engine-blocked') return { type: 'engine-blocked', missing: event.missing }
    if (event.type === 'fail') return { type: 'fail', reason: event.reason }
    if (event.type === 'checkpoint') return { type: event.isLast ? 'course-complete' : 'checkpoint', id: event.checkpoint.id }
    if (event.type === 'pallet') return { ...event.event, nextState: event.nextState }
    if (event.type === 'parking') return { type: 'parking', status: event.status, isParked: event.isParked }
    if (event.type === 'task') return { type: 'mission-task', id: event.task.id, index: event.index, isLast: event.isLast }
    // An impact's speed is a physics reading: rounded, like the samples.
    if (event.type === 'impact') return { type: 'impact', what: event.what, speed: Math.round(event.speed * 1e4) / 1e4 }
    return event
  }

  return {
    core,
    view,
    events,
    get frameNo() {
      return frameNo
    },
    observe: () => {
      const v = view()
      return { ...v, palletStates: v.pallets.map((pallet) => pallet.state) }
    },
    // Free the physics world once the drive is over.
    dispose: () => core.dispose(),
    // `press` taps keys that raise commands (H, L, O, [, ]), as the
    // keyboard does.
    frame(keys, { engineToggle, cab, press = [] }) {
      if (cab) {
        for (const name of ['seatbelt', 'parkingBrake', 'lights', 'beacon']) {
          if (typeof cab[name] === 'boolean') dashboard.set(name, cab[name])
        }
        if (cab.turnSignal) dashboard.setSignal(cab.turnSignal)
        if (cab.lever === null) dashboard.releaseLever()
        else if (cab.lever) dashboard.setLever(cab.lever)
      }
      for (const [held, key] of Object.entries(KEY_BY_HELD)) {
        if (keys[held] && !keyboard.held[held]) keyboard.keyDown(key)
        if (!keys[held] && keyboard.held[held]) keyboard.keyUp(key)
      }
      if (engineToggle) keyboard.keyDown('e')
      for (const key of press) {
        keyboard.keyDown(key)
        keyboard.keyUp(key)
      }
      for (const command of keyboard.drainCommands()) applyCabCommand(dashboard, command, core.state.truck.engineOn)
      // Every command reaches the core, as in the viewer; the horn's sound
      // is the view's, so the core only notes it (requireHorn checkpoints).
      let horn = false
      for (const command of dashboard.drainCommands()) {
        if (command === 'horn') horn = true
        core.command(command)
      }
      const { steps } = loop.advance(SCENARIO_DT)
      assert.equal(steps, 1, 'one fixed step per 1/60 s frame')
      afterStep?.(core, { switches: dashboard.switches, horn })
      for (const event of core.drainEvents()) events.push({ f: frameNo, ...toRecorded(event) })
      frameNo += 1
    },
  }
}
