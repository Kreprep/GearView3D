import '../../test-helpers/browserGlobals.js'
import '../../test-helpers/physics.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drivingCourses } from '../../data/drivingCourse.js'
import { defaultVehicleProfile } from '../../data/vehicleProfile.js'
import { cockpitSnapshot, displayedDirection } from './cockpitTelemetry.js'
import { BRAKE_DECEL, KEYBOARD_YAW_RATE, MAX_REVERSE_SPEED, MAX_SPEED, MAX_STEER_ANGLE, STEER_SIGN } from './constants.js'
import { neutralControls } from './controls.js'
import { createCabGauges } from './cabGauges.js'
import { startInterlockMissing } from './interlock.js'
import { createKeyboardSource, keyboardSteerLimit } from './keyboardSource.js'
import { FORKLIFT_RIG_GEOMETRY, wheelbase } from './rigGeometry.js'
import { createSimCore } from './simCore.js'
import { SIM_DT } from './simLoop.js'
import { driveSpeed } from './stepDrive.js'
import { G, kmh } from './units.js'

const profile = defaultVehicleProfile('en')
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
const controls = (patch = {}) => ({ ...neutralControls(), ...patch })
const START = controls({ seatbelt: true, parkingBrake: true })
const running = { engineOn: true, locked: false }

// Run driveSpeed for `seconds` from `speed` with fixed controls.
function speedAfter(speed, input, seconds, state = running) {
  let value = speed
  for (let step = 0; step < Math.round(seconds / SIM_DT); step += 1) value = driveSpeed(value, input, state, SIM_DT)
  return value
}

function startedCore(courseId = 'accelerate-course') {
  const core = createSimCore(drivingCourses[courseId], profile)
  core.command('engineStart')
  core.step(SIM_DT, START)
  core.drainEvents()
  return core
}

// --- the pre-start interlock ---------------------------------------------------

test('the interlock wants the seatbelt, the parking brake and N', () => {
  assert.deepEqual(startInterlockMissing(controls()), ['seatbelt', 'parkingBrake'])
  assert.deepEqual(startInterlockMissing(controls({ seatbelt: true, direction: 'F' })), ['parkingBrake', 'neutral'])
  assert.deepEqual(startInterlockMissing(START), [])
})

test('a start the interlock refuses does not crank, and says what is missing', () => {
  const core = createSimCore(drivingCourses['accelerate-course'], profile)
  core.command('engineStart')
  core.step(SIM_DT, controls({ seatbelt: true }))
  assert.equal(core.state.truck.engineOn, false)
  assert.deepEqual(core.drainEvents(), [{ type: 'engine-blocked', missing: ['parkingBrake'] }])
  assert.deepEqual(core.debugSnapshot().interlockMissing, ['parkingBrake'])

  core.command('engineStart')
  core.step(SIM_DT, START)
  assert.equal(core.state.truck.engineOn, true)
  assert.deepEqual(core.drainEvents(), [{ type: 'engine', on: true }])
  assert.equal(core.state.interlock.at, null)

  // Stop needs no interlock, and a second stop does nothing.
  core.command('engineStop')
  core.command('engineStop')
  core.step(SIM_DT, controls())
  assert.deepEqual(core.drainEvents(), [{ type: 'engine', on: false }])
})

test('the cluster points at the unmet items after a refused start, until the engine runs', () => {
  const core = createSimCore(drivingCourses['accelerate-course'], profile)
  const snapshot = (input) =>
    cockpitSnapshot(core.state, drivingCourses['accelerate-course'], {
      controls: input,
      switches: { key: 'on', lever: null, seatbelt: input.seatbelt, parkingBrake: input.parkingBrake, lights: false },
      gauges: createCabGauges(),
      proximity: null,
    })
  assert.equal(snapshot(controls()).needSeatbelt, false, 'nothing marked before a start is tried')
  core.command('engineStart')
  core.step(SIM_DT, controls({ direction: 'F' }))
  let shown = snapshot(controls({ seatbelt: true, direction: 'F' }))
  // The seatbelt has since been fastened, so only the rest are marked.
  assert.deepEqual([shown.needSeatbelt, shown.needParkingBrake, shown.needNeutral], [false, true, true])
  core.command('engineStart')
  core.step(SIM_DT, START)
  shown = snapshot(START)
  assert.deepEqual([shown.needSeatbelt, shown.needParkingBrake, shown.needNeutral], [false, false, false])
})

