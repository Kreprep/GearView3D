// Phase 2 physics spike (docs/revisions/post-defense-plan.md, section 5):
// can a pallet sit on two thin kinematic tines at quarter scale without
// jittering, and do friction and inertia do the rest - slide under hard
// braking, hold when the mast is tilted back, tip off a single tine?
//
// A minimal Rapier world: the floor, one kinematic carriage body carrying the
// two tines and the backrest, and one dynamic pallet with its load as a
// compound body whose fork pockets are open. No truck body, no course. The
// scripted motions in FORK_SPIKE_SCENARIOS drive the carriage; forkSpike.test.js
// measures the result and dev/PhysicsSpike.jsx shows it.
//
// Phase 7 replaces this with lib/physics/world.js, and the test's scenarios
// move to the real world's headless tests.
import { FORKLIFT_RIG_GEOMETRY } from '../driving/rigGeometry.js'
import { SIM_DT } from '../driving/simLoop.js'
import { G, kmh, m, mps2 } from '../driving/units.js'
import { FORK_COLLIDERS, FRICTION, PHYSICS_WORLD, TINE, TINE_HEEL_Z, WOODEN_PALLET } from '../../data/physicsProfile.js'

// A load on a wooden pallet: a 1.12 m cube-ish stack, 1 m tall.
export const DEFAULT_LOAD = { kg: 500, half: [m(0.56), m(0.5), m(0.56)] }

const [, MAST_FOOT_Y, MAST_FOOT_Z] = FORKLIFT_RIG_GEOMETRY.mastFoot

// Carriage pose for a truck at (truckX, truckZ) heading +Z, with the tine
// undersides `height` above the floor and the mast tilted by `tilt` radians
// about its foot (positive = forward, tips down), as the sim's forks are.
export function carriagePose({ truckX = 0, truckZ = 0, height = 0, tilt = 0 }) {
  const y = height - MAST_FOOT_Y
  const z = TINE_HEEL_Z - MAST_FOOT_Z
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  return {
    translation: { x: truckX, y: MAST_FOOT_Y + y * cos - z * sin, z: truckZ + MAST_FOOT_Z + y * sin + z * cos },
    rotation: { x: Math.sin(tilt / 2), y: 0, z: 0, w: Math.cos(tilt / 2) },
  }
}

function volume(half) {
  return 8 * half[0] * half[1] * half[2]
}

// Rotate v by the unit quaternion q (or by its inverse).
function rotate(q, v, inverse = false) {
  const qx = inverse ? -q.x : q.x
  const qy = inverse ? -q.y : q.y
  const qz = inverse ? -q.z : q.z
  const { w } = q
  const tx = 2 * (qy * v.z - qz * v.y)
  const ty = 2 * (qz * v.x - qx * v.z)
  const tz = 2 * (qx * v.y - qy * v.x)
  return {
    x: v.x + w * tx + (qy * tz - qz * ty),
    y: v.y + w * ty + (qz * tx - qx * tz),
    z: v.z + w * tz + (qx * ty - qy * tx),
  }
}

/**
 * Builds the spike world. Options:
 * - settings: PHYSICS_WORLD overrides (lengthUnit, dt, substeps, solverIterations)
 * - pallet: a pallet from data/physicsProfile.js, placed at palletPosition
 * - load: { kg, half } or null for an empty pallet
 * - tineThicknessScale: collision tines thicker than the visual ones (a
 *   fallback lever from the plan; 1 = measured)
 * - tineFriction: steel-on-wood override
 * - ccd: continuous collision detection on the pallet (default on)
 */
