import { Box3, Group, Matrix4, Mesh, Vector3 } from 'three'
import { DEFAULT_RIG } from '../data/vehicleProfile.js'

// Shared rig builder, used by the driving simulation and the interactive
// walk-around viewer. Node names come from the equipment's vehicle profile
// (data/vehicleProfile.js), defaulting to forklift.glb's - a model with none
// of them still builds a rig, just an empty one, so the vehicle drives as a
// solid body instead of throwing.

export const WHEEL_NODE_NAMES = DEFAULT_RIG.wheels
export const REAR_WHEEL_KEYS = ['RL', 'RR']
export const WHEEL_RADIUS_FALLBACK = 0.07

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// The GLB exports every forklift part as a SkinnedMesh bound to a 3-bone rig
// that we never animate. In three.js 'attached' bind mode a SkinnedMesh ignores
// its own transform (the skinning math cancels it out), so rotating a wheel
// node directly would show nothing. Swap each SkinnedMesh for a plain Mesh with
// the same geometry/material and its true on-screen pose baked in (bind pose
// equals rest pose, so output is identical), then wrap the moving parts in
// pivot groups that can be driven from a frame loop.
export function buildForkliftRig(root, rigConfig = DEFAULT_RIG) {
  if (root.userData.__forkliftRig) return root.userData.__forkliftRig

  const wheelNames = rigConfig?.wheels || DEFAULT_RIG.wheels
  const mastName = rigConfig?.mast || DEFAULT_RIG.mast
  const carriageName = rigConfig?.carriage || DEFAULT_RIG.carriage
  const mastFootWorld = rigConfig?.mastFoot || DEFAULT_RIG.mastFoot

  root.updateMatrixWorld(true)

  const skinnedMeshes = []
  root.traverse((object) => {
    if (object.isSkinnedMesh) skinnedMeshes.push(object)
  })
  const skinTransform = new Matrix4()
  const parentInverse = new Matrix4()
  skinnedMeshes.forEach((skinned) => {
    // GLTFLoader binds skins before world matrices exist, so the on-screen pose
    // of each rigidly-skinned part is boneWorld * inverseBind * bindMatrix - not
    // the node's own transform chain. Bake that pose into the replacement mesh,
    // using the dominant (max-weight) bone of the first vertex.
    const skinIndex = skinned.geometry.attributes.skinIndex
    const skinWeight = skinned.geometry.attributes.skinWeight
    let boneIndex = 0
    if (skinIndex && skinWeight) {
      let bestWeight = -1
      for (let influence = 0; influence < 4; influence += 1) {
        const weight = skinWeight.getComponent(0, influence)
        if (weight > bestWeight) {
          bestWeight = weight
          boneIndex = skinIndex.getComponent(0, influence)
        }
      }
    }
    skinTransform
      .multiplyMatrices(skinned.skeleton.bones[boneIndex].matrixWorld, skinned.skeleton.boneInverses[boneIndex])
      .multiply(skinned.bindMatrix)
    const plain = new Mesh(skinned.geometry, skinned.material)
    plain.name = skinned.name
    parentInverse.copy(skinned.parent.matrixWorld).invert()
    plain.matrix.multiplyMatrices(parentInverse, skinTransform)
    plain.matrix.decompose(plain.position, plain.quaternion, plain.scale)
    plain.castShadow = true
    plain.receiveShadow = true
    skinned.parent.add(plain)
    skinned.parent.remove(skinned)
  })
  root.updateMatrixWorld(true)

  const wheels = {}
  Object.entries(wheelNames).forEach(([key, name]) => {
    const mesh = root.getObjectByName(name)
    if (!mesh) return

    const box = new Box3().setFromObject(mesh)
    const center = box.getCenter(new Vector3())
    const radius = Number.isFinite(box.max.y)
      ? Math.max((box.max.y - box.min.y) / 2, 0.01)
      : WHEEL_RADIUS_FALLBACK
    const parent = mesh.parent
    const localCenter = parent.worldToLocal(center.clone())

    // Spin pivot sits at the wheel centre so rotation.x rolls the wheel about
    // its own axle; rear wheels get an extra yaw pivot for steering.
    const spin = new Group()
    if (REAR_WHEEL_KEYS.includes(key)) {
      const steer = new Group()
      steer.position.copy(localCenter)
      parent.add(steer)
      steer.add(spin)
      steer.updateMatrixWorld(true)
      spin.attach(mesh)
      wheels[key] = { spin, steer, radius }
    } else {
      spin.position.copy(localCenter)
      parent.add(spin)
      spin.updateMatrixWorld(true)
      spin.attach(mesh)
      wheels[key] = { spin, radius }
    }
  })

  // Tilt pivot at the mast foot, holding both lift groups, so rotation.x tilts
  // the whole mast assembly and lifting still travels along the tilted mast.
  // Lift groups are identity children of the pivot, keeping `position.y = h`
  // valid as the lift control; the meshes' own offsets are baked in by attach().
  const mastMesh = mastName ? root.getObjectByName(mastName) : null
  const carriageMesh = carriageName ? root.getObjectByName(carriageName) : null
  let tiltPivot = null
  if (mastMesh) {
    tiltPivot = new Group()
    tiltPivot.position.copy(mastMesh.parent.worldToLocal(new Vector3(...mastFootWorld)))
    mastMesh.parent.add(tiltPivot)
    tiltPivot.updateMatrixWorld(true)
  }
  const wrapInLiftGroup = (mesh) => {
    if (!mesh) return null
    const container = tiltPivot || mesh.parent
    const lift = new Group()
    container.add(lift)
    lift.updateMatrixWorld(true)
    lift.attach(mesh)
    return lift
  }
  const mastLift = wrapInLiftGroup(mastMesh)
  const carriageLift = wrapInLiftGroup(carriageMesh)

  let forkTipOffset = 0.45
  if (carriageMesh) {
    const carriageBox = new Box3().setFromObject(carriageMesh)
    if (Number.isFinite(carriageBox.max.z)) {
      forkTipOffset = clamp(carriageBox.max.z - 0.15, 0.3, 1.2)
    }
  }

  const rig = { wheels, mastLift, carriageLift, tiltPivot, forkTipOffset }
  root.userData.__forkliftRig = rig
  if (typeof window !== 'undefined') window.__forkliftRig = rig
  return rig
}
