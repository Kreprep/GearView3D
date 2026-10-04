import { DIRECTIONS, neutralControls } from './controls.js'

// The operator dashboard as a control source (docs/revisions/
// post-defense-plan.md, sections 3.4 and 4.2): the cab's switches and the
// direction lever, set by clicks on components/driving/OperatorDashboard.jsx
// and by the keyboard's cab keys. Pure, like keyboardSource.js.
//
// The switches hold their position between steps, which is why they live
// here rather than in the keyboard source: B and Space toggle the same
// seatbelt and parking brake the dashboard shows, so the two never disagree.
//
// The simulation acts on the switches through the merged controls: the
// pre-start interlock reads the seatbelt, parking brake and lever
// (interlock.js), the parking brake holds the truck (stepDrive.js) and the
// parking goal wants it set with the lever in N (stepGoals.js). The lights,
// the beacon and the turn signals are view-side: nothing in the simulation
// reads them (the truck's lamps, components/driving/DrivingStage.jsx, and the
// inspection detectors, lib/inspection/detectors.js, do).

export const KEY_POSITIONS = ['off', 'on', 'start']
export const CAB_SWITCHES = ['seatbelt', 'parkingBrake', 'lights', 'beacon']
// The turn-signal stalk: off, or flashing one side.
export const TURN_SIGNALS = ['off', 'left', 'right']

// Switch faults a defect-test scenario can script (data/defectLibrary.js):
// 'springs-back' is a switch that goes on and then lets go, as a seat belt
// whose buckle will not latch does. SPRING_BACK_SECONDS is how long it stays.
export const SWITCH_FAULTS = ['springs-back']
export const SPRING_BACK_SECONDS = 0.6

// The cab's commands, by the names the keyboard and the wheel raise
// (keyboardSource's VIEW_COMMAND_BY_KEY and E, gamepad.js's COMMAND_ACTIONS),
// applied to a dashboard source. `engineOn` is the simulation's engine.
const CAB_COMMANDS = {
  engineToggle: (dashboard, engineOn) => dashboard.toggleEngine(engineOn),
  engine: (dashboard, engineOn) => dashboard.toggleEngine(engineOn),
  seatbeltToggle: (dashboard) => dashboard.toggle('seatbelt'),
  seatbelt: (dashboard) => dashboard.toggle('seatbelt'),
  parkingBrakeToggle: (dashboard) => dashboard.toggle('parkingBrake'),
  parkingBrake: (dashboard) => dashboard.toggle('parkingBrake'),
  horn: (dashboard) => dashboard.horn(),
  lights: (dashboard) => dashboard.toggle('lights'),
  beacon: (dashboard) => dashboard.toggle('beacon'),
  turnSignalLeft: (dashboard) => dashboard.signal('left'),
  turnSignalRight: (dashboard) => dashboard.signal('right'),
}

// Work a cab command on the dashboard. Returns false for a command that is
// not the cab's (the camera's and the inset's are the view's).
export function applyCabCommand(dashboard, command, engineOn) {
  const apply = CAB_COMMANDS[command]
  if (!apply) return false
  apply(dashboard, engineOn)
  return true
}

// Whether the cab's electrics are live: the key at ON (or the engine
// running). Lamps and the turn signals only work then, as on a real truck.
export const cabPowered = (switches, engineOn) => engineOn || switches.key !== 'off'

// `switchFaults` ({ [cabSwitch]: 'springs-back' }) is for the defect test's
// cab scenarios; a healthy cab has none. A switch that springs back is let
// go by tick(), which the viewer calls once per frame.
export function createDashboardSource({ switchFaults = {} } = {}) {
  const switches = {
    // START is momentary: it cranks the engine and springs back to ON.
    key: 'off',
    // null while the keyboard's automatic direction is in charge.
    lever: null,
    seatbelt: false,
    parkingBrake: false,
    lights: false,
    beacon: false,
    turnSignal: 'off',
  }
  let commands = []
  // Set by anything that moves a switch, so the viewer republishes the
  // telemetry at once instead of on its next 15 Hz tick.
  let changed = false
  const mark = () => {
    changed = true
  }
  // Seconds until each springing switch lets go.
  const releasing = {}
  const switchedOn = (name) => {
    if (switches[name] && switchFaults[name] === 'springs-back') releasing[name] = SPRING_BACK_SECONDS
  }

  return {
    switches,

    // True once after any switch moved.
    takeChanged() {
      const was = changed
      changed = false
      return was
    },

    // Turn the key. `engineOn` is the simulation's engine state, since
    // START on a running engine and OFF on a stopped one change nothing but
    // the key's position. START only asks: the simulation's interlock decides
    // whether the engine cranks.
    turnKey(position, engineOn) {
      if (!KEY_POSITIONS.includes(position)) return
      mark()
      if (position === 'start') {
        if (!engineOn) commands.push('engineStart')
        switches.key = 'on'
      } else {
        if (position === 'off' && engineOn) commands.push('engineStop')
        switches.key = position
      }
    },

    // The keyboard's E: start a stopped engine, stop a running one.
    toggleEngine(engineOn) {
      this.turnKey(engineOn ? 'off' : 'start', engineOn)
    },

    setLever(direction) {
      if (!DIRECTIONS.includes(direction)) return
      switches.lever = direction
      mark()
    },

    // Hand direction back to the keyboard's automatic F/R.
    releaseLever() {
      switches.lever = null
      mark()
    },

    toggle(name) {
      if (!CAB_SWITCHES.includes(name)) return
      switches[name] = !switches[name]
      switchedOn(name)
      mark()
    },

    set(name, value) {
      if (!CAB_SWITCHES.includes(name) || switches[name] === Boolean(value)) return
      switches[name] = Boolean(value)
      switchedOn(name)
      mark()
    },

    // Let go of any switch that springs back once its time is up.
    tick(dt) {
      for (const name of Object.keys(releasing)) {
        releasing[name] -= dt
        if (releasing[name] > 0) continue
        delete releasing[name]
        switches[name] = false
        mark()
      }
    },

    // Push the stalk to one side; pushing it to the side already flashing
    // cancels it.
    signal(side) {
      if (!TURN_SIGNALS.includes(side)) return
      switches.turnSignal = switches.turnSignal === side ? 'off' : side
      mark()
    },

    setSignal(side) {
      if (!TURN_SIGNALS.includes(side) || switches.turnSignal === side) return
      switches.turnSignal = side
      mark()
    },

    horn() {
      commands.push('horn')
    },

    // Edge-triggered commands since the last call ('engineStart',
    // 'engineStop', 'horn').
    drainCommands() {
      const drained = commands
      commands = []
      return drained
    },

    read() {
      const controls = neutralControls()
      controls.seatbelt = switches.seatbelt
      controls.parkingBrake = switches.parkingBrake
      if (switches.lever) {
        controls.direction = switches.lever
        controls.explicitDirection = true
      }
      return controls
    },
  }
}