export function createForkSpike(RAPIER, options = {}) {
  const settings = { ...PHYSICS_WORLD, ...options.settings }
  const pallet = options.pallet ?? WOODEN_PALLET
  const load = options.load === undefined ? DEFAULT_LOAD : options.load
  const [palletX, palletZ] = options.palletPosition ?? [0, 1]
  const tineThicknessScale = options.tineThicknessScale ?? 1
  const tineFriction = options.tineFriction ?? FRICTION.steelOnWood

  const world = new RAPIER.World(new RAPIER.Vector3(...settings.gravity))
  world.timestep = settings.dt
  world.lengthUnit = settings.lengthUnit
  world.numSolverIterations = settings.solverIterations

  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(10, 0.05, 10).setTranslation(0, -0.05, 0).setFriction(FRICTION.woodOnConcrete),
    floor,
  )

  let forks = { truckX: 0, truckZ: 0, height: 0, tilt: 0 }
  const initialPose = carriagePose(forks)
  const carriage = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(initialPose.translation.x, initialPose.translation.y, initialPose.translation.z)
      .setRotation(initialPose.rotation),
  )
  FORK_COLLIDERS.forEach(({ center, half }, index) => {
    const isTine = index < 2
    const thickness = isTine ? half[1] * tineThicknessScale : half[1]
    // A thicker collision tine grows downwards, so its top - what the load
    // sits on - stays where the visual tine's is.
    const centreY = isTine ? TINE.thickness - thickness : center[1]
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(half[0], thickness, half[2])
        .setTranslation(center[0], centreY, center[2])
        .setFriction(tineFriction)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
      carriage,
    )
  })

  const palletBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(palletX, 0.0005, palletZ)
      .setCcdEnabled(options.ccd ?? true),
  )
  const palletVolume = pallet.colliders.reduce((sum, { half }) => sum + volume(half), 0)
  const addBox = ({ center, half }, density) => world.createCollider(
    RAPIER.ColliderDesc.cuboid(...half)
      .setTranslation(...center)
      .setDensity(density)
      .setFriction(FRICTION.woodOnConcrete),
    palletBody,
  )
  pallet.colliders.forEach((collider) => addBox(collider, pallet.mass / palletVolume))
  if (load) {
    const loadBox = pallet.load ?? { center: [0, pallet.height + load.half[1], 0], half: load.half }
    addBox(loadBox, load.kg / volume(loadBox.half))
  }

  // Kinematic targets are interpolated across the substeps, so Rapier sees
  // the carriage move smoothly rather than jump once per sim step.
  function step(nextForks) {
    const from = forks
    const to = { ...forks, ...nextForks }
    for (let i = 1; i <= settings.substeps; i += 1) {
      const t = i / settings.substeps
      const pose = carriagePose({
        truckX: from.truckX + (to.truckX - from.truckX) * t,
        truckZ: from.truckZ + (to.truckZ - from.truckZ) * t,
        height: from.height + (to.height - from.height) * t,
        tilt: from.tilt + (to.tilt - from.tilt) * t,
      })
      carriage.setNextKinematicTranslation(pose.translation)
      carriage.setNextKinematicRotation(pose.rotation)
      world.step()
    }
    forks = to
  }

  // The pallet's pose in the carriage's frame: what "resting on the forks"
  // means, independent of where the truck is.
  function palletOnForks() {
    const carriagePosition = carriage.translation()
    const carriageRotation = carriage.rotation()
    const position = palletBody.translation()
    const relative = rotate(carriageRotation, {
      x: position.x - carriagePosition.x,
      y: position.y - carriagePosition.y,
      z: position.z - carriagePosition.z,
    }, true)
    const up = rotate(palletBody.rotation(), { x: 0, y: 1, z: 0 })
    const velocity = palletBody.linvel()
    const carriageVelocity = carriage.linvel()
    return {
      position: relative,
      // Angle between the pallet's up axis and the world's, radians.
      lean: Math.acos(Math.min(1, Math.max(-1, up.y))),
      relativeSpeed: Math.hypot(
        velocity.x - carriageVelocity.x,
        velocity.y - carriageVelocity.y,
        velocity.z - carriageVelocity.z,
      ),
    }
  }

  return {
    RAPIER,
    world,
    carriage,
    palletBody,
    get forks() {
      return forks
    },
    step,
    palletOnForks,
    dispose: () => world.free(),
  }
}

// --- Scripted motions --------------------------------------------------------
// A scenario is a list of segments. Each segment runs until its `until`
// condition holds or its `duration` passes, applying rates to the truck and
// forks: `speed` sets the truck's speed outright, `accel` changes it, `lift`
// and `tiltRate` move the forks. `mark` names the moment a segment starts so
// the test can measure from it.

const FULL_LIFT = 0.8
const TRAVEL_HEIGHT = m(0.2)
const TILT_BACK_MAX = -0.192 // 11 degrees, the 8FGU25's back tilt
const LIFT_SPEED = m(0.6) // per second
const TILT_SPEED = 0.1 // rad per second
const TRAVEL_SPEED = kmh(10)
export const HARD_BRAKE = mps2(0.5 * 9.81)
export const GENTLE_BRAKE = mps2(0.25 * 9.81)

// Truck z at which the tine heels reach the pallet's near face.
function seatedTruckZ(palletZ, pallet) {
  const nearFace = palletZ - Math.max(...pallet.colliders.map(({ center, half }) => half[2] - center[2]))
  return nearFace - 0.004 - TINE_HEEL_Z
}

const insertAndLift = (palletZ, pallet, height) => [
  { label: 'settle', duration: 0.5 },
  { label: 'insert', speed: 0.1, until: (s) => s.truckZ >= seatedTruckZ(palletZ, pallet) },
  { label: 'lift', speed: 0, lift: LIFT_SPEED, until: (s) => s.height >= height },
]

