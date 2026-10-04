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
// forklift.glb like DEFAULT_RIG; a caller with the live rows can pass them.
//
// The model faces +Z, so +X is the operator's left.

const CAB_LAMP_GROUPS = [
  { id: 'headlights', device: 'headlights', lit: (switches) => switches.lights },
  { id: 'tailLights', device: 'tail-lights', lit: (switches) => switches.lights },
  { id: 'beacon', device: 'warning-beacon', lit: (switches) => switches.beacon },
  { id: 'turnLeft', device: 'turn-signals', side: 'left', lit: (switches) => switches.turnSignal === 'left' },
  { id: 'turnRight', device: 'turn-signals', side: 'right', lit: (switches) => switches.turnSignal === 'right' },
]

const onSide = (side) => ([x]) => (side === 'left' ? x >= 0 : x < 0)

// Every lamp group with its positions: [{ id, lamps, color, radius, mode,
// lit(switches) }]. A group whose hotspot is missing has no lamps.
export function cabLampMounts(hotspots = walkAroundViewerHotspots) {
  return CAB_LAMP_GROUPS.map(({ id, device, side, lit }) => {
    const effect = engineOnDeviceEffects[device]
    const hotspot = hotspots.find((entry) => entry.id === device)
    const lamps = resolveEffectLamps(effect, hotspot)
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
