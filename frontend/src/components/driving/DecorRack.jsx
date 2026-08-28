import { RACK_MODEL_URL, RACK_SLOTS_BY_KIND, rackSlotOffset } from '../../data/rackProfile'
import { CARGO_BOX_MODEL_URL, CARGO_BOX_STACK_MODEL_URL, PALLET_DECK_Y, PALLET_MODEL_LIGHT_URL } from '../../lib/driving/models'
import { ModelProp } from './ModelProp'

// Background-dressing rack: same model/scale as the functional rack (see
// data/rackProfile.js), plus a pallet+box on whichever slots RACK_SLOTS_BY_KIND
// gives its type - 'rack-empty' gets none. Purely a `decorations` entry: no
// id, no target, not graded. It is still solid, though - dressing the course
// with racking the truck can drive through would teach the wrong clearance.
export function DecorRack({ type, position, rotation }) {
  const boxUrl = type === 'rack-loaded' ? CARGO_BOX_STACK_MODEL_URL : CARGO_BOX_MODEL_URL
  return (
    <group position={[position[0], position[1] ?? 0, position[2]]} rotation={[0, rotation || 0, 0]}>
      <ModelProp url={RACK_MODEL_URL} />
      {(RACK_SLOTS_BY_KIND[type] || []).map((slot, index) => {
        const [x, y, z] = rackSlotOffset(slot)
        return (
          <group key={index} position={[x, y, z]}>
            <ModelProp url={PALLET_MODEL_LIGHT_URL} />
            <group position={[0, PALLET_DECK_Y[PALLET_MODEL_LIGHT_URL], 0]}>
              <ModelProp url={boxUrl} />
            </group>
          </group>
        )
      })}
    </group>
  )
}
