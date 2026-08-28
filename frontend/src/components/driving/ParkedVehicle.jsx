import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { DEFAULT_MODEL_URL } from '../../lib/driving/models'

// Static parked vehicle used as a parking obstacle (park-between-vehicles
// scenario) - the profile's parked model, just not wired to the rig/keys.
export function ParkedVehicle({ position, rotation, modelUrl }) {
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
  return <primitive object={cloned} position={position} rotation={[0, rotation || 0, 0]} />
}
