import { Matrix4, Quaternion, Vector3 } from 'three'
import { IMPACT_SOUND_SPEED } from '../../data/physicsProfile.js'
import { decorationType } from '../courseEdit.js'
import { createPhysicsWorld } from '../physics/world.js'
import { chassisPose, forkPose } from './forkPose.js'
import { noTouch } from './simState.js'

// The physics step (docs/revisions/post-defense-plan.md, section 4.6): the
// one place the simulation and the physics world (lib/physics/world.js) meet.
//
// Going in, the truck's body and fork carriage are moved to where the drive
// model put them (stepDrive, stepCollisionBody, stepForks, stepFail). Coming
// out, every pallet's and cone's pose is read back into SimState, along with
// what is touching what:
//   pallet.touch        on the forks, held up by something else, on which
//                       rack's which level
//   pallet.slipSpeed    how fast it is sliding along the forks
//   state.limits        what the forks, or the load on them, are up against
//                       that does not move (next step's stepCollisionBody
//                       and stepForks refuse a move further into it)
//   state.frame.impacts what began touching this step, and how hard, for
//                       stepCollisionHazards to judge
// and an 'impact' event for each one hard enough to hear.
//
// Everything after this step reads state, not the physics world, so the
// safety rules, the audio and the view stay as they were: readers of state.

const matrix = new Matrix4()
const carriageInverse = new Matrix4()
const scale = new Vector3()
const local = new Vector3()

function poseOf(source) {
  const position = new Vector3()
  const quaternion = new Quaternion()
  source.decompose(position, quaternion, scale)
  return { position, quaternion }
}

// Where the truck's body and its fork carriage are, for the physics world.
export function truckPoses(state, geometry) {
  return {
    chassis: poseOf(chassisPose(state, geometry, matrix)),
    carriage: poseOf(forkPose(state, geometry, matrix)),
  }
}

// The physics world for one attempt: the course's pallets, cones, racking,
// walls and parked vehicles, and the truck where it starts.
export function createScenePhysics(RAPIER, state, world) {
  const placed = ({ position, rotation }) => ({ x: position[0], z: position[2], rotation: rotation || 0 })
  return createPhysicsWorld(
    RAPIER,
    {
      footprint: { halfWidth: world.halfWidth, halfLength: world.halfLength },
      mastFoot: world.geometry.mastFoot,
      pallets: state.pallets.map(({ def }) => ({ def, ...placed(def) })),
      cones: world.liveCones.map(placed),
      racks: world.rackColliders,
      walls: world.liveWalls.filter((item) => item.type === 'wall').map((wall) => ({ ...placed(wall), length: wall.length || 3 })),
      vehicles: world.liveWalls.filter((item) => decorationType(item) === 'vehicle').map(placed),
    },
    truckPoses(state, world.geometry),
  )
}

const TRUCK_PARTS = new Set(['chassis', 'tine', 'backrest'])
const FORK_PARTS = new Set(['tine', 'backrest'])
const STRUCTURE = new Set(['rack', 'wall', 'vehicle'])
const contactKey = ({ a, b }) => `${a.kind}${a.index ?? ''}>${b.kind}${b.index ?? ''}`

