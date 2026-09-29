import '../../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Group, Matrix4, Vector3 } from 'three'
import { drivingCourses } from '../../data/drivingCourse.js'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import { measuredPalletFootprint } from '../../test-helpers/drivingScenarios.js'
import { MAX_SPEED, STOP_SPEED_EPSILON, TIP_PIVOT_Y, TIP_PIVOT_Z } from './constants.js'
import { createKeyActiveTracker, legacyKeysFromControls, mergeControls, neutralControls } from './controls.js'
import { forkPose } from './forkPose.js'
import { createKeyboardSource } from './keyboardSource.js'
import { FORKLIFT_RIG_GEOMETRY, rigGeometryMismatches } from './rigGeometry.js'
import { createSimCore } from './simCore.js'
import { createSimLoop, MAX_STEPS, SIM_DT } from './simLoop.js'
import { createTelemetryStore } from './telemetry.js'
import { G, kmh, m, METRES_PER_UNIT, mps2, toKmh, toMetres } from './units.js'

const profile = defaultVehicleProfile('en')
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)

// --- units ----------------------------------------------------------------

test('units convert real values into the quarter-scale scene and back', () => {
  assert.equal(METRES_PER_UNIT, 4)
  close(m(4), 1)
  close(kmh(14.4), 1)
  close(mps2(9.81), G)
  close(toMetres(m(2.64)), 2.64)
  close(toKmh(kmh(17.6)), 17.6)
  // Today's top speed is 1.5 units/s, which the plan quotes as 21.6 km/h.
  close(toKmh(MAX_SPEED), 21.6)
})

// --- controls -------------------------------------------------------------

test('mergeControls: the largest analog magnitude wins, booleans OR together', () => {
  const merged = mergeControls([
    { ...neutralControls(), throttle: 0.3, steer: -0.2, horn: true },
    { ...neutralControls(), throttle: 0.8, steer: 0.1, lift: -1 },
    null,
  ])
  assert.equal(merged.throttle, 0.8)
  assert.equal(merged.steer, -0.2)
  assert.equal(merged.lift, -1)
  assert.equal(merged.horn, true)
})

test('mergeControls: an explicit lever beats the keyboard auto-direction', () => {
  const keyboard = { ...neutralControls(), throttle: 1, direction: 'F' }
  const shifter = { ...neutralControls(), direction: 'R', explicitDirection: true }
  assert.equal(mergeControls([keyboard, shifter]).direction, 'R')
  assert.equal(mergeControls([keyboard]).direction, 'F')
  assert.equal(mergeControls([neutralControls()]).direction, 'N')
  // A lever held in N is still an explicit choice.
  assert.equal(mergeControls([keyboard, { ...neutralControls(), explicitDirection: true }]).direction, 'N')
})

test('legacyKeysFromControls maps analog input onto the old letters', () => {
  assert.deepEqual(legacyKeysFromControls(neutralControls()), [])
  assert.deepEqual(legacyKeysFromControls({ ...neutralControls(), throttle: 0.5, direction: 'F', steer: 0.6 }), ['w', 'a'])
  assert.deepEqual(legacyKeysFromControls({ ...neutralControls(), throttle: 0.5, direction: 'R', steer: -0.6 }), ['s', 'd'])
  assert.deepEqual(legacyKeysFromControls({ ...neutralControls(), brake: 0.3, lift: 1, tilt: -1 }), ['s', 'r', 't'])
  assert.deepEqual(legacyKeysFromControls({ ...neutralControls(), lift: -0.5, tilt: 0.5 }), ['f', 'g'])
  // Below the threshold is resting a foot on the pedal, not pressing it.
  assert.deepEqual(legacyKeysFromControls({ ...neutralControls(), throttle: 0.1, direction: 'F', steer: 0.15 }), [])
})

test('the key-active tracker reports each letter once per press', () => {
  const tracker = createKeyActiveTracker()
  const w = { ...neutralControls(), throttle: 1, direction: 'F' }
  assert.deepEqual(tracker.update(w), ['w'])
  assert.deepEqual(tracker.update(w), [])
  assert.deepEqual(tracker.update(neutralControls()), [])
  assert.deepEqual(tracker.update(w, ['w']), ['w'])
  // A tap too short to reach any sim step still counts, via the source's own
  // letters.
  assert.deepEqual(tracker.update(neutralControls(), ['e', 'd']).sort(), ['d', 'e'])
})

// --- keyboard source -------------------------------------------------------

