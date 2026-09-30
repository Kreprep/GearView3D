// The driving simulation's physics world (docs/revisions/post-defense-plan.md,
// sections 3.1 and 4.6): Rapier, used directly, in the hybrid model.
//
// - The truck's body and its fork carriage are kinematic. The drive model
//   (lib/driving/stepDrive.js, stepForks.js) decides where they are; this
//   world is told, and moves them there across its substeps. A kinematic body
//   pushes a dynamic one with the right momentum.
// - Pallets (each one compound body with its load, fork pockets open) and
//   cones are dynamic.
// - The floor, racks (posts, beams and decking), walls and parked vehicles
//   are fixed.
//
// The truck against walls and racking is still the 2D test in
// lib/driving/stepCollision.js; this world reports what the forks and a load
// on them touch (contacts()), which the sim steps turn into blocking, fails
// and pallet states.
//
// Nothing here knows about SimState: lib/driving/stepPhysics.js is the step
// that feeds it poses and reads bodies back. RAPIER is passed in
// (lib/physics/rapier.js loads it), so this runs unchanged under node --test.
import { Matrix4, Quaternion, Vector3 } from 'three'
import { CONE, FRICTION, PHYSICS_WORLD, TOUCH_DISTANCE, palletPhysics } from '../../data/physicsProfile.js'
import { boxVolume, chassisCollider, forkColliders, parkedVehicleCollider, rackColliders, wallCollider } from './colliders.js'

// Collision groups: what each kind of collider is, and what it meets. The
// truck is placed by the drive model, so it does not meet the floor; the
// floor carries only what can fall on it.
const FLOOR = 1
const STRUCTURE = 2
const TRUCK = 4
const DYNAMIC = 8
const groups = (member, filter) => (member << 16) | filter
const GROUPS = {
  floor: groups(FLOOR, DYNAMIC),
  structure: groups(STRUCTURE, DYNAMIC | TRUCK),
  truck: groups(TRUCK, DYNAMIC | STRUCTURE),
  dynamic: groups(DYNAMIC, FLOOR | STRUCTURE | TRUCK | DYNAMIC),
}

const TRUCK_KINDS = new Set(['chassis', 'tine', 'backrest'])

const yawQuaternion = (rotation = 0) => ({ x: 0, y: Math.sin(rotation / 2), z: 0, w: Math.cos(rotation / 2) })

const scratchFrom = new Quaternion()
const scratchTo = new Quaternion()
const scratchMatrix = new Matrix4()
const scratchDelta = new Matrix4()
const scratchPosition = new Vector3()
const scratchQuaternion = new Quaternion()
const scratchScale = new Vector3()
const ONE = new Vector3(1, 1, 1)

const composeInto = (matrix, { position, quaternion }) =>
  matrix.compose(scratchPosition.copy(position), scratchQuaternion.copy(quaternion), ONE)

/**
 * `scene` is what the course puts in the world, in scene units:
 *   footprint  the truck body's { halfWidth, halfLength }
 *   mastFoot   the rig's mast foot, which the carriage frame hangs from
 *   pallets    [{ def, x, z, rotation }] (def: the course's pallet)
 *   cones      [{ x, z }]
 *   racks      [{ id, x, z, rotation }]
 *   walls      [{ x, z, rotation, length }]
 *   vehicles   [{ x, z, rotation }]
 * `truck` is the starting { chassis, carriage } pose, each
 * { position: {x,y,z}, quaternion: {x,y,z,w} }.
 *
 * Options: `settings` overrides PHYSICS_WORLD, and `tineFriction` the
 * steel-on-wood value (both for tests).
 */
