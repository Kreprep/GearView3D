// Splits the steering wheel out of forklift.glb's Forklift_Body into its own
// Steering_Wheel node, so the simulation can turn it with the steering input
// (docs/revisions/post-defense-plan.md, section 4.2, Phase 3).
//
//   node scripts/split-steering-wheel.mjs            # rewrites public/models/forklift.glb
//   node scripts/split-steering-wheel.mjs --check    # reports, writes nothing
//
// The wheel was loose parts of the body mesh: the ring with its two spokes, a
// second ring layer and the hub cap. They were found and confirmed in Blender
// on 2026-09-30. The edit is surgical rather than a Blender round trip, which
// would rebuild the skin, the node hierarchy and the textures that
// lib/vehicleRig.js and the hotspot positions depend on:
//
// - The wheel's triangles leave the body primitive's index list. The body's
//   vertex data is left exactly as it was (the wheel's vertices stay in it,
//   unreferenced), so nothing else about the body can change.
// - A new mesh holds copies of those vertices (every attribute, and every
//   morph target, since the parts share the body's 11) with the same
//   material and morph weights, on a new node beside Forklift_Body, bound to
//   the same skin. So it renders exactly where it did.
//
// Every other node, mesh, material and texture is untouched. The script
// refuses to run on a file that already has a Steering_Wheel node, so it is
// safe to re-run, and it checks it found exactly the 1,308 faces confirmed in
// Blender before writing.
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'

// glTF matrices are column-major 4x4 arrays.
const mat4 = {
  multiply(a, b) {
    const out = new Array(16).fill(0)
    for (let col = 0; col < 4; col += 1) {
      for (let row = 0; row < 4; row += 1) {
        for (let k = 0; k < 4; k += 1) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k]
      }
    }
    return out
  },
  transformPoint(m, [x, y, z]) {
    return [0, 1, 2].map((row) => m[row] * x + m[4 + row] * y + m[8 + row] * z + m[12 + row])
  },
}
const vec3 = {
  subtract: (a, b) => a.map((value, i) => value - b[i]),
  scale: (a, factor) => a.map((value) => value * factor),
  dot: (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0),
  length: (a) => Math.hypot(...a),
  normalize: (a) => a.map((value) => value / Math.hypot(...a)),
}

const MODEL = fileURLToPath(new URL('../public/models/forklift.glb', import.meta.url))
const BODY_NODE = 'Forklift_Body'
const WHEEL_NODE = 'Steering_Wheel'
const EXPECTED_FACES = 1308

// The wheel in the model's own frame (glTF axes, as the viewers show it):
// the ring's centre and its normal, which is the column's axis to within
// 4 degrees. Also in DEFAULT_RIG.steeringWheel (data/vehicleProfile.js).
const CENTRE = [0, 0.3197, 0.0672]
const AXIS = vec3.normalize([0, 0.8804, -0.4743])
// A loose part belongs to the wheel when every vertex is within this radius
// of the axis and this band along it. The column shroud below the hub and the
// indicator stalk reach further down the axis, so they stay on the body.
const MAX_RADIUS = 0.048
const AXIAL_BAND = [-0.015, 0.005]

const check = process.argv.includes('--check')
const io = new NodeIO()
const document = await io.read(MODEL)
const root = document.getRoot()

if (root.listNodes().some((node) => node.getName() === WHEEL_NODE)) {
  console.log(`${WHEEL_NODE} already exists; nothing to do.`)
  process.exit(0)
}

const body = root.listNodes().find((node) => node.getName() === BODY_NODE)
const skin = body.getSkin()
const primitive = body.getMesh().listPrimitives()[0]
if (body.getMesh().listPrimitives().length !== 1) throw new Error(`${BODY_NODE} should have one primitive`)

// Where each vertex is drawn: skinning places it at
// jointWorld * inverseBind * position, weighted over its joints. (The node's
// own transform chain carries an offset the skinning cancels; see
// lib/vehicleRig.js.)
const position = primitive.getAttribute('POSITION')
const joints = primitive.getAttribute('JOINTS_0')
const weights = primitive.getAttribute('WEIGHTS_0')
const inverseBinds = skin.getInverseBindMatrices()
const jointMatrices = skin.listJoints().map((joint, index) => mat4.multiply(joint.getWorldMatrix(), inverseBinds.getElement(index, [])))
const drawn = (index) => {
  const local = position.getElement(index, [])
  const jointIds = joints.getElement(index, [])
  const jointWeights = weights.getElement(index, [])
  const out = [0, 0, 0]
  jointIds.forEach((joint, k) => {
    if (!jointWeights[k]) return
    const point = mat4.transformPoint(jointMatrices[joint], local)
    for (let axis = 0; axis < 3; axis += 1) out[axis] += point[axis] * jointWeights[k]
  })
  return out
}