test('the direction indicator shows a shifter lever over everything else', () => {
  const state = { truck: { speed: 0.5 } }
  const shifter = controls({ direction: 'R', explicitDirection: true })
  assert.equal(displayedDirection(state, shifter, { lever: null }), 'R')
  assert.equal(displayedDirection(state, controls(), { lever: null }), 'F')
})

// --- the drive train -----------------------------------------------------------

test('full throttle reaches the 8FGU25 top speed; part throttle a part speed', () => {
  close(speedAfter(0, controls({ throttle: 1, direction: 'F' }), 10), MAX_SPEED)
  close(speedAfter(0, controls({ throttle: 0.5, direction: 'F' }), 10), MAX_SPEED / 2)
  close(speedAfter(0, controls({ throttle: 1, direction: 'R' }), 10), -MAX_REVERSE_SPEED)
  // Easing off the pedal coasts back down to the lower target.
  close(speedAfter(MAX_SPEED, controls({ throttle: 0.5, direction: 'F' }), 20), MAX_SPEED / 2)
})

test('in N the throttle only revs the engine', () => {
  assert.equal(speedAfter(0, controls({ throttle: 1, direction: 'N' }), 3), 0)
})

test('full brake pedal is 0.5 g; half pedal half that', () => {
  close(driveSpeed(1, controls({ brake: 1 }), running, SIM_DT), 1 - BRAKE_DECEL * SIM_DT - 0.15 * SIM_DT)
  close(BRAKE_DECEL, 0.5 * G)
  const half = 1 - driveSpeed(1, controls({ brake: 0.5 }), running, SIM_DT)
  const full = 1 - driveSpeed(1, controls({ brake: 1 }), running, SIM_DT)
  assert.ok(half < full)
})

test('the parking brake holds the truck against the throttle and stops a moving one', () => {
  assert.equal(speedAfter(0, controls({ throttle: 1, direction: 'F', parkingBrake: true }), 3), 0)
  const stopped = speedAfter(kmh(10), controls({ parkingBrake: true }), 1.5)
  assert.equal(stopped, 0)
})

test('the inching pedal takes the drive away, then brakes', () => {
  const free = speedAfter(0, controls({ throttle: 1, direction: 'F' }), 1)
  const inched = speedAfter(0, controls({ throttle: 1, direction: 'F', inching: 0.5 }), 1)
  assert.ok(inched < free / 2, `${inched} vs ${free}`)
  assert.equal(speedAfter(0, controls({ throttle: 1, direction: 'F', inching: 0.7 }), 1), 0)
  // Fully down it is the service brake.
  const braked = speedAfter(1, controls({ inching: 1 }), 0.5)
  close(braked, Math.max(1 - 0.5 * (BRAKE_DECEL + 0.15), 0), 1e-6)
})

test('shuttling the lever to R while rolling forward slows the truck through zero and reverses', () => {
  let speed = kmh(8)
  let crossed = false
  for (let step = 0; step < 600; step += 1) {
    speed = driveSpeed(speed, controls({ throttle: 1, direction: 'R' }), running, SIM_DT)
    if (speed < 0) crossed = true
  }
  assert.ok(crossed)
  close(speed, -MAX_REVERSE_SPEED)
})

test('a failed attempt brakes the truck to a stop whatever the controls', () => {
  assert.equal(speedAfter(1, controls({ throttle: 1, direction: 'F' }), 1, { engineOn: true, locked: true }), 0)
})

// --- rear-wheel steer ------------------------------------------------------------

