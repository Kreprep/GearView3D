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
// Phase 3 scope: the seatbelt and parking brake are real switches that the
// cluster lamps follow, but the simulation does not act on them yet. The
// pre-start interlock, the parking brake holding the truck and the parking
// goal's brake-and-neutral check arrive with the Phase 4 drive model.

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
    // the key's position.
    turnKey(position, engineOn) {
      if (!KEY_POSITIONS.includes(position)) return
      mark()
      if (position === 'start') {
        if (!engineOn) commands.push('engineToggle')
        switches.key = 'on'
      } else {
        if (position === 'off' && engineOn) commands.push('engineToggle')
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

    horn() {
      commands.push('horn')
    },

    // Edge-triggered commands since the last call ('engineToggle', 'horn').
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
