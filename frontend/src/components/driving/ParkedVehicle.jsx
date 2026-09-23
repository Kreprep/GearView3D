import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { DEFAULT_MODEL_URL, fitVehicleModel } from '../../lib/driving/models'

// Static parked vehicle used as a parking obstacle (park-between-vehicles
// scenario) - the profile's parked model, just not wired to the rig/keys.
// `placement` stands it up the same way the driven vehicle is (see
// fitVehicleModel); the forklift fallback is always drawn as authored.
export function ParkedVehicle({ position, rotation, modelUrl, placement = null }) {
  const { scene } = useGLTF(modelUrl || DEFAULT_MODEL_URL)
  const cloned = useMemo(() => {
    const next = cloneSkeleton(scene)
    next.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    return next
  }, [scene])
  const fit = useMemo(() => fitVehicleModel(cloned, modelUrl ? placement : null), [cloned, modelUrl, placement])

  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      <group position={fit.position} scale={fit.scale}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}
