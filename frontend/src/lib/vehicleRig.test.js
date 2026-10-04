import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, Vector3 } from 'three'
import { DEFAULT_RIG } from '../data/vehicleProfile.js'
import { buildVehicleRig } from './vehicleRig.js'

// A stand-in for forklift.glb: plain meshes named as DEFAULT_RIG names them,
// under an offset body node (the model's parts don't sit at its root), each
// centred where the real part is. Enough for the rig builder, without loading
// the model.
function standInModel() {
  const root = new Group()
  const body = new Group()
  body.position.set(0, 0.2566, -0.1547)
  root.add(body)
  const part = (name, centre, size = [0.05, 0.05, 0.05]) => {
    const mesh = new Mesh(new BoxGeometry(...size))
    mesh.name = name
    mesh.position.set(centre[0] - body.position.x, centre[1] - body.position.y, centre[2] - body.position.z)
    body.add(mesh)
    return mesh
  }
  part(DEFAULT_RIG.wheels.FL, [0.119, 0.0786, 0.195], [0.06, 0.157, 0.157])
  part(DEFAULT_RIG.wheels.FR, [-0.119, 0.0786, 0.195], [0.06, 0.157, 0.157])
  part(DEFAULT_RIG.wheels.RL, [0.1, 0.0603, -0.188], [0.05, 0.121, 0.121])
  part(DEFAULT_RIG.wheels.RR, [-0.1, 0.0603, -0.188], [0.05, 0.121, 0.121])
  part(DEFAULT_RIG.mast, [0, 0.35, 0.27], [0.2, 0.6, 0.04])
  part(DEFAULT_RIG.carriage, [0, 0.05, 0.42], [0.2, 0.1, 0.44])
  part(DEFAULT_RIG.steeringWheel.node, DEFAULT_RIG.steeringWheel.centre, [0.06, 0.01, 0.06])
  part(DEFAULT_RIG.levers.lift.node, [-0.049, 0.30, 0.1302], [0.01, 0.06, 0.01])
  part(DEFAULT_RIG.levers.tilt.node, [-0.0639, 0.30, 0.1302], [0.01, 0.06, 0.01])
  return root
}

// The model under a truck group, standing where a course starts it.
function rigAt(position, heading) {
  const truck = new Group()
  truck.position.set(...position)
  truck.rotation.y = heading
  const root = standInModel()
  truck.add(root)
  truck.updateMatrixWorld(true)
  return { root, rig: buildVehicleRig(root) }
}

const near = (actual, expected, label) => {
  assert.ok(actual.distanceTo(expected) < 1e-9, `${label}: ${actual.toArray()} vs ${expected.toArray()}`)
}

// The pivots' places in the model, and their axes, for comparing two rigs.
function pivots(rig) {
  return {
    steering: [rig.steeringWheel.pivot.position, rig.steeringWheel.axis],
    tilt: [rig.tiltPivot.position, null],
    lift: [rig.levers.lift.pivot.position, rig.levers.lift.axis],
    tiltLever: [rig.levers.tilt.pivot.position, rig.levers.tilt.axis],
    ...Object.fromEntries(Object.entries(rig.wheels).map(([key, wheel]) => [`wheel ${key}`, [(wheel.steer || wheel.spin).position, null]])),
  }
}

test('buildVehicleRig gives the same rig wherever the truck stands and faces', () => {
  const atOrigin = rigAt([0, 0, 0], 0).rig
  // Precision Carry's start in the reported bug (plan 2.1).
  const moved = rigAt([2, 0, -3], 0.6).rig
  const expected = pivots(atOrigin)
  for (const [label, [position, axis]] of Object.entries(pivots(moved))) {
    near(position, expected[label][0], `${label} position`)
    if (axis) near(axis, expected[label][1], `${label} axis`)
  }
  assert.ok(Math.abs(moved.forkTipOffset - atOrigin.forkTipOffset) < 1e-9, 'forkTipOffset')
  assert.ok(Math.abs(moved.forkReach - atOrigin.forkReach) < 1e-9, 'forkReach')
  for (const key of Object.keys(atOrigin.wheels)) {
    assert.ok(Math.abs(moved.wheels[key].radius - atOrigin.wheels[key].radius) < 1e-9, `wheel ${key} radius`)
    assert.ok(Math.abs(moved.wheels[key].centreZ - atOrigin.wheels[key].centreZ) < 1e-9, `wheel ${key} centreZ`)
  }
})

test('the pivots sit at DEFAULT_RIG\'s model-frame points', () => {
  const { root, rig } = rigAt([2, 0, -3], 0.6)
  const inModel = (object) => root.worldToLocal(object.getWorldPosition(new Vector3()))
  near(inModel(rig.steeringWheel.pivot), new Vector3(...DEFAULT_RIG.steeringWheel.centre), 'steering centre')
  near(inModel(rig.tiltPivot), new Vector3(...DEFAULT_RIG.mastFoot), 'mast foot')
  near(inModel(rig.levers.lift.pivot), new Vector3(...DEFAULT_RIG.levers.lift.base), 'lift lever base')
})

test('the steering wheel turns about its hub, in the cab', () => {
  const { root, rig } = rigAt([2, 0, -3], 0.6)
  const { pivot, axis } = rig.steeringWheel
  const mesh = pivot.children[0]
  pivot.quaternion.setFromAxisAngle(axis, 1.2)
  root.updateMatrixWorld(true)
  const centre = root.worldToLocal(mesh.getWorldPosition(new Vector3()))
  near(centre, new Vector3(...DEFAULT_RIG.steeringWheel.centre), 'steered wheel centre')
})

test('meshes stay where they were when the rig is built', () => {
  const truck = new Group()
  truck.position.set(2, 0, -3)
  truck.rotation.y = 0.6
  const root = standInModel()
  truck.add(root)
  truck.updateMatrixWorld(true)
  const before = new Map()
  root.traverse((object) => { if (object.isMesh) before.set(object.name, object.getWorldPosition(new Vector3())) })
  buildVehicleRig(root)
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (object.isMesh) near(object.getWorldPosition(new Vector3()), before.get(object.name), object.name)
  })
})
