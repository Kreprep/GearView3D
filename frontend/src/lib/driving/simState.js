import { Euler, Quaternion, Vector3 } from 'three'
import { palletPhysics } from '../../data/physicsProfile.js'
import { DECOR_RACK_KINDS, RACK_FOOTPRINT } from '../../data/rackProfile.js'
import { decorationType } from '../courseEdit.js'
import { resolveCapacityKg, resolveCourseBounds, resolveFailConditions } from '../courseGoals.js'
import { initialPalletState } from '../physics/palletState.js'
import { stabilityModel } from '../physics/stability.js'
import { FORKLIFT_RIG_GEOMETRY } from './rigGeometry.js'

// The driving simulation's state, as plain data (docs/revisions/
// post-defense-plan.md, section 3.2). The sim steps read and write only this
// and the course-derived `world` below; syncView() is the one place that
// copies it onto three.js objects. That split is what lets the sim run
// headless under node --test.
//
// Pallet and cone poses are three.js Vector3 / Quaternion / Euler values -
// maths types, not scene objects. Since Phase 7 they are read back from the
// physics world each step (stepPhysics.js), which holds the bodies
// themselves; the state keeps what the other steps, the safety rules and the
// view need to know about them.

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
// collider lists, bounds, the vehicle's footprint and rig geometry, the
// course's fails and rating, and scratch objects the steps reuse rather than
// reallocate every step.
export function createSimWorld(course, profile, geometry = FORKLIFT_RIG_GEOMETRY) {
  const racks = course.racks || []
  const { halfWidth, halfLength } = profile.footprint
  const bounds = resolveCourseBounds(course)
  const ratedCapacityKg = resolveCapacityKg(course)
  return {
    course,
    profile,
    geometry,
    checkpoints: course.checkpoints || [],
    pallets: coursePallets(course),
    racks,
    liveCones: courseCones(course),
    liveWalls: (course.decorations || []).filter((item) => item.type === 'wall' || decorationType(item) === 'vehicle'),
    // Racking is solid, functional and decorative alike. `id` is a
    // functional rack's, for telling a pallet's target rack from the rest.
    rackColliders: [...racks, ...(course.decorations || []).filter((item) => DECOR_RACK_KINDS.includes(item.type))].map((item) => ({
      id: item.id ?? null,
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
    // The load-handling fails the course switched on, its capacity plate and
    // the truck that plate describes (lib/physics/stability.js).
    failConditions: resolveFailConditions(course),
    ratedCapacityKg,
    stability: stabilityModel(ratedCapacityKg),
    scratch: {
      bodyRect: { x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 },
      otherRect: { x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 },
    },
  }
}

// What a pallet or the forks are touching, as stepPhysics reads it each step.
export const noTouch = () => ({ forks: false, tines: false, supported: false, rackId: null, rackLevel: null })

export function createSimState(course) {
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
    // `liftRate` is how fast the carriage is moving (scene units per second):
    // a hydraulic valve opens and closes over a moment, not at once.
    forks: { height: 0, tilt: 0, liftRate: 0 },
    // The tip-over. `axis` is which way the stability model saw it go
    // ('forward', 'left' or 'right'), `rate` and `yawRate` the rotation it
    // starts with (rad/s). From then on the truck is a body in the physics
    // world: `pose` is where that body is ({ position, quaternion }, null
    // until the first step after the onset) and `angle` how far it is off
    // upright.
    tip: { active: false, axis: null, rate: 0, yawRate: 0, pose: null, angle: 0 },
    // The stability margins of the last step (lib/physics/stability.js), how
    // long the truck has been past the point of tipping, and the rotation
    // the overturning moment has given it in that time (rad/s).
    stability: { longitudinalMargin: 1, lateralMargin: 1, tipping: null, unstableFor: 0, tipRate: 0 },
    failed: false,
    failReason: null,
    checkpointIndex: 0,
    pallets: coursePallets(course).map((def) => {
      const { kind, pallet, loadKg, footprint } = palletPhysics(def)
      const rotation = def.rotation || 0
      return {
        def,
        kind,
        footprint,
        // The load alone, which the capacity plate weighs, and with its
        // pallet, which the stability model carries.
        loadKg,
        massKg: loadKg + pallet.mass,
        position: new Vector3(def.position[0], 0, def.position[2]),
        quaternion: new Quaternion().setFromEuler(new Euler(0, rotation, 0)),
        // The same orientation as yaw-first Euler angles, for the 2D readers
        // (fork engagement, proximity), which want `rotation.y`.
        rotation: new Euler(0, rotation, 0, 'YXZ'),
        velocity: new Vector3(),
        // The centre of gravity, in world space.
        com: new Vector3(def.position[0], 0, def.position[2]),
        // Radians off level.
        lean: 0,
        touch: { ...noTouch(), supported: true },
        // Where it sits in the carriage's frame while the forks hold it, and
        // how fast it is sliding there (the load-shifting rule).
        forkLocal: null,
        slipSpeed: 0,
        ...initialPalletState(),
      }
    }),
    carriedIndex: -1,
    deliveredCount: 0,
    // Live fork-engagement quality for the HUD: 'none' | 'shallow' |
    // 'partial' | 'secure'.
    grip: 'none',
    // The load the forks are in or under, for the capacity plate and the
    // overload rule: { index, kg, centre (metres from the fork face),
    // deratedKg }, or null.
    load: null,
    cones: courseCones(course).map((cone) => ({
      hit: false,
      position: new Vector3(cone.position[0], 0, cone.position[2]),
      quaternion: new Quaternion(),
    })),
    // What the forks, or a load on them, are up against that does not move:
    // directions of travel that are blocked (unit vectors toward the
    // structure, with its kind), and whether lifting or lowering is.
    limits: { travel: [], lift: false, lower: false },
    // The contacts of the last step, by key, so the next can tell what has
    // only just begun to touch.
    touching: [],
    // When the operator last braked hard or cornered hard (state.time), for
    // naming why a load was lost.
    recent: { hardBrakeAt: null, sharpTurnAt: null },
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
