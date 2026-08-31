import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { MODEL_TRANSFORM } from '../../lib/driving/models'

export function ModelProp({ url }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const next = cloneSkeleton(scene)
    next.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    return next
  }, [scene])
  const { scale, position } = MODEL_TRANSFORM[url]
  return <primitive object={cloned} scale={scale} position={position} />
}
