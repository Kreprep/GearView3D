import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { EQUIPMENT_MODEL_URL } from '../../data/equipment'

// Static parked forklift used as a parking obstacle (park-between-vehicles
// scenario) - the same model the learner drives, drawn as authored, just not
// wired to the rig/keys.
export function ParkedVehicle({ position, rotation }) {
  const { scene } = useGLTF(EQUIPMENT_MODEL_URL)
  const cloned = useMemo(() => {
    const next = cloneSkeleton(scene)
    next.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    return next
  }, [scene])

  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      <primitive object={cloned} />
    </group>
  )
}
