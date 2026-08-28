import { useMemo } from 'react'

export function PathBreadcrumbs({ points }) {
  const dots = useMemo(() => {
    const result = []
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, , z1] = points[i]
      const [x2, , z2] = points[i + 1]
      const steps = Math.max(Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.4), 1)
      for (let step = 1; step <= steps; step += 1) {
        const t = step / (steps + 1)
        result.push([x1 + (x2 - x1) * t, 0.01, z1 + (z2 - z1) * t])
      }
    }
    return result
  }, [points])

  return (
    <group>
      {dots.map((point, index) => (
        <mesh key={index} position={point} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.08, 12]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  )
}
