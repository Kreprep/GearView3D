import { CONE_MODEL_URL } from '../../lib/driving/models'
import { ModelProp } from './ModelProp'

export function ObstacleCones({ obstacles, coneRefs }) {
  return (
    <group>
      {obstacles.map((item, index) => (
        <group
          key={index}
          ref={(el) => {
            coneRefs.current[index] = el
          }}
          position={[item.position[0], 0, item.position[2]]}
        >
          <ModelProp url={CONE_MODEL_URL} />
        </group>
      ))}
    </group>
  )
}