const brakeTest = (palletZ, pallet, { tilt, decel }) => [
  ...insertAndLift(palletZ, pallet, TRAVEL_HEIGHT),
  ...(tilt ? [{ label: 'tilt', tiltRate: -TILT_SPEED, until: (s) => s.tilt <= tilt }] : []),
  { label: 'accelerate', accel: mps2(1), until: (s) => s.truckV >= TRAVEL_SPEED },
  { label: 'cruise', accel: 0, duration: 0.5 },
  { label: 'brake', mark: 'brake', accel: -decel, until: (s) => s.truckV <= 0 },
  { label: 'stopped', mark: 'stopped', speed: 0, duration: 1.5 },
]

export const FORK_SPIKE_SCENARIOS = {
  'full-lift-hold': {
    title: 'Lift to full height and hold',
    segments: (palletZ, pallet) => [
      ...insertAndLift(palletZ, pallet, FULL_LIFT),
      { label: 'hold', mark: 'hold', duration: 3 },
    ],
  },
  'tilt-back-hold': {
    title: 'Full lift, tilt back 11 degrees, hold',
    segments: (palletZ, pallet) => [
      ...insertAndLift(palletZ, pallet, FULL_LIFT),
      { label: 'tilt', mark: 'tilt', tiltRate: -TILT_SPEED, until: (s) => s.tilt <= TILT_BACK_MAX },
      { label: 'hold', mark: 'hold', duration: 3 },
    ],
  },
  'brake-level': {
    title: 'Hard braking (0.5 g) from 10 km/h, mast level',
    segments: (palletZ, pallet) => brakeTest(palletZ, pallet, { tilt: 0, decel: HARD_BRAKE }),
  },
  'brake-tilted-back': {
    title: 'Hard braking (0.5 g) from 10 km/h, mast tilted back',
    segments: (palletZ, pallet) => brakeTest(palletZ, pallet, { tilt: TILT_BACK_MAX, decel: HARD_BRAKE }),
  },
  'brake-gentle': {
    title: 'Service braking (0.25 g) from 10 km/h, mast level',
    segments: (palletZ, pallet) => brakeTest(palletZ, pallet, { tilt: 0, decel: GENTLE_BRAKE }),
  },
  'one-pocket': {
    title: 'One tine in a pocket, the other outside the pallet',
    // Shifted so the left tine is in the right-hand pocket and the right
    // tine clears the pallet's edge.
    truckX: -0.105,
    segments: (palletZ, pallet) => [
      ...insertAndLift(palletZ, pallet, m(0.4)),
      { label: 'hold', mark: 'hold', duration: 2 },
    ],
  },
}

// Steps the scenario one sim step at a time. `next()` advances the script
// and the world together and returns false once the script is finished.
export function createScenarioRunner(spike, scenario, palletZ, pallet = WOODEN_PALLET) {
  const segments = scenario.segments(palletZ, pallet)
  const state = { truckX: scenario.truckX ?? 0, truckZ: 0, truckV: 0, height: 0, tilt: 0, time: 0 }
  const marks = {}
  let index = -1
  let segmentTime = 0

  spike.step({ truckX: state.truckX })

  const enter = (next) => {
    index = next
    segmentTime = 0
    const segment = segments[index]
    if (segment?.mark) marks[segment.mark] = { time: state.time, ...spike.palletOnForks().position }
    if (segment && 'speed' in segment) state.truckV = segment.speed
  }
  enter(0)

  return {
    state,
    marks,
    get segment() {
      return segments[index]?.label ?? 'done'
    },
    next() {
      const segment = segments[index]
      if (!segment) return false
      state.truckV = Math.max(0, state.truckV + (segment.accel ?? 0) * SIM_DT)
      state.truckZ += state.truckV * SIM_DT
      state.height = Math.min(FULL_LIFT, state.height + (segment.lift ?? 0) * SIM_DT)
      state.tilt += (segment.tiltRate ?? 0) * SIM_DT
      state.time += SIM_DT
      segmentTime += SIM_DT
      spike.step({ truckX: state.truckX, truckZ: state.truckZ, height: state.height, tilt: state.tilt })
      const finished = segment.until ? segment.until(state) : segmentTime >= segment.duration
      // A segment with an `until` that never comes true still ends.
      if (finished || segmentTime > 20) enter(index + 1)
      return index < segments.length
    },
  }
}

// Friction-limited deceleration: a load on tines tilted back by `backTilt`
// (radians, positive) starts to slide forward above this, in scene units.
export function slideThreshold(mu, backTilt = 0) {
  const tan = Math.tan(backTilt)
  return (G * (mu + tan)) / (1 - mu * tan)
}
