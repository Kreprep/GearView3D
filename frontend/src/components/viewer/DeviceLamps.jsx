import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Glowing lamps on the truck: the walk-around's device tests (the beacon
// flashing while it is tested) and, in the driving scene, the lamps the cab
// switches light. Positions are in the model's own frame, like the hotspots
// they come from (resolveEffectLamps() in data/viewerHotspots.js), so put
// them in the model's group.

// A lamp that is off still glows faintly, as an unlit lens does.
const OFF_LEVEL = 0.05

// One lamp. `blink` flashes it at about 2.5 Hz, otherwise it is steady.
// `isOn`, read every frame, switches it without a React render: switched off
// it is not drawn at all; a lamp with no `isOn` is always on. The light stays
// mounted while off, since adding or removing a light recompiles every
// material in the scene.
function DeviceLamp({ position, color, radius, blink, isOn }) {
  const meshRef = useRef(null)
  const lightRef = useRef(null)

  useFrame(({ clock }) => {
    const switchedOn = !isOn || isOn()
    const flashOn = blink ? Math.sin(clock.getElapsedTime() * 16) > 0 : true
    const level = switchedOn && flashOn ? 1 : switchedOn ? OFF_LEVEL : 0

    if (meshRef.current) {
      meshRef.current.visible = switchedOn
      meshRef.current.material.opacity = 0.35 + level * 0.55
      meshRef.current.material.emissiveIntensity = level * 3
    }
    if (lightRef.current) {
      lightRef.current.intensity = level * 1.6
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} transparent toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} color={color} distance={0.7} decay={2} />
    </group>
  )
}

// A set of lamps that light together: `lamps` positions, a `color`, a
// `radius` and a `mode` of 'blink' or 'steady' (a device effect's fields,
// data/viewerHotspots.js's engineOnDeviceEffects).
export function DeviceLamps({ lamps, color, radius = 0.04, mode = 'steady', isOn }) {
  if (!lamps?.length) return null

  return (
    <group>
      {lamps.map((position, index) => (
        <DeviceLamp
          key={`${position.join(',')}-${index}`}
          position={position}
          color={color}
          radius={radius}
          blink={mode === 'blink'}
          isOn={isOn}
        />
      ))}
    </group>
  )
}
