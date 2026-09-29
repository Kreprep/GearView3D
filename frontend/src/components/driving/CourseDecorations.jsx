import { decorationType } from '../../lib/courseEdit'
import { RACK_SLOTS_BY_KIND } from '../../data/rackProfile'
import { ParkedVehicle } from './ParkedVehicle'
import { DecorRack } from './DecorRack'

// Renders decorative course furniture. Cones are not handled here - they're
// unified with course.obstacles into `liveCones` so every rendered cone is a
// live collider (see stepCollision.js), rendered once via <ObstacleCones>.
export function CourseDecorations({ decorations }) {
  return (
    <group>
      {decorations.map((item, index) => {
        if (item.type === 'wall') {
          return (
            <mesh
              key={index}
              position={[item.position[0], 0.3125, item.position[2]]}
              rotation={[0, item.rotation || 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.05, 0.625, item.length || 3]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.9} />
            </mesh>
          )
        }

        if (decorationType(item) === 'vehicle') {
          return (
            <ParkedVehicle
              key={index}
              position={[item.position[0], item.position[1] ?? 0, item.position[2]]}
              rotation={item.rotation}
            />
          )
        }

        if (RACK_SLOTS_BY_KIND[item.type]) {
          return <DecorRack key={index} type={item.type} position={item.position} rotation={item.rotation} />
        }

        return null
      })}
    </group>
  )
}
