import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

// The GLB, cloned so two viewers mounted on the same URL cannot mutate each
// other's materials, with shadows enabled. Each viewer applies its own
// material pass on top.
export function useClonedScene(modelUrl) {
  const { scene } = useGLTF(modelUrl)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])

  useEffect(() => {
    cloned.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
  }, [cloned])

  return cloned
}
