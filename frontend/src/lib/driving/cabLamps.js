import { engineOnDeviceEffects, resolveEffectLamps, walkAroundViewerHotspots } from '../../data/viewerHotspots.js'
import { cabPowered } from './dashboardSource.js'

// The truck's lamps the cab switches light (dashboardSource.js): headlights
// and tail lights with the lights switch, the beacon, and each side's turn
// signals. View-side: drawn on the truck in every driving step
// (components/driving/DrivingStage.jsx), never read by the simulation. Pure.
//
// Each lamp sits where the walk-around's device test shows it, derived from
// that device's hotspot (resolveEffectLamps()), in the colour and mode of
// its device effect, so the cab and the walk-around look the same. The
// driving scene uses the stock hotspots, which are measured against
// forklift.glb like DEFAULT_RIG; the cab inspection passes the live rows.
//
// The turn signals are the exception: their hotspot marks the stalk in the
// cab, which is what the walk-around asks about, so their lamps have mounts
// of their own (TURN_SIGNAL_MOUNTS, decision D-6).
//
// The model faces +Z, so +X is the operator's left.

// Where the turn-signal lamps sit on forklift.glb, in the model's frame:
// on the front face of the overhead guard's front legs, under the head
// lights, and on the rear face of its rear legs. Measured from the body
// mesh's vertices (the front legs' faces at |x| 0.116, z 0.153 at this
// height; the rear legs' at |x| 0.119, z -0.140), lamps standing just
// proud of them. Re-measure if forklift.glb is re-exported.
export const TURN_SIGNAL_MOUNTS = [
  [0.118, 0.35, 0.158],
  [-0.118, 0.35, 0.158],
  [0.121, 0.4, -0.145],
  [-0.121, 0.4, -0.145],
]

const CAB_LAMP_GROUPS = [
  { id: 'headlights', device: 'headlights', lit: (switches) => switches.lights },
  { id: 'tailLights', device: 'tail-lights', lit: (switches) => switches.lights },
  { id: 'beacon', device: 'warning-beacon', lit: (switches) => switches.beacon },
  { id: 'turnLeft', device: 'turn-signals', mounts: TURN_SIGNAL_MOUNTS, side: 'left', lit: (switches) => switches.turnSignal === 'left' },
  { id: 'turnRight', device: 'turn-signals', mounts: TURN_SIGNAL_MOUNTS, side: 'right', lit: (switches) => switches.turnSignal === 'right' },
]

const onSide = (side) => ([x]) => (side === 'left' ? x >= 0 : x < 0)

// Every lamp group with its positions: [{ id, lamps, color, radius, mode,
// lit(switches) }]. A group whose hotspot is missing has no lamps, unless it
// has mounts of its own.
export function cabLampMounts(hotspots = walkAroundViewerHotspots) {
  return CAB_LAMP_GROUPS.map(({ id, device, mounts, side, lit }) => {
    const effect = engineOnDeviceEffects[device]
    const hotspot = hotspots.find((entry) => entry.id === device)
    const lamps = mounts || resolveEffectLamps(effect, hotspot)
    return {
      id,
      lamps: side ? lamps.filter(onSide(side)) : lamps,
      color: effect.color,
      radius: effect.radius,
      mode: effect.mode,
      lit,
    }
  })
}

// Whether a group's lamps are lit: its switch on, with the cab powered.
export const cabLampLit = (group, switches, engineOn) => cabPowered(switches, engineOn) && group.lit(switches)
