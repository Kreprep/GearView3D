import '../../test-helpers/browserGlobals.js'
import '../../test-helpers/physics.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runScenario } from '../../test-helpers/drivingScenarios.js'
import { createHeadlessDrive } from '../../test-helpers/headlessDrive.js'
import { MAX_STEER_ANGLE, TILT_BACK_MAX, TILT_FORWARD_MAX } from '../driving/constants.js'
import { m } from '../driving/units.js'
import { BRAKE_TEST_SPEED, deviceDetector, DETECTOR_IDS, LIFT_TEST_HEIGHT, LIFT_TEST_LOWERED, STEER_LOCK_SHARE, STOCK_DEVICE_DETECTORS } from './detectors.js'
import { createInspectionMonitor } from './inspectionMonitor.js'

// Each device test of the engine-on inspection, seen in a scripted drive on
// the headless core (docs/modules/module-improvements-plan.md, Phase 2: "each
// detector has a headless test driven through test-helpers/headlessDrive.js").
// The monitor watches every step, as the cab viewer's will every frame.

// An open pad like the inspection's: nothing to hit, no goal.
const PAD = { id: 'pad', start: { position: [0, 0, 0], heading: 0 }, checkpoints: [] }
const ALL_DEVICES = DETECTOR_IDS.filter((id) => id !== 'marker').map((id) => ({ id, detect: id }))

const NO_KEYS = {}
const hold = (keys) => () => keys
const idle = (frames = 1, extra = {}) => ({ name: 'idle', keys: hold(NO_KEYS), frames, ...extra })
const tap = (...press) => idle(1, { name: `tap ${press.join(' ')}`, press })
const startEngine = [
  { name: 'start sequence', cab: { seatbelt: true, parkingBrake: true }, engineToggle: true, keys: hold(NO_KEYS), frames: 1 },
  { name: 'release parking brake', cab: { parkingBrake: false }, keys: hold(NO_KEYS), frames: 1 },
]

// Drive `phases` with a monitor on `devices` watching. Returns the device ids
// tested, in order, and the final state.
function inspect(phases, { devices = ALL_DEVICES, beforeStep } = {}) {
  const monitor = createInspectionMonitor(devices)
  const sim = createHeadlessDrive(PAD, {
    afterStep(core, { switches, horn }) {
      if (horn) monitor.horn()
      beforeStep?.(monitor, core)
      monitor.update(core.state, { switches })
    },
  })
  runScenario({ phases }, { observe: sim.observe, frame: sim.frame })
  const result = { tested: monitor.tested(), state: sim.core.state, view: sim.view() }
  sim.dispose()
  return result
}

test('every stock device has a detector, and an unknown one falls back to its marker', () => {
  for (const detector of Object.values(STOCK_DEVICE_DETECTORS)) assert.ok(DETECTOR_IDS.includes(detector), detector)
  assert.equal(deviceDetector({ id: 'brakes' }), 'brake-test')
  assert.equal(deviceDetector({ id: 'brakes', detect: 'horn' }), 'horn')
  assert.equal(deviceDetector({ id: 'brakes', detect: 'no-such-detector' }), 'brake-test')
  assert.equal(deviceDetector({ id: 'admin-made-device' }), 'marker')
})

test('a cab that is only sitting there tests nothing', () => {
  assert.deepEqual(inspect([...startEngine, idle(120)]).tested, [])
})

test('horn: H, or the dashboard horn', () => {
  const { tested } = inspect([...startEngine, idle(10), tap('h'), idle(2)])
  assert.deepEqual(tested, ['horn'])
})

test('lights and beacon: their switches, with the cab powered', () => {
  // Key off: the switches move, but nothing lights.
  assert.deepEqual(inspect([tap('l', 'o'), idle(5)]).tested, [])
  const { tested } = inspect([...startEngine, tap('l'), idle(2), tap('o'), idle(2)])
  assert.deepEqual(tested, ['lights', 'beacon'])
})

test('turn signals: left and right, either order', () => {
  // One side, cancelled and pushed again: still only one side.
  assert.deepEqual(inspect([...startEngine, tap('['), idle(5), tap('['), idle(5), tap('['), idle(5)]).tested, [])
  const { tested } = inspect([...startEngine, tap(']'), idle(5), tap('['), idle(5)])
  assert.deepEqual(tested, ['turn-signals'])
})

test('backup alarm: in R with the engine running', () => {
  // S at a standstill puts the keyboard's automatic lever in R.
  const { tested } = inspect([...startEngine, { name: 'reverse', keys: hold({ back: true }), frames: 30 }])
  assert.deepEqual(tested, ['backup-alarm'])
})

