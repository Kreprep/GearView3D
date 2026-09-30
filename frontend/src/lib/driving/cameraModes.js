// The driving simulation's camera (docs/revisions/post-defense-plan.md,
// section 4.1, as revised 2026-09-30): two views and a D-pad, as pure
// functions. cameraReducer() is the state machine the keyboard, the wheel's
// D-pad and the HUD buttons all drive; cameraPose() says where the camera
// sits and what it looks at for the rendered truck pose. stepCamera applies
// the pose; nothing here touches a scene object.
//
//   first-person  the operator's seat, plus drag-to-look (the default). The
//                 D-pad glances round the same kind of ring as chase: left
//                 from ahead looks 60 degrees left (the side and the rear
//                 corner, where the tail swings), left again looks behind,
//                 then 60 degrees right, then ahead again; right goes the
//                 other way. Down looks behind (for reversing) and up looks
//                 ahead, from anywhere on the ring. The view eases between
//                 glances rather than jumping.
//   chase         a camera that orbits the truck in four stops, stepped by
//                 D-pad left/right: behind (orbitable by mouse), the
//                 operator's left at fork height (fork height against
//                 pockets and shelves), in front looking back at the forks
//                 (lateral alignment with the pockets), and the right side.
//                 D-pad up lifts it overhead (heading-up); up again, or
//                 down, brings it back to the ground level stop. Left/right
//                 still step the orbit while overhead, so coming down lands
//                 on the new stop.
//   free          admin only, left entirely to OrbitControls
//
// At heading h the truck faces (sin h, cos h) and its left is (cos h, -sin h):
// +X is the operator's left at heading 0 (CLAUDE.md, CourseCanvas).

export const CAMERA_VIEWS = ['first-person', 'chase']
export const DEFAULT_CAMERA_VIEW = 'first-person'
// Admin-only, reachable from its own button, never by toggling.
export const FREE_CAMERA_VIEW = 'free'

// Chase stops in D-pad-left order: pressing left from behind swings the
// camera round to the truck's left.
export const ORBIT_STOPS = ['behind', 'left', 'front', 'right']
// First-person glances in D-pad-left order, and each one's look yaw off the
// truck's forward (positive turns left).
export const GLANCE_STOPS = ['ahead', 'left', 'behind', 'right']
const SIDE_GLANCE = (60 * Math.PI) / 180
export const GLANCE_YAW = { ahead: 0, left: SIDE_GLANCE, behind: Math.PI, right: -SIDE_GLANCE }

// The commands the camera answers, whatever raised them.
export const CAMERA_COMMANDS = ['cameraToggle', 'cameraLeft', 'cameraRight', 'cameraUp', 'cameraDown']

export function initialCameraState() {
  // `glanceCount` changes on every glance, so the viewer re-applies one
  // even when it repeats the last (after the learner dragged away from it).
  return { view: DEFAULT_CAMERA_VIEW, orbit: 0, overhead: false, glance: 'ahead', glanceCount: 0 }
}

const glanceTo = (state, glance) => ({ ...state, glance, glanceCount: state.glanceCount + 1 })
const stepGlance = (state, step) => glanceTo(state, GLANCE_STOPS[(GLANCE_STOPS.indexOf(state.glance) + step + GLANCE_STOPS.length) % GLANCE_STOPS.length])
const stepOrbit = (state, step) => ({ ...state, orbit: (state.orbit + step + ORBIT_STOPS.length) % ORBIT_STOPS.length })

// `command` is one of CAMERA_COMMANDS, or `view:<view>` to pick a view
// outright (the HUD buttons). Anything else returns the state unchanged.
export function cameraReducer(state, command) {
  if (command.startsWith('view:')) {
    const view = command.slice('view:'.length)
    if (view === state.view || ![...CAMERA_VIEWS, FREE_CAMERA_VIEW].includes(view)) return state
    return { ...state, view }
  }
  if (command === 'cameraToggle') {
    return { ...state, view: state.view === 'chase' ? 'first-person' : 'chase' }
  }
  if (state.view === 'first-person') {
    if (command === 'cameraLeft') return stepGlance(state, 1)
    if (command === 'cameraRight') return stepGlance(state, -1)
    if (command === 'cameraDown') return glanceTo(state, 'behind')
    if (command === 'cameraUp') return glanceTo(state, 'ahead')
    return state
  }
  if (state.view === 'chase') {
    if (command === 'cameraLeft') return stepOrbit(state, 1)
    if (command === 'cameraRight') return stepOrbit(state, -1)
    // Up toggles overhead; down only ever comes back down (there is no
    // stop below ground level).
    if (command === 'cameraUp') return { ...state, overhead: !state.overhead }
    if (command === 'cameraDown') return state.overhead ? { ...state, overhead: false } : state
  }
  return state
}