// Loose parts: vertices joined by the triangles that use them.
const indices = primitive.getIndices().getArray()
const vertexCount = position.getCount()
const parent = Int32Array.from({ length: vertexCount }, (_, i) => i)
const find = (i) => {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]]
    i = parent[i]
  }
  return i
}
for (let t = 0; t < indices.length; t += 3) {
  const a = find(indices[t])
  for (const other of [indices[t + 1], indices[t + 2]]) parent[find(other)] = a
}

const partInside = new Map()
for (let i = 0; i < vertexCount; i += 1) {
  const part = find(i)
  if (partInside.get(part) === false) continue
  const offset = vec3.subtract(drawn(i), CENTRE)
  const along = vec3.dot(offset, AXIS)
  const radius = vec3.length(vec3.subtract(offset, vec3.scale(AXIS, along)))
  const inside = radius <= MAX_RADIUS && along >= AXIAL_BAND[0] && along <= AXIAL_BAND[1]
  partInside.set(part, (partInside.get(part) ?? true) && inside)
}
const isWheel = (vertex) => partInside.get(find(vertex)) === true

const bodyTriangles = []
const wheelTriangles = []
for (let t = 0; t < indices.length; t += 3) {
  const triangle = [indices[t], indices[t + 1], indices[t + 2]]
  ;(triangle.every(isWheel) ? wheelTriangles : bodyTriangles).push(...triangle)
}
const faces = wheelTriangles.length / 3
console.log(`wheel: ${faces} faces; body keeps ${bodyTriangles.length / 3}`)
if (faces !== EXPECTED_FACES) throw new Error(`expected ${EXPECTED_FACES} wheel faces (confirmed in Blender), found ${faces}`)
if (check) process.exit(0)

// The wheel's own vertex list, in first-use order.
const remap = new Map()
const wheelVertices = []
const wheelIndices = wheelTriangles.map((vertex) => {
  if (!remap.has(vertex)) {
    remap.set(vertex, wheelVertices.length)
    wheelVertices.push(vertex)
  }
  return remap.get(vertex)
})

const buffer = root.listBuffers()[0]
const sliceAccessor = (accessor) => {
  const size = accessor.getElementSize()
  const source = accessor.getArray()
  const array = new source.constructor(wheelVertices.length * size)
  wheelVertices.forEach((vertex, i) => array.set(source.subarray(vertex * size, vertex * size + size), i * size))
  return document
    .createAccessor(accessor.getName())
    .setType(accessor.getType())
    .setArray(array)
    .setNormalized(accessor.getNormalized())
    .setBuffer(buffer)
}

const wheelPrimitive = document.createPrimitive().setMaterial(primitive.getMaterial()).setMode(primitive.getMode())
for (const semantic of primitive.listSemantics()) wheelPrimitive.setAttribute(semantic, sliceAccessor(primitive.getAttribute(semantic)))
for (const target of primitive.listTargets()) {
  const wheelTarget = document.createPrimitiveTarget(target.getName())
  for (const semantic of target.listSemantics()) wheelTarget.setAttribute(semantic, sliceAccessor(target.getAttribute(semantic)))
  wheelPrimitive.addTarget(wheelTarget)
}
const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array
wheelPrimitive.setIndices(document.createAccessor('Steering_Wheel_indices').setType('SCALAR').setArray(IndexArray.from(wheelIndices)).setBuffer(buffer))

primitive.setIndices(
  document
    .createAccessor(primitive.getIndices().getName())
    .setType('SCALAR')
    .setArray(new (indices.constructor)(bodyTriangles))
    .setBuffer(buffer),
)

const wheelMesh = document.createMesh(WHEEL_NODE).addPrimitive(wheelPrimitive).setWeights(body.getMesh().getWeights())
const wheelNode = document
  .createNode(WHEEL_NODE)
  .setMesh(wheelMesh)
  .setSkin(skin)
  .setTranslation(body.getTranslation())
  .setRotation(body.getRotation())
  .setScale(body.getScale())
body.getParentNode().addChild(wheelNode)

// Accessors the old body index list no longer uses.
for (const accessor of root.listAccessors()) {
  if (accessor.listParents().every((parent) => parent === root)) accessor.dispose()
}

await io.write(MODEL, document)
console.log(`wrote ${MODEL}`)
