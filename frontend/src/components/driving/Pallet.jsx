import { useEffect, useRef } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { CARGO_BOX_MODEL_URL, modelFootprint, palletModelForWeight, PALLET_DECK_Y } from '../../lib/driving/models'
import { ModelProp } from './ModelProp'

export function Pallet({ pallet, palletRef, overweight = false, onMeasure }) {
  const modelUrl = palletModelForWeight(pallet.weightKg)
  const cargoDeckY = PALLET_DECK_Y[modelUrl]
  const { scene } = useGLTF(modelUrl)
  const onMeasureRef = useRef(onMeasure)
  useEffect(() => {
    onMeasureRef.current = onMeasure
  }, [onMeasure])

  // The frame loop needs this pallet's real half-extents for both the fork
  // insertion maths and the solid-obstacle test, so report them up once the
  // model is in.
  useEffect(() => {
    onMeasureRef.current?.(modelFootprint(modelUrl, scene))
  }, [modelUrl, scene])

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