// The pose the camera is in, as a name: 'first-person', 'free', 'overhead'
// or one of ORBIT_STOPS. For styling and for the one stop the mouse can
// orbit (behind).
export function cameraShot(state) {
  if (state.view !== 'chase') return state.view
  return state.overhead ? 'overhead' : ORBIT_STOPS[state.orbit]
}

const CHASE_BACK = 2.6
const CHASE_UP = 1.5
const CHASE_LOOK_UP = 0.55
const TOP_HEIGHT = 3.2
const TOP_LOOK_AHEAD = 0.2
// The overhead camera sits this far behind the point it looks down at.
// Tilting it a fraction of a degree is what makes the truck's forward "up"
// on screen: a camera looking exactly straight down would have no up to
// keep, and changing camera.up instead would upset OrbitControls, which
// reads it once when it mounts.
const TOP_BACK_OFFSET = 0.01
// Where along the tines the side and front stops aim.
const FORK_MID = 0.45
const SIDE_DISTANCE = 1.3
const SIDE_UP = 0.12
const FRONT_AHEAD = 1.5
const FRONT_UP = 0.45
// The carriage's floor-level tine height, so the fork stops aim at the tines
// rather than the ground under them.
const TINE_BASE_Y = 0.02
const LOOK_DISTANCE = 5
// The seat looks this far below level (radians) before any drag, so the 3D
// steering wheel and levers sit above the 2D dashboard at the bottom of the
// screen instead of behind it, with the forks and the floor ahead in view.
export const FIRST_PERSON_PITCH = -0.2

// The yaw to ease toward for a glance, starting from the current look yaw:
// the equivalent angle nearest to it, so stepping round the ring keeps
// turning the way the D-pad was pressed (from behind, left carries on to
// 300 degrees rather than swinging back through ahead to -60).
export function glanceTargetYaw(glance, currentYaw) {
  const target = GLANCE_YAW[glance]
  const turn = Math.atan2(Math.sin(target - currentYaw), Math.cos(target - currentYaw))
  return currentYaw + turn
}

// `state`: a cameraReducer() state. `pose`: the rendered truck pose from
// syncView() ({ x, y, z, forwardX, forwardZ }). `view`: { forkHeight,
// seatOffset, lookYaw, lookPitch }. Returns { position, target }, each
// [x, y, z], or null for `free`. The camera's up stays +Y in every pose.
export function cameraPose(state, pose, view) {
  const { x, y, z, forwardX, forwardZ } = pose
  const leftX = forwardZ
  const leftZ = -forwardX
  const forkY = y + view.forkHeight + TINE_BASE_Y
  const along = (distance) => [x + forwardX * distance, z + forwardZ * distance]
  // The fork-side stops, from the operator's left (+1) or right (-1).
  const side = (sign) => {
    const [fx, fz] = along(FORK_MID)
    return {
      position: [fx + sign * leftX * SIDE_DISTANCE, forkY + SIDE_UP, fz + sign * leftZ * SIDE_DISTANCE],
      target: [fx, forkY, fz],
    }
  }

  switch (cameraShot(state)) {
    case 'first-person': {
      const [seatX, seatY, seatZ] = view.seatOffset
      const position = [x + seatX * leftX + seatZ * forwardX, y + seatY, z + seatX * leftZ + seatZ * forwardZ]
      // The look offset (dragged, or a glance) turns the view away from the
      // truck's own forward direction, so looking around never fights the
      // steering.
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
    case 'behind': {
      const [px, pz] = along(-CHASE_BACK)
      return { position: [px, y + CHASE_UP, pz], target: [x, y + CHASE_LOOK_UP, z] }
    }
    case 'overhead': {
      const [tx, tz] = along(TOP_LOOK_AHEAD)
      const [px, pz] = along(TOP_LOOK_AHEAD - TOP_BACK_OFFSET)
      return { position: [px, y + TOP_HEIGHT, pz], target: [tx, y, tz] }
    }
    case 'left':
      return side(1)
    case 'right':
      return side(-1)
    case 'front': {
      const [px, pz] = along(FORK_MID + FRONT_AHEAD)
      const [fx, fz] = along(FORK_MID)
      return { position: [px, forkY + FRONT_UP, pz], target: [fx, forkY, fz] }
    }
    default:
      return null
  }
}
