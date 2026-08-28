import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { DoubleSide } from 'three'

export function DropZoneMarker({ zone, delivered }) {
  const ringMaterialRef = useRef(null)

  useFrame(({ clock }) => {
    if (ringMaterialRef.current && !delivered) {
      ringMaterialRef.current.opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.25
    }
  })

  return (
    <group position={[zone.position[0], 0, zone.position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[Math.max(zone.radius - 0.1, 0.05), zone.radius, 48]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={delivered ? '#22c55e' : '#38bdf8'}
          transparent
          opacity={delivered ? 0.85 : 0.6}
          side={DoubleSide}
        />
      </mesh>
      {!delivered && (
        <Html center position={[0, 1.1, 0]} distanceFactor={8}>
          <div className="driving-checkpoint-label active">{zone.label || 'Drop Zone'}</div>
        </Html>
      )}
    </group>
  )
}