export function createPhysicsWorld(RAPIER, scene, truck, options = {}) {
  const settings = { ...PHYSICS_WORLD, ...options.settings }
  const tineFriction = options.tineFriction ?? FRICTION.steelOnWood

  const world = new RAPIER.World(new RAPIER.Vector3(...settings.gravity))
  world.timestep = settings.dt
  world.lengthUnit = settings.lengthUnit
  world.numSolverIterations = settings.solverIterations

  // What each collider is, by its handle: { kind, ... }.
  const tags = new Map()
  const addBox = (body, { center, half }, tag, configure) => {
    const desc = RAPIER.ColliderDesc.cuboid(...half).setTranslation(...center)
    configure(desc)
    const collider = world.createCollider(desc, body)
    tags.set(collider.handle, tag)
    return collider
  }
  const fixedAt = ({ x, z, rotation }) =>
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0, z).setRotation(yawQuaternion(rotation)))
  const structure = (desc) => desc.setFriction(FRICTION.woodOnConcrete).setCollisionGroups(GROUPS.structure)

  // --- Fixed: the floor, racking, walls, parked vehicles ---
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  addBox(floor, { center: [0, -0.5, 0], half: [500, 0.5, 500] }, { kind: 'floor' }, (desc) =>
    desc.setFriction(FRICTION.woodOnConcrete).setCollisionGroups(GROUPS.floor))

  const rackBoxes = rackColliders()
  scene.racks.forEach((rack, index) => {
    const body = fixedAt(rack)
    for (const box of rackBoxes) addBox(body, box, { kind: 'rack', index, id: rack.id ?? null, part: box.part, level: box.level ?? null }, structure)
  })
  scene.walls.forEach((wall, index) => addBox(fixedAt(wall), wallCollider(wall.length), { kind: 'wall', index }, structure))
  scene.vehicles.forEach((vehicle, index) =>
    addBox(fixedAt(vehicle), parkedVehicleCollider(scene.footprint), { kind: 'vehicle', index }, structure))

  // --- Kinematic: the truck's body and the fork carriage ---
  const kinematicAt = ({ position, quaternion }) =>
    world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z).setRotation(quaternion),
    )
  const chassis = kinematicAt(truck.chassis)
  const carriage = kinematicAt(truck.carriage)
  const truckColliders = [
    addBox(chassis, chassisCollider(scene.footprint), { kind: 'chassis' }, (desc) =>
      desc.setFriction(FRICTION.woodOnConcrete).setCollisionGroups(GROUPS.truck)),
    ...forkColliders(scene.mastFoot).map(({ part, ...box }) =>
      addBox(carriage, box, { kind: part }, (desc) =>
        desc
          .setFriction(tineFriction)
          // Min: tine-on-anything is the tine's own value.
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setCollisionGroups(GROUPS.truck)
          // Kinematic against fixed generates no contacts by default, and the
          // forks have to feel a rack beam.
          .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED))),
  ]

  // --- Dynamic: pallets and cones ---
  const pallets = scene.pallets.map(({ def, x, z, rotation }, index) => {
    const { pallet, loadKg } = palletPhysics(def)
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, 0, z)
        .setRotation(yawQuaternion(rotation))
        .setCcdEnabled(true)
        // A pallet at rest still has to report what it rests on.
        .setCanSleep(false),
    )
    const tag = { kind: 'pallet', index }
    const dynamic = (desc) => desc.setFriction(FRICTION.woodOnConcrete).setCollisionGroups(GROUPS.dynamic)
    const density = pallet.mass / pallet.colliders.reduce((sum, box) => sum + boxVolume(box), 0)
    const colliders = pallet.colliders.map((box) => addBox(body, box, tag, (desc) => dynamic(desc).setDensity(density)))
    colliders.push(addBox(body, pallet.load, tag, (desc) => dynamic(desc).setMass(loadKg)))
    return { body, colliders, massKg: pallet.mass + loadKg }
  })

  const cones = scene.cones.map(({ x, z }, index) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0, z).setCcdEnabled(true))
    const tag = { kind: 'cone', index }
    const rubber = (desc) => desc.setFriction(FRICTION.rubberOnConcrete).setCollisionGroups(GROUPS.dynamic)
    // Most of a cone's weight is its base plate, which is what stands it up.
    addBox(body, CONE.base, tag, (desc) => rubber(desc).setMass(CONE.mass * 0.7))
    const cone = world.createCollider(
      rubber(RAPIER.ColliderDesc.cone(CONE.body.halfHeight, CONE.body.radius).setTranslation(0, CONE.body.centerY, 0)).setMass(CONE.mass * 0.3),
      body,
    )
    tags.set(cone.handle, tag)
    return { body }
  })

  let last = truck

  const setKinematic = (body, from, to, t) => {
    body.setNextKinematicTranslation({
      x: from.position.x + (to.position.x - from.position.x) * t,
      y: from.position.y + (to.position.y - from.position.y) * t,
      z: from.position.z + (to.position.z - from.position.z) * t,
    })
    scratchFrom.copy(from.quaternion)
    body.setNextKinematicRotation(scratchFrom.slerp(scratchTo.copy(to.quaternion), t))
  }

  // Everything touching the truck or a pallet right now, as
  // { a, b, nx, ny, nz }: the two colliders' tags and the contact normal from
  // `a` toward `b`. A truck part is always `a`.
  function contacts() {
    const found = []
    const visit = (collider) => {
      const a = tags.get(collider.handle)
      world.contactPairsWith(collider, (other) => {
        const b = tags.get(other.handle)
        if (a.kind === 'pallet') {
          // Seen from the truck's side, and once per pair of pallets.
          if (TRUCK_KINDS.has(b.kind) || (b.kind === 'pallet' && b.index <= a.index)) return
        }
        world.contactPair(collider, other, (manifold, flipped) => {
          let distance = Infinity
          for (let i = 0; i < manifold.numContacts(); i += 1) distance = Math.min(distance, manifold.contactDist(i))
          if (distance > TOUCH_DISTANCE) return
          const normal = manifold.normal()
          const sign = flipped ? -1 : 1
          found.push({ a, b, nx: normal.x * sign, ny: normal.y * sign, nz: normal.z * sign })
        })
      })
    }
    truckColliders.forEach(visit)
    for (const pallet of pallets) pallet.colliders.forEach(visit)
    return found
  }

  return {
    RAPIER,
    world,
    chassis,
    carriage,
    pallets,
    cones,

    // One sim step: the truck moves from where it was to `next` across the
    // substeps, so Rapier sees it travel rather than jump.
    step(next) {
      for (let i = 1; i <= settings.substeps; i += 1) {
        const t = i / settings.substeps
        setKinematic(chassis, last.chassis, next.chassis, t)
        setKinematic(carriage, last.carriage, next.carriage, t)
        world.step()
      }
      last = next
    },

    // Put the truck somewhere else outright (a test or a debug warp), taking
    // the pallets in `carried` (indexes) along on the forks.
    teleport(next, carried = []) {
      scratchDelta.copy(composeInto(scratchMatrix, last.carriage)).invert().premultiply(composeInto(scratchMatrix, next.carriage))
      for (const index of carried) {
        const { body } = pallets[index]
        composeInto(scratchMatrix, { position: body.translation(), quaternion: body.rotation() }).premultiply(scratchDelta)
        const position = new Vector3()
        const quaternion = new Quaternion()
        scratchMatrix.decompose(position, quaternion, scratchScale)
        body.setTranslation(position, true)
        body.setRotation(quaternion, true)
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
      for (const [body, pose] of [[chassis, next.chassis], [carriage, next.carriage]]) {
        body.setTranslation(pose.position, true)
        body.setRotation(pose.quaternion, true)
      }
      last = next
    },

    contacts,

    // Rapier's own wireframe of every collider: { vertices, colors }.
    debugRender: () => world.debugRender(),

    dispose: () => world.free(),
  }
}
