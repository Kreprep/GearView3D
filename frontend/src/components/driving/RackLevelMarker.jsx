import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { DoubleSide } from 'three'
import { RACK_LEVEL_HEIGHTS, RACK_LEVEL_LABELS, RACK_SLOT_HALF_WIDTH } from '../../data/rackProfile'

// One target ring per pallet assigned to a rack level - the racking
// equivalent of DropZoneMarker, just floating at the shelf's height instead
// of sitting on the ground.
export function RackLevelMarker({ rack, level, delivered }) {
  const ringMaterialRef = useRef(null)
  const height = RACK_LEVEL_HEIGHTS[level] ?? 0

  useFrame(({ clock }) => {
    if (ringMaterialRef.current && !delivered) {
      ringMaterialRef.current.opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.25
    }
  })

  return (
    <group position={[rack.position[0], height, rack.position[2]]} rotation={[0, rack.rotation || 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[Math.max(RACK_SLOT_HALF_WIDTH - 0.06, 0.05), RACK_SLOT_HALF_WIDTH, 40]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={delivered ? '#22c55e' : '#a855f7'}
          transparent
          opacity={delivered ? 0.85 : 0.55}
          side={DoubleSide}
        />
      </mesh>
      {!delivered && (
        <Html center zIndexRange={[100, 0]} position={[0, 0.32, 0]} distanceFactor={4}>
          <div className="driving-checkpoint-label active">{RACK_LEVEL_LABELS[level] || level}</div>
        </Html>
      )}
    </group>
  )
}
