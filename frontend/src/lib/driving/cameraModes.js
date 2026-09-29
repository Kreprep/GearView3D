// The driving simulation's camera modes (docs/revisions/post-defense-plan.md,
// section 4.1), as pure pose functions: given the rendered truck pose they
// say where the camera sits and what it looks at. stepCamera
// applies them to the three.js camera; nothing here touches a scene object.
//
//   first-person  the operator's seat, plus drag-to-look (the default)
//   chase         behind and above, orbitable (the old default)
//   top           straight down over the truck, heading-up
//   side          from the operator's left at fork height: fork height
//                 against pockets and shelves
//   front         ahead of the forks looking back at them: lateral
//                 alignment with the pockets
//   free          admin only, left entirely to OrbitControls
//
// At heading h the truck faces (sin h, cos h) and its left is (cos h, -sin h):
// +X is the operator's left at heading 0 (CLAUDE.md, CourseCanvas).

export const CAMERA_MODES = ['first-person', 'chase', 'top', 'side', 'front']
export const DEFAULT_CAMERA_MODE = 'first-person'
// Admin-only, reachable from its own button, never by cycling.
export const FREE_CAMERA_MODE = 'free'

// Poses the viewer eases toward rather than jumps to, so a mode change or a
// turn doesn't snap the view. First-person rides the seat exactly.
export const EASED_MODES = new Set(['chase', 'top', 'side', 'front'])

const CHASE_BACK = 2.6
const CHASE_UP = 1.5
const CHASE_LOOK_UP = 0.55
const TOP_HEIGHT = 3.2
const TOP_LOOK_AHEAD = 0.2
// The top camera sits this far behind the point it looks down at. Tilting
// it a fraction of a degree is what makes the truck's forward "up" on
// screen: a camera looking exactly straight down would have no up to keep,
// and changing camera.up instead would upset OrbitControls, which reads it
// once when it mounts.
const TOP_BACK_OFFSET = 0.01
// Where along the tines the side and front views aim.
const FORK_MID = 0.45
const SIDE_DISTANCE = 1.3
const SIDE_UP = 0.12
const FRONT_AHEAD = 1.5
const FRONT_UP = 0.45
// The carriage's floor-level tine height, so the fork views aim at the tines
// rather than the ground under them.
const TINE_BASE_Y = 0.02
const LOOK_DISTANCE = 5
// The seat looks this far below level (radians) before any drag, so the 3D
// steering wheel and levers sit above the 2D dashboard at the bottom of the
// screen instead of behind it, with the forks and the floor ahead in view.
export const FIRST_PERSON_PITCH = -0.2

export function nextCameraMode(mode) {
  const index = CAMERA_MODES.indexOf(mode)
  return CAMERA_MODES[(index + 1) % CAMERA_MODES.length]
}

// `pose`: the rendered truck pose from syncView() ({ x, y, z, forwardX,
// forwardZ }). `view`: { forkHeight, seatOffset, lookYaw, lookPitch }.
// Returns { position, target }, each [x, y, z], or null for `free`. The
// camera's up stays +Y in every mode.
export function cameraPose(mode, pose, view) {
  const { x, y, z, forwardX, forwardZ } = pose
  const leftX = forwardZ
  const leftZ = -forwardX
  const forkY = y + view.forkHeight + TINE_BASE_Y
  const along = (distance) => [x + forwardX * distance, z + forwardZ * distance]

  switch (mode) {
    case 'first-person': {
      const [seatX, seatY, seatZ] = view.seatOffset
      const position = [x + seatX * leftX + seatZ * forwardX, y + seatY, z + seatX * leftZ + seatZ * forwardZ]
      // The dragged look offset turns the view away from the truck's own
      // forward direction, so looking around never fights the steering.
      const cosYaw = Math.cos(view.lookYaw)
      const sinYaw = Math.sin(view.lookYaw)
      const lookX = forwardX * cosYaw + forwardZ * sinYaw
      const lookZ = forwardZ * cosYaw - forwardX * sinYaw
      const pitch = FIRST_PERSON_PITCH + view.lookPitch
      const cosPitch = Math.cos(pitch)
      const target = [
        position[0] + lookX * cosPitch * LOOK_DISTANCE,
        position[1] + Math.sin(pitch) * LOOK_DISTANCE,
        position[2] + lookZ * cosPitch * LOOK_DISTANCE,
      ]
      return { position, target }
    }
    case 'chase': {
      const [px, pz] = along(-CHASE_BACK)
      return { position: [px, y + CHASE_UP, pz], target: [x, y + CHASE_LOOK_UP, z] }
    }
    case 'top': {
      const [tx, tz] = along(TOP_LOOK_AHEAD)
      const [px, pz] = along(TOP_LOOK_AHEAD - TOP_BACK_OFFSET)
      return { position: [px, y + TOP_HEIGHT, pz], target: [tx, y, tz] }
    }
    case 'side': {
      const [fx, fz] = along(FORK_MID)
      return {
        position: [fx + leftX * SIDE_DISTANCE, forkY + SIDE_UP, fz + leftZ * SIDE_DISTANCE],
        target: [fx, forkY, fz],
      }
    }
    case 'front': {
      const [px, pz] = along(FORK_MID + FRONT_AHEAD)
      const [fx, fz] = along(FORK_MID)
      return { position: [px, forkY + FRONT_UP, pz], target: [fx, forkY, fz] }
    }
    default:
      return null
  }
}
