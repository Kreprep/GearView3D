import { Euler, Vector3 } from 'three'
import { PALLET_FALLBACK_FOOTPRINT } from '../../data/palletProfile.js'
import { DECOR_RACK_KINDS, RACK_FOOTPRINT } from '../../data/rackProfile.js'
import { decorationType } from '../courseEdit.js'
import { resolveCourseBounds } from '../courseGoals.js'
import { FORKLIFT_RIG_GEOMETRY } from './rigGeometry.js'

// The driving simulation's state, as plain data (docs/revisions/
// post-defense-plan.md, section 3.2). The sim steps read and write only this
// and the course-derived `world` below; syncView() is the one place that
// copies it onto three.js objects. That split is what lets the sim run
// headless under node --test.
//
// Pallet poses are three.js Vector3/Euler values - maths types, not scene
// objects - because the fork/pallet maths is matrix work (see forkPose.js).
// The Euler keeps its own rotation order, as Object3D.rotation did, since the
// carry code switches a pallet to 'YXZ' and later adds to its pitch.

// Stored courses always use `pallets`; the singular `pallet` is the older
// hand-written shape kept working.
export function coursePallets(course) {
  return course.pallets || (course.pallet ? [course.pallet] : [])
}

// Every cone is a live collider, whether authored under `obstacles` or as a
// `decorations` lane/gate marker.
export function courseCones(course) {
  return [...(course.obstacles || []), ...(course.decorations || []).filter((item) => item.type === 'cone')]
}

// What the course contributes that does not change during an attempt:
// collider lists, bounds, the vehicle's footprint and rig geometry, and
// scratch objects the steps reuse rather than reallocate every step.
export function createSimWorld(course, profile, geometry = FORKLIFT_RIG_GEOMETRY) {
  const racks = course.racks || []
  const { halfWidth, halfLength } = profile.footprint
  const bounds = resolveCourseBounds(course)
  return {
    course,
    profile,
    geometry,
    checkpoints: course.checkpoints || [],
    pallets: coursePallets(course),
    racks,
    liveCones: courseCones(course),
    liveWalls: (course.decorations || []).filter((item) => item.type === 'wall' || decorationType(item) === 'vehicle'),
    // Racking is solid, functional and decorative alike.
    rackColliders: [...racks, ...(course.decorations || []).filter((item) => DECOR_RACK_KINDS.includes(item.type))].map((item) => ({
      x: item.position[0],
      z: item.position[2],
      rotation: item.rotation || 0,
      halfX: RACK_FOOTPRINT.halfWidth,
      halfZ: RACK_FOOTPRINT.halfDepth,
    })),
    halfWidth,
    halfLength,
    // Nose, middle and tail of the body, along its own centreline: the
    // points the wall check samples.
    bodySampleOffsets: [halfLength, 0, -halfLength],
    groundHalfWidth: bounds.halfWidth,
    courseMinZ: bounds.minZ,
    courseMaxZ: bounds.maxZ,
    scratch: {
      bodyRect: { x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 },
      otherRect: { x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 },
    },
  }
}

// `palletFootprint(def, index)` gives a pallet's half-extents. The viewer
// measures them off the loaded models and fills them in with
// setPalletFootprint(); until then, and headless, the fallback applies.
export function createSimState(course, { palletFootprint } = {}) {
  const start = course.start || { position: [0, 0, 0], heading: 0 }
  return {
    time: 0,
    truck: {
      x: start.position[0],
      y: start.position[1] ?? 0,
      z: start.position[2],
      heading: start.heading || 0,
      speed: 0,
      // Speed at the end of the previous step, for the sudden-stop check.
      prevSpeed: 0,
      // Rear-wheel steer angle (radians), damped toward the input.
      steer: 0,
      engineOn: false,
      // Distance rolled, so the view can spin each wheel by its own radius.
      wheelTravel: 0,
    },
    forks: { height: 0, tilt: 0 },
    // Overload / tip-over animation: the truck pitching about its front axle.
    tip: { active: false, angle: 0, vel: 0 },
    failed: false,
    failReason: null,
    checkpointIndex: 0,
    pallets: coursePallets(course).map((def, index) => ({
      def,
      footprint: palletFootprint?.(def, index) || PALLET_FALLBACK_FOOTPRINT,
      position: new Vector3(def.position[0], 0, def.position[2]),
      rotation: new Euler(0, def.rotation || 0, 0),
      state: 'ground',
      engaged: false,
      vx: 0,
      vy: 0,
      vz: 0,
      risk: 0,
      grip: null,
      slipCause: null,
      landed: false,
      restY: 0,
    })),
    carriedIndex: -1,
    deliveredCount: 0,
    // Live fork-engagement quality for the HUD: 'none' | 'shallow' |
    // 'partial' | 'secure'.
    grip: 'none',
    cones: courseCones(course).map(() => ({ hit: false, angle: 0, dirX: 0, dirZ: 1 })),
    parking: { parked: false, status: '' },
    // The last start the pre-start interlock refused: what was missing and
    // when (state.time), for the dashboard to point at. `at` is null once the
    // engine has started.
    interlock: { missing: [], at: null },
    // What the HUD shows that only changes on events.
    hud: {
      palletState: 'ground',
      carriedLoadKg: null,
    },
    // Events the steps raised this step, drained by the caller.
    events: [],
    // Per-step scratch the steps hand each other, in pipeline order.
    frame: {},
  }
}
