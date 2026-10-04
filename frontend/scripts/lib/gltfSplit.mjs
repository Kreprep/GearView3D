// Shared by the scripts that split a part out of a forklift.glb mesh into a
// node of its own (split-steering-wheel.mjs, split-parts.mjs), so the app can
// move it on its own. The edit is surgical rather than a Blender round trip,
// which would rebuild the skin, the node hierarchy and the textures that
// lib/vehicleRig.js and the hotspot positions depend on:
//
// - The part's triangles leave the source primitive's index list. The source
//   vertex data is left exactly as it was (the part's vertices stay in it,
//   unreferenced), so nothing else about the source mesh can change.
// - A new mesh holds copies of those vertices (every attribute, and every
//   morph target) with the same material and morph weights, on a new node
//   beside the source node, bound to the same skin. So it renders exactly
//   where it did.

// glTF matrices are column-major 4x4 arrays.
export const mat4 = {
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

export const vec3 = {
  subtract: (a, b) => a.map((value, i) => value - b[i]),
  scale: (a, factor) => a.map((value) => value * factor),
  dot: (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0),
  length: (a) => Math.hypot(...a),
  normalize: (a) => a.map((value) => value / Math.hypot(...a)),
}

export const findNode = (root, name) => root.listNodes().find((node) => node.getName() === name)

// Where a skinned primitive's vertex is drawn, in the model's own frame:
// skinning places it at jointWorld * inverseBind * position, weighted over
// its joints. (The node's own transform chain carries an offset the skinning
// cancels; see lib/vehicleRig.js.) Returns drawn(index) -> [x, y, z].
export function drawnPositions(primitive, skin) {
  const position = primitive.getAttribute('POSITION')
  const joints = primitive.getAttribute('JOINTS_0')
  const weights = primitive.getAttribute('WEIGHTS_0')
  const inverseBinds = skin.getInverseBindMatrices()
  const jointMatrices = skin.listJoints().map((joint, index) => mat4.multiply(joint.getWorldMatrix(), inverseBinds.getElement(index, [])))
  return (index) => {
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
}

// The loose parts of an indexed primitive: vertices joined by the triangles
// that use them. Returns partOf(vertex) -> a representative vertex index.
export function looseParts(indices, vertexCount) {
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
  return find
}

// The triangles of the loose parts whose every drawn vertex passes
// `inside(point)`, and the rest. Returns { partTriangles, restTriangles },
// flat vertex-index lists.
export function selectLooseParts(primitive, skin, inside) {
  const indices = primitive.getIndices().getArray()
  const vertexCount = primitive.getAttribute('POSITION').getCount()
  const drawn = drawnPositions(primitive, skin)
  const partOf = looseParts(indices, vertexCount)
  const partInside = new Map()
  for (let i = 0; i < vertexCount; i += 1) {
    const part = partOf(i)
    if (partInside.get(part) === false) continue
    partInside.set(part, (partInside.get(part) ?? true) && inside(drawn(i)))
  }
  const isPart = (vertex) => partInside.get(partOf(vertex)) === true
  const partTriangles = []
  const restTriangles = []
  for (let t = 0; t < indices.length; t += 3) {
    const triangle = [indices[t], indices[t + 1], indices[t + 2]]
    ;(triangle.every(isPart) ? partTriangles : restTriangles).push(...triangle)
  }
  return { partTriangles, restTriangles }
}

// A box test in the model's own frame, for selectLooseParts.
export const insideBox = (min, max) => (point) => point.every((value, axis) => value >= min[axis] && value <= max[axis])

// Move `partTriangles` out of `sourceNode`'s mesh into a new node `name`,
// beside it, on the same skin, with copies of the vertices they use.
// `restTriangles` stay in the source's index list.
export function splitOut(document, sourceNode, name, { partTriangles, restTriangles }) {
  const root = document.getRoot()
  const sourceMesh = sourceNode.getMesh()
  const primitive = sourceMesh.listPrimitives()[0]
  const indices = primitive.getIndices().getArray()
  const vertexCount = primitive.getAttribute('POSITION').getCount()

  // The part's own vertex list, in first-use order.
  const remap = new Map()
  const partVertices = []
  const partIndices = partTriangles.map((vertex) => {
    if (!remap.has(vertex)) {
      remap.set(vertex, partVertices.length)
      partVertices.push(vertex)
    }
    return remap.get(vertex)
  })

  const buffer = root.listBuffers()[0]
  const sliceAccessor = (accessor) => {
    const size = accessor.getElementSize()
    const source = accessor.getArray()
    const array = new source.constructor(partVertices.length * size)
    partVertices.forEach((vertex, i) => array.set(source.subarray(vertex * size, vertex * size + size), i * size))
    return document
      .createAccessor(accessor.getName())
      .setType(accessor.getType())
      .setArray(array)
      .setNormalized(accessor.getNormalized())
      .setBuffer(buffer)
  }

  const partPrimitive = document.createPrimitive().setMaterial(primitive.getMaterial()).setMode(primitive.getMode())
  for (const semantic of primitive.listSemantics()) partPrimitive.setAttribute(semantic, sliceAccessor(primitive.getAttribute(semantic)))
  for (const target of primitive.listTargets()) {
    const partTarget = document.createPrimitiveTarget(target.getName())
    for (const semantic of target.listSemantics()) partTarget.setAttribute(semantic, sliceAccessor(target.getAttribute(semantic)))
    partPrimitive.addTarget(partTarget)
  }
  const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array
  partPrimitive.setIndices(document.createAccessor(`${name}_indices`).setType('SCALAR').setArray(IndexArray.from(partIndices)).setBuffer(buffer))

  primitive.setIndices(
    document
      .createAccessor(primitive.getIndices().getName())
      .setType('SCALAR')
      .setArray(new (indices.constructor)(restTriangles))
      .setBuffer(buffer),
  )

  const partMesh = document.createMesh(name).addPrimitive(partPrimitive).setWeights(sourceMesh.getWeights())
  const partNode = document
    .createNode(name)
    .setMesh(partMesh)
    .setSkin(sourceNode.getSkin())
    .setTranslation(sourceNode.getTranslation())
    .setRotation(sourceNode.getRotation())
    .setScale(sourceNode.getScale())
  sourceNode.getParentNode().addChild(partNode)
  return partNode
}

// Accessors nothing uses any more (a source index list that was replaced).
export function disposeUnusedAccessors(document) {
  const root = document.getRoot()
  for (const accessor of root.listAccessors()) {
    if (accessor.listParents().every((parent) => parent === root)) accessor.dispose()
  }
}
