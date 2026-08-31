import { RACK_MODEL_URL } from '../../data/rackProfile'
import { ModelProp } from './ModelProp'

// Static racking props. Solid: the truck body is blocked by, and fails
// against, a rack's footprint (see rackProfile.js). Only the forks reach into
// a bay, which is enough to place a pallet because the body stops roughly a
// fork-length short of the shelf.
export function CourseRacks({ racks }) {
  return (
    <group>
      {racks.map((rack, index) => (
        <group
          key={rack.id || index}
          position={[rack.position[0], rack.position[1] ?? 0, rack.position[2]]}
          rotation={[0, rack.rotation || 0, 0]}
        >
          <ModelProp url={RACK_MODEL_URL} />
        </group>
      ))}
    </group>
  )
}