export function stepPhysics(state, world, physics, dt) {
  const { truck, forks, pallets, cones, frame } = state
  const { geometry } = world

  // Each pallet's velocity going in: what it was doing before anything hit
  // it this step.
  const before = pallets.map((pallet) => pallet.velocity.clone())

  physics.step(truckPoses(state, geometry))

  carriageInverse.copy(forkPose(state, geometry, matrix)).invert()
  pallets.forEach((pallet, index) => {
    const { body } = physics.pallets[index]
    pallet.position.copy(body.translation())
    pallet.quaternion.copy(body.rotation())
    pallet.rotation.setFromQuaternion(pallet.quaternion)
    pallet.velocity.copy(body.linvel())
    pallet.com.copy(body.worldCom())
    // The angle between the pallet's own up and the world's.
    const { x, z } = pallet.quaternion
    pallet.lean = Math.acos(Math.min(1, Math.max(-1, 1 - 2 * (x * x + z * z))))
    pallet.touch = noTouch()
  })
  cones.forEach((cone, index) => {
    const { body } = physics.cones[index]
    cone.position.copy(body.translation())
    cone.quaternion.copy(body.rotation())
  })

  // The truck's velocity where a pallet is: its travel, its turning about its
  // own origin, and for the forks their lift.
  const truckVelocityAt = (point, part) => ({
    x: truck.speed * frame.forwardX + frame.yawRate * (point.z - truck.z),
    y: FORK_PARTS.has(part) ? forks.liftRate : 0,
    z: truck.speed * frame.forwardZ - frame.yawRate * (point.x - truck.x),
  })

  const wasTouching = new Set(state.touching)
  const touching = new Set()
  const limits = { travel: [], lift: false, lower: false }
  const impacts = []

  // Something that does not move, in the way of the forks or a load on them.
  // The normal points from the truck's side toward it.
  const limitBy = ({ b, nx, ny, nz }, started) => {
    if (ny > 0.5) limits.lift = true
    else if (ny < -0.5) limits.lower = true
    else {
      const length = Math.hypot(nx, nz) || 1
      limits.travel.push({ nx: nx / length, nz: nz / length, kind: b.kind })
    }
    if (started) impacts.push({ what: 'structure', byTruck: true, speed: Math.abs(truck.speed) })
  }

  // physics.contacts() lists the truck's own contacts first, so by the time a
  // pallet's are read it is known whether the forks hold it.
  for (const contact of physics.contacts()) {
    const { a, b, nx, ny, nz } = contact
    const key = contactKey(contact)
    const started = !wasTouching.has(key) && !touching.has(key)
    touching.add(key)

    if (TRUCK_PARTS.has(a.kind)) {
      if (b.kind === 'pallet') {
        const pallet = pallets[b.index]
        if (FORK_PARTS.has(a.kind)) pallet.touch.forks = true
        if (a.kind === 'tine') pallet.touch.tines = true
        if (started) {
          const velocity = truckVelocityAt(pallet.position, a.kind)
          const was = before[b.index]
          const closing = (velocity.x - was.x) * nx + (velocity.y - was.y) * ny + (velocity.z - was.z) * nz
          impacts.push({ what: 'pallet', byTruck: true, speed: Math.max(closing, 0) })
        }
      } else if (b.kind === 'cone') {
        cones[b.index].hit = true
        if (started) impacts.push({ what: 'cone', byTruck: true, speed: Math.abs(truck.speed) })
      } else if (STRUCTURE.has(b.kind)) {
        limitBy(contact, started)
      }
      continue
    }

    // `a` is a pallet.
    const pallet = pallets[a.index]
    const held = pallet.touch.forks
    const landing = started ? Math.max(before[a.index].x * nx + before[a.index].y * ny + before[a.index].z * nz, 0) : 0
    if (b.kind === 'floor') {
      pallet.touch.supported = true
      if (started) impacts.push({ what: 'landing', byTruck: false, speed: landing })
    } else if (STRUCTURE.has(b.kind)) {
      if (ny < -0.5) {
        // Standing on it. A rack's decking or beams are a shelf.
        pallet.touch.supported = true
        if (b.kind === 'rack' && b.level) {
          pallet.touch.rackId = b.id
          pallet.touch.rackLevel = b.level
        }
        if (started) impacts.push({ what: 'landing', byTruck: false, speed: landing })
      } else if (held) {
        limitBy(contact, started)
      }
    } else if (b.kind === 'pallet') {
      // Whichever is on top is held up by the other.
      if (ny < -0.5) pallet.touch.supported = true
      else if (ny > 0.5) pallets[b.index].touch.supported = true
    } else if (b.kind === 'cone') {
      cones[b.index].hit = true
      if (started) impacts.push({ what: 'cone', byTruck: held, speed: pallet.velocity.length() })
    }
  }

  pallets.forEach((pallet) => {
    if (!pallet.touch.forks) {
      pallet.forkLocal = null
      pallet.slipSpeed = 0
      return
    }
    // Sliding is movement in the plane of the tines; lifting off them is not.
    local.copy(pallet.position).applyMatrix4(carriageInverse)
    pallet.slipSpeed = pallet.forkLocal ? Math.hypot(local.x - pallet.forkLocal.x, local.z - pallet.forkLocal.z) / dt : 0
    pallet.forkLocal = (pallet.forkLocal || new Vector3()).copy(local)
  })

  state.touching = [...touching]
  state.limits = limits
  frame.impacts = impacts
  for (const impact of impacts) {
    if (impact.what === 'cone' || impact.speed > IMPACT_SOUND_SPEED) state.events.push({ type: 'impact', what: impact.what, speed: impact.speed })
  }
}
