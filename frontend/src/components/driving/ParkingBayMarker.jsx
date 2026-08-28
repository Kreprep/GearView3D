import { Html } from '@react-three/drei'

export function ParkingBayMarker({ bay, parked }) {
  const width = bay.width ?? 1.3
  const depth = bay.depth ?? 1.9
  const stripe = 0.07
  const lineColor = parked ? '#22c55e' : '#f8fafc'

  return (
    <group position={[bay.position[0], 0.004, bay.position[2]]} rotation={[0, bay.heading || 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={parked ? '#166534' : '#1e3a5f'} transparent opacity={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[(side * width) / 2, 0, 0]}>
          <planeGeometry args={[stripe, depth]} />
          <meshBasicMaterial color={lineColor} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, depth / 2]}>
        <planeGeometry args={[width + stripe, stripe]} />
        <meshBasicMaterial color={lineColor} />
      </mesh>
      {!parked && (
        <Html center position={[0, 1.1, 0]} distanceFactor={8}>
          <div className="driving-checkpoint-label active">{bay.label || 'Parking Bay'}</div>
        </Html>
      )}
    </group>
  )
}