test('keyboard: W is throttle in F, S brakes then reverses in R', () => {
  const keyboard = createKeyboardSource()
  const at = (speed) => ({ truck: { speed } })

  keyboard.keyDown('w')
  assert.deepEqual(pick(keyboard.read(at(0))), { throttle: 1, brake: 0, direction: 'F' })
  keyboard.keyUp('w')
  assert.equal(keyboard.read(at(0.5)).direction, 'N')

  keyboard.keyDown('S')
  assert.deepEqual(pick(keyboard.read(at(0.5))), { throttle: 0, brake: 1, direction: 'F' })
  assert.deepEqual(pick(keyboard.read(at(STOP_SPEED_EPSILON))), { throttle: 1, brake: 0, direction: 'R' })
  assert.deepEqual(pick(keyboard.read(at(-0.3))), { throttle: 1, brake: 0, direction: 'R' })

  // W wins over S, as the old if/else did.
  keyboard.keyDown('w')
  assert.equal(keyboard.read(at(0.5)).direction, 'F')
})

function pick({ throttle, brake, direction }) {
  return { throttle, brake, direction }
}

test('keyboard: steering, lift and tilt, with the old key priorities', () => {
  const keyboard = createKeyboardSource()
  const state = { truck: { speed: 0 } }
  keyboard.keyDown('a')
  keyboard.keyDown('r')
  keyboard.keyDown('t')
  assert.deepEqual([keyboard.read(state).steer, keyboard.read(state).lift, keyboard.read(state).tilt], [1, 1, -1])
  keyboard.keyDown('d')
  keyboard.keyDown('f')
  keyboard.keyDown('g')
  // Both steering keys cancel; raise beats lower and tilt-back beats forward.
  assert.deepEqual([keyboard.read(state).steer, keyboard.read(state).lift, keyboard.read(state).tilt], [0, 1, -1])
})

test('keyboard: E queues one engine toggle per press, ignoring key repeat', () => {
  const keyboard = createKeyboardSource()
  assert.equal(keyboard.keyDown('e'), true)
  assert.equal(keyboard.keyDown('e', true), true)
  assert.deepEqual(keyboard.drainCommands(), ['engineToggle'])
  assert.deepEqual(keyboard.drainCommands(), [])
  assert.equal(keyboard.keyDown('x'), false)
})

test('keyboard: drainLetters reports held keys and taps since the last drain', () => {
  const keyboard = createKeyboardSource()
  keyboard.keyDown('d')
  keyboard.keyUp('d')
  keyboard.keyDown('w')
  assert.deepEqual(keyboard.drainLetters().sort(), ['d', 'w'])
  assert.deepEqual(keyboard.drainLetters(), ['w'])
})

// --- telemetry --------------------------------------------------------------

test('telemetry notifies only when a published snapshot differs', () => {
  const store = createTelemetryStore({ speed: 0, grip: 'none' })
  let calls = 0
  const unsubscribe = store.subscribe(() => {
    calls += 1
  })
  store.publish({ speed: 0, grip: 'none' })
  assert.equal(calls, 0)
  store.publish({ speed: 3, grip: 'none' })
  assert.equal(calls, 1)
  assert.equal(store.getSnapshot().speed, 3)
  unsubscribe()
  store.publish({ speed: 4, grip: 'none' })
  assert.equal(calls, 1)
})

// --- fixed-timestep loop ----------------------------------------------------

test('simLoop runs whole SIM_DT steps and returns the leftover as alpha', () => {
  let steps = 0
  const loop = createSimLoop(() => {
    steps += 1
  })
  for (let frame = 0; frame < 144; frame += 1) {
    const { alpha } = loop.advance(1 / 144)
    assert.ok(alpha >= 0 && alpha < 1)
  }
  assert.ok(steps === 59 || steps === 60, `one second at 144 Hz ran ${steps} steps`)
})

test('simLoop drops the backlog after MAX_STEPS instead of spiralling', () => {
  let steps = 0
  const loop = createSimLoop(() => {
    steps += 1
  })
  const { steps: ran, alpha } = loop.advance(2)
  assert.equal(ran, MAX_STEPS)
  assert.equal(steps, MAX_STEPS)
  assert.equal(alpha, 0)
})

// Controls scripted against *simulation* time, so every render rate asks for
// the same input on the same step. The fixed step then has to produce exactly
// the same attempt at 60 Hz, 144 Hz and a jittery rate.
function scriptedControls(time) {
  const controls = neutralControls()
  if (time < 2) {
    controls.throttle = 1
    controls.direction = 'F'
    controls.steer = time > 1 ? 1 : 0
  } else if (time < 3) {
    controls.brake = 1
    controls.lift = 1
  } else {
    controls.throttle = 1
    controls.direction = 'F'
    controls.steer = -1
    controls.tilt = -1
  }
  return controls
}

function driveAtRate(frameDeltas) {
  const core = createSimCore(drivingCourses['precision-carry'], profile, { palletFootprint: measuredPalletFootprint })
  core.command('engineToggle')
  const loop = createSimLoop((dt) => core.step(dt, scriptedControls(core.state.time)))
  let frame = 0
  while (core.state.time < 5 - 1e-9) {
    loop.advance(frameDeltas(frame))
    frame += 1
  }
  return core.debugSnapshot()
}