test('steering: full lock each way at a standstill', () => {
  const lock = STEER_LOCK_SHARE * MAX_STEER_ANGLE
  // Which way A turned the rear wheels, so the D phase can wait for the other.
  let firstWay = 0
  const left = {
    name: 'left lock',
    keys: hold({ left: true }),
    until: (obs) => Math.abs(obs.steer) >= lock && Boolean((firstWay = Math.sign(obs.steer))),
    frames: 600,
  }
  const right = { name: 'right lock', keys: hold({ right: true }), until: (obs) => Math.abs(obs.steer) >= lock && Math.sign(obs.steer) === -firstWay, frames: 600 }
  // One way only is not the test.
  assert.deepEqual(inspect([...startEngine, left, idle(2)]).tested, [])
  const { tested } = inspect([...startEngine, left, idle(2), right, idle(2)])
  assert.deepEqual(tested, ['steer-lock'])
})

test('brakes: creep forward, then brake to a stop', () => {
  const creep = { name: 'creep', keys: hold({ forward: true }), until: (obs) => obs.speed >= BRAKE_TEST_SPEED * 1.2, frames: 600 }
  const brake = { name: 'brake', keys: hold({ back: true }), until: (obs) => obs.speed <= 0.001, frames: 600 }
  const { tested, view } = inspect([...startEngine, creep, brake, idle(2)], { devices: [{ id: 'brakes' }] })
  assert.deepEqual(tested, ['brakes'])
  assert.ok(view.z > 0)

  // Rolling to a stop without the brake is not a brake test.
  const coast = { name: 'coast', keys: hold(NO_KEYS), until: (obs) => obs.speed <= 0.001, frames: 1200 }
  assert.deepEqual(inspect([...startEngine, creep, coast, idle(2)], { devices: [{ id: 'brakes' }] }).tested, [])
})

test('lift and tilt: forks up and down, mast back and forward', () => {
  const raise = { name: 'raise', keys: hold({ raise: true }), until: (obs) => obs.forkHeight >= LIFT_TEST_HEIGHT + m(0.05), frames: 600 }
  const lower = { name: 'lower', keys: hold({ lower: true }), until: (obs) => obs.forkHeight <= LIFT_TEST_LOWERED, frames: 600 }
  const back = { name: 'tilt back', keys: hold({ tiltBack: true }), until: (obs) => obs.tilt <= -0.9 * TILT_BACK_MAX, frames: 600 }
  const forward = { name: 'tilt forward', keys: hold({ tiltForward: true }), until: (obs) => obs.tilt >= 0.9 * TILT_FORWARD_MAX, frames: 600 }
  // Raised and tilted but never lowered: not yet. (The forks are off the
  // floor for the forward tilt, which the floor would otherwise stop.)
  assert.deepEqual(inspect([...startEngine, raise, back, forward, idle(2)], { devices: [{ id: 'lift-tilt-functions' }] }).tested, [])
  const { tested } = inspect([...startEngine, raise, back, forward, lower, idle(2)], { devices: [{ id: 'lift-tilt-functions' }] })
  assert.deepEqual(tested, ['lift-tilt-functions'])
})

test('travel: half a metre forward and half a metre in reverse', () => {
  const stop = { name: 'stop', keys: hold({ back: true }), until: (obs) => obs.speed <= 0.001, frames: 600 }
  const forward = { name: 'forward', keys: hold({ forward: true }), until: (obs) => obs.z >= m(0.6), frames: 600 }
  const reverse = { name: 'reverse', keys: hold({ back: true }), until: (obs) => obs.z <= 0, frames: 900 }
  assert.deepEqual(inspect([...startEngine, forward, stop, idle(2)], { devices: [{ id: 'forward-reverse-travel' }] }).tested, [])
  const { tested } = inspect([...startEngine, forward, stop, idle(5), reverse, idle(2)], { devices: [{ id: 'forward-reverse-travel' }] })
  assert.deepEqual(tested, ['forward-reverse-travel'])
})

test('a device with no detector of its own is tested by clicking its marker', () => {
  const devices = [{ id: 'tail-lights' }, { id: 'admin-made-device' }]
  let frame = 0
  const { tested } = inspect([...startEngine, idle(10)], {
    devices,
    beforeStep(monitor) {
      frame += 1
      if (frame === 5) monitor.mark('admin-made-device')
      if (frame === 8) monitor.mark('tail-lights')
    },
  })
  assert.deepEqual(tested, ['admin-made-device', 'tail-lights'])
})

test('the monitor reads the simulation and never changes it', () => {
  const drive = [
    ...startEngine,
    tap('l', 'o', '['),
    { name: 'forward', keys: hold({ forward: true, left: true }), frames: 90 },
    tap('h', ']'),
    { name: 'brake', keys: hold({ back: true, raise: true }), frames: 90 },
  ]
  const watched = inspect(drive)
  const sim = createHeadlessDrive(PAD)
  runScenario({ phases: drive }, { observe: sim.observe, frame: sim.frame })
  const unwatched = sim.view()
  sim.dispose()
  assert.deepEqual(watched.view, unwatched)
  assert.ok(watched.tested.length > 0)
})
