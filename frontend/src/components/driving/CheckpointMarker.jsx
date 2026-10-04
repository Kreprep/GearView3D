import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { DoubleSide } from 'three'

function RingCheckpointMarker({ checkpoint, status }) {
  const ringMaterialRef = useRef(null)
  const [x, , z] = checkpoint.position

  useFrame(({ clock }) => {
    if (ringMaterialRef.current && status === 'active') {
      ringMaterialRef.current.opacity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.3
    }
  })

  const color = status === 'done' ? '#22c55e' : status === 'active' ? '#f59e0b' : '#64748b'
  const baseOpacity = status === 'pending' ? 0.22 : 0.85

  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(checkpoint.radius - 0.08, 0.05), checkpoint.radius, 48]} />
        <meshBasicMaterial ref={ringMaterialRef} color={color} transparent opacity={baseOpacity} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.4, 8]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0.19, 1.28, 0]}>
        <planeGeometry args={[0.36, 0.22]} />
        <meshBasicMaterial color={color} side={DoubleSide} />
      </mesh>
      {status !== 'done' && (
        <Html center zIndexRange={[100, 0]} position={[0, 1.5, 0]} distanceFactor={8}>
          <div className={`driving-checkpoint-label ${status}`}>
            {checkpoint.type === 'stop' ? 'STOP - ' : ''}
            {checkpoint.label}
          </div>
        </Html>
      )}
    </group>
  )
}

function FinishLineMarker({ checkpoint, status }) {
  const [x, , z] = checkpoint.position
  const halfWidth = checkpoint.halfWidth ?? 3
  const segments = 10
  const segmentWidth = (halfWidth * 2) / segments
  const poleColor = status === 'done' ? '#22c55e' : '#94a3b8'

  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: segments }, (_, index) => {
        const segmentX = -halfWidth + segmentWidth * (index + 0.5)
        const dark = index % 2 === 0
        return (
          <mesh key={index} position={[segmentX, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[segmentWidth, 0.5]} />
            <meshBasicMaterial color={dark ? '#111827' : '#f8fafc'} />
          </mesh>
        )
      })}
      {[-halfWidth, halfWidth].map((poleX) => (
        <mesh key={poleX} position={[poleX, 0.9, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
          <meshStandardMaterial color={poleColor} />
        </mesh>
      ))}
      {status !== 'done' && (
        <Html center zIndexRange={[100, 0]} position={[0, 2.1, 0]} distanceFactor={9}>
          <div className={`driving-checkpoint-label ${status}`}>{checkpoint.label}</div>
        </Html>
      )}
    </group>
  )
}

export function CheckpointMarker({ checkpoint, status }) {
  if (checkpoint.shape === 'line') {
    return <FinishLineMarker checkpoint={checkpoint} status={status} />
  }

  return <RingCheckpointMarker checkpoint={checkpoint} status={status} />
}