test('the same inputs drive the same attempt at 60 Hz, 144 Hz and a jittery rate', () => {
  const at60 = driveAtRate(() => 1 / 60)
  const at144 = driveAtRate(() => 1 / 144)
  const jittery = driveAtRate((frame) => [1 / 144, 1 / 90, 1 / 50, 1 / 120][frame % 4])
  assert.ok(at60.speed > 0 && at60.forkHeight > 0, 'the script actually drove')
  assert.deepEqual({ ...at144, time: 0 }, { ...at60, time: 0 })
  assert.deepEqual({ ...jittery, time: 0 }, { ...at60, time: 0 })
})

// --- headless core -----------------------------------------------------------

test('the headless core completes a course in node --test', () => {
  const core = createSimCore(drivingCourses['accelerate-course'], profile)
  core.command('engineToggle')
  const throttle = { ...neutralControls(), throttle: 1, direction: 'F' }
  const events = []
  for (let step = 0; step < 900 && !events.some((event) => event.isLast); step += 1) {
    core.step(SIM_DT, throttle)
    events.push(...core.drainEvents())
  }
  assert.deepEqual(events.map((event) => event.type), ['engine', 'checkpoint'])
  assert.equal(events[1].isLast, true)
  assert.equal(core.state.checkpointIndex, 1)
})

test('a failed attempt ignores the engine key', () => {
  const core = createSimCore(drivingCourses['rack-storage'], profile)
  core.debugSet({ z: 10 })
  core.command('engineToggle')
  const throttle = { ...neutralControls(), throttle: 1, direction: 'F' }
  for (let step = 0; step < 600 && !core.state.failed; step += 1) core.step(SIM_DT, throttle)
  assert.equal(core.state.failReason, 'rack')
  core.drainEvents()
  core.command('engineToggle')
  core.step(SIM_DT, throttle)
  assert.equal(core.state.truck.engineOn, true)
  assert.deepEqual(core.drainEvents(), [])
})

// --- fork pose ---------------------------------------------------------------

// Rebuild the scene-graph chain DrivingScene renders (truck group -> tip
// pivot -> offset -> tilt pivot at the mast foot -> carriage lift) and check
// forkPose() gives the same world matrix the old code read off the node.
test('forkPose matches the carriage node chain it replaced', () => {
  const truckGroup = new Group()
  const tipPivot = new Group()
  const offset = new Group()
  const tiltPivot = new Group()
  const carriageLift = new Group()
  truckGroup.add(tipPivot)
  tipPivot.add(offset)
  offset.add(tiltPivot)
  tiltPivot.add(carriageLift)
  tipPivot.position.set(0, TIP_PIVOT_Y, TIP_PIVOT_Z)
  offset.position.set(0, -TIP_PIVOT_Y, -TIP_PIVOT_Z)
  tiltPivot.position.set(...FORKLIFT_RIG_GEOMETRY.mastFoot)

  const state = {
    truck: { x: 1.3, y: 0, z: -4.2, heading: 0.7 },
    forks: { height: 0.37, tilt: -0.09 },
    tip: { angle: 0.25 },
  }
  truckGroup.position.set(state.truck.x, state.truck.y, state.truck.z)
  truckGroup.rotation.y = state.truck.heading
  tipPivot.rotation.x = state.tip.angle
  tiltPivot.rotation.x = state.forks.tilt
  carriageLift.position.y = state.forks.height
  carriageLift.updateWorldMatrix(true, false)

  const pose = forkPose(state)
  pose.elements.forEach((value, index) => close(value, carriageLift.matrixWorld.elements[index], 1e-12))

  // And the tine tip sits forkTipOffset ahead of the truck at rest.
  const level = forkPose({ truck: { x: 0, y: 0, z: 0, heading: 0 }, forks: { height: 0, tilt: 0 }, tip: { angle: 0 } }, undefined, new Matrix4())
  const origin = new Vector3().applyMatrix4(level)
  close(origin.z, FORKLIFT_RIG_GEOMETRY.mastFoot[2])
})

test('rigGeometryMismatches flags a re-exported model', () => {
  const rig = {
    forkTipOffset: FORKLIFT_RIG_GEOMETRY.forkTipOffset,
    forkReach: FORKLIFT_RIG_GEOMETRY.forkReach,
    wheels: { FL: { radius: FORKLIFT_RIG_GEOMETRY.wheelRadius.FL } },
  }
  assert.deepEqual(rigGeometryMismatches(rig), [])
  assert.equal(rigGeometryMismatches({ ...rig, forkTipOffset: 0.7 }).length, 1)
})