test('the truck yaws at v tan(steer) / wheelbase and the front axle does not slide sideways', () => {
  const core = startedCore('controls-intro')
  const input = controls({ throttle: 0.2, direction: 'F', steer: 0.5 })
  // Let the speed and the rear wheels settle.
  for (let step = 0; step < 600; step += 1) core.step(SIM_DT, input)
  const { truck } = core.state
  const before = { ...truck }
  core.step(SIM_DT, input)
  const yawRate = (truck.heading - before.heading) / SIM_DT
  close(yawRate, (truck.speed * Math.tan(truck.steer * STEER_SIGN)) / wheelbase(), 1e-3)
  close(truck.steer, 0.5 * MAX_STEER_ANGLE * STEER_SIGN, 1e-6)

  // The front axle's midpoint moved along the heading, with no sideways part.
  const axle = FORKLIFT_RIG_GEOMETRY.frontAxleZ
  const front = (pose) => [pose.x + Math.sin(pose.heading) * axle, pose.z + Math.cos(pose.heading) * axle]
  const [x0, z0] = front(before)
  const [x1, z1] = front(truck)
  const mid = (before.heading + truck.heading) / 2
  const sideways = (x1 - x0) * Math.cos(mid) - (z1 - z0) * Math.sin(mid)
  close(sideways, 0, 1e-9)
})

test('turning left swings the tail to the right', () => {
  const core = startedCore('controls-intro')
  const input = controls({ throttle: 0.05, direction: 'F', steer: 1 })
  for (let step = 0; step < 120; step += 1) core.step(SIM_DT, input)
  const { truck } = core.state
  assert.ok(truck.heading > 0.2, 'turned left')
  // The counterweight (behind the rear axle) has moved toward -X, to the
  // right of where the truck started, while the front turned left.
  const tailX = truck.x - Math.sin(truck.heading) * 0.29
  assert.ok(tailX < -0.02, `tail x ${tailX}`)
})

test('the keyboard steering limit keeps the pre-Phase 4 yaw at speed and allows full lock at a crawl', () => {
  assert.equal(keyboardSteerLimit(0), 1)
  assert.equal(keyboardSteerLimit(0.01), 1)
  const speed = 1.2
  const yaw = (speed * Math.tan(keyboardSteerLimit(speed) * MAX_STEER_ANGLE)) / wheelbase()
  close(yaw, KEYBOARD_YAW_RATE * (speed / 1.5), 1e-9)
  assert.ok(keyboardSteerLimit(1.2) < keyboardSteerLimit(0.3))
})

test('the keyboard wheel turns at its rate, is held to the limit at speed, and self-centres', () => {
  const keyboard = createKeyboardSource()
  const slow = { truck: { speed: 0 } }
  keyboard.keyDown('a')
  const first = keyboard.read(slow).steer
  assert.ok(first > 0 && first < 0.1, `${first}`)
  const fast = { truck: { speed: 1.2 } }
  let steer
  for (let step = 0; step < 60; step += 1) steer = keyboard.read(fast).steer
  close(steer, keyboardSteerLimit(1.2))
  keyboard.keyUp('a')
  for (let step = 0; step < 60; step += 1) steer = keyboard.read(fast).steer
  assert.equal(steer, 0)
})

// --- the parking goal -------------------------------------------------------------

test('secure parking needs the lever in N and the parking brake set before the engine goes off', () => {
  const core = startedCore('secure-parking')
  core.debugSet({ x: -2.6, z: 16, heading: 0, speed: 0 })
  const statuses = []
  const step = (input) => {
    core.step(SIM_DT, input)
    for (const event of core.drainEvents()) if (event.type === 'parking') statuses.push(event.status.replace('driving.parking.', ''))
  }
  step(controls({ direction: 'F', explicitDirection: true, seatbelt: true }))
  step(controls({ seatbelt: true }))
  step(controls({ seatbelt: true, parkingBrake: true }))
  core.command('engineStop')
  step(controls({ seatbelt: true, parkingBrake: true }))
  assert.deepEqual(statuses, ['neutral', 'parkingBrake', 'engineOff', 'done'])
  assert.equal(core.state.parking.parked, true)
})
