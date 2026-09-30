import { Html } from '@react-three/drei'
import { CARGO_BOX_MODEL_URL, palletModelForWeight, PALLET_DECK_Y } from '../../lib/driving/models'
import { ModelProp } from './ModelProp'

// A course pallet and its load. The group is what syncView() moves: its pose
// is the pallet's physics body's (lib/physics/world.js), whose colliders are
// laid out in this same frame, origin on the floor at the pallet's centre.
export function Pallet({ pallet, palletRef, overweight = false }) {
  const modelUrl = palletModelForWeight(pallet.weightKg)
  const cargoDeckY = PALLET_DECK_Y[modelUrl]

  return (
    <group ref={palletRef} position={[pallet.position[0], 0, pallet.position[2]]} rotation={[0, pallet.rotation || 0, 0]}>
      <ModelProp url={modelUrl} />
      {cargoDeckY != null && (
        <group position={[0, cargoDeckY, 0]}>
          <ModelProp url={CARGO_BOX_MODEL_URL} />
        </group>
      )}
      {typeof pallet.weightKg === 'number' && (
        <Html center position={[0, 0.85, 0]} distanceFactor={5}>
          <div className={`pallet-weight-label ${overweight ? 'overweight' : ''}`}>{pallet.weightKg} kg</div>
        </Html>
      )}
    </group>
  )
}
