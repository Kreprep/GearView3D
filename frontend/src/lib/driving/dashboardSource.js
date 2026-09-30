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
// parking goal wants it set with the lever in N (stepGoals.js).

export const KEY_POSITIONS = ['off', 'on', 'start']
export const CAB_SWITCHES = ['seatbelt', 'parkingBrake', 'lights']

export function createDashboardSource() {
  const switches = {
    // START is momentary: it cranks the engine and springs back to ON.
    key: 'off',
    // null while the keyboard's automatic direction is in charge.
    lever: null,
    seatbelt: false,
    parkingBrake: false,
    lights: false,
  }
  let commands = []
  // Set by anything that moves a switch, so the viewer republishes the
  // telemetry at once instead of on its next 15 Hz tick.
  let changed = false
  const mark = () => {
    changed = true
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
      mark()
    },

    set(name, value) {
      if (!CAB_SWITCHES.includes(name) || switches[name] === Boolean(value)) return
      switches[name] = Boolean(value)
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
