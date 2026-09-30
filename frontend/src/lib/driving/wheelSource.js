import { clamp } from '../math.js'
import { neutralControls } from './controls.js'
import {
  COMMAND_ACTIONS,
  findPad,
  inputPressed,
  PEDAL_ACTIONS,
  pedalFromAxis,
  rotationFor,
  steerFromAxis,
} from './gamepad.js'

// A steering wheel, pedals and shifter as a control source
// (docs/revisions/post-defense-plan.md, sections 3.4 and 4.3). Pure: the
// viewer polls navigator.getGamepads() once per frame (gamepadBrowser.js),
// hands the snapshot to update(), and reads controls like any other source.
//
// Everything goes through the bindings in the controller config
// (gamepad.js), so nothing here knows a device's axis or button numbers.
//
//   const wheel = createWheelSource(config)
//   wheel.update(pads)       // once per frame
//   wheel.read()             // operator controls, for mergeControls()
//   wheel.drainCommands()    // COMMAND_ACTIONS pressed since the last call

const SEQUENCE = ['R', 'N', 'F']
const DEG = Math.PI / 180

export function createWheelSource(initialConfig) {
  let config = initialConfig
  let pads = []
  let commands = []
  // Button actions held at the last update, for edge detection.
  let wasHeld = new Set()
  // Pedal axes that have moved at least once (see pedalFromAxis).
  const seenAxes = new Set()
  // The sequential shifter's position; H-pattern needs no memory.
  let sequential = 'N'

  const bound = (action) => config.bindings[action] || []
  const connected = (action) => bound(action).some((input) => findPad(pads, input.device))
  const held = (action) => bound(action).some((input) => inputPressed(pads, input))

  const axisReading = (action) => {
    const input = bound(action).find((candidate) => candidate.kind === 'axis')
    const pad = input && findPad(pads, input.device)
    if (!pad || typeof pad.axes[input.index] !== 'number') return null
    return { input, value: pad.axes[input.index] }
  }

  const hasHPattern = () => connected('gearForward') || connected('gearReverse')
  const hasSequential = () => connected('shiftUp') || connected('shiftDown')

  return {
    setConfig(next) {
      config = next
    },

    update(nextPads) {
      pads = nextPads
      for (const action of PEDAL_ACTIONS) {
        const reading = axisReading(action)
        if (reading && Math.abs(reading.value) > 1e-3) seenAxes.add(`${reading.input.device}#${reading.input.index}`)
      }

      const nowHeld = new Set()
      for (const action of [...COMMAND_ACTIONS, 'shiftUp', 'shiftDown']) {
        if (!held(action)) continue
        nowHeld.add(action)
        if (wasHeld.has(action)) continue
        if (action === 'shiftUp' || action === 'shiftDown') {
          const step = action === 'shiftUp' ? 1 : -1
          sequential = SEQUENCE[clamp(SEQUENCE.indexOf(sequential) + step, 0, SEQUENCE.length - 1)]
        } else {
          commands.push(action)
        }
      }
      wasHeld = nowHeld
      if (!hasSequential()) sequential = 'N'
    },

    read() {
      const controls = neutralControls()

      const steering = axisReading('steer')
      if (steering) {
        const wheelDeg = steerFromAxis(steering.value, steering.input) * (rotationFor(config, steering.input.device) / 2)
        // The axis runs -1 (left) .. 1 (right); steer is + for left.
        controls.steer = clamp(-wheelDeg / config.steeringLockDeg, -1, 1)
        controls.steeringWheelAngle = -wheelDeg * DEG
      }

      for (const action of PEDAL_ACTIONS) {
        const reading = axisReading(action)
        if (!reading) continue
        const seen = seenAxes.has(`${reading.input.device}#${reading.input.index}`)
        controls[action] = pedalFromAxis(reading.value, reading.input, seen)
      }

      controls.lift = held('liftUp') ? 1 : held('liftDown') ? -1 : 0
      controls.tilt = held('tiltBack') ? -1 : held('tiltForward') ? 1 : 0

      if (hasHPattern()) {
        controls.direction = held('gearReverse') ? 'R' : held('gearForward') ? 'F' : 'N'
        controls.explicitDirection = true
      } else if (hasSequential()) {
        controls.direction = sequential
        controls.explicitDirection = true
      }
      return controls
    },

    drainCommands() {
      const drained = commands
      commands = []
      return drained
    },

    // What is plugged in and bound, for the dashboard: whether a wheel is
    // steering, and whether a shifter owns the direction lever.
    status() {
      return { steering: Boolean(axisReading('steer')), shifter: hasHPattern() || hasSequential() }
    },
  }
}
