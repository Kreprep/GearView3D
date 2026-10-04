// Splits the steering wheel out of forklift.glb's Forklift_Body into its own
// Steering_Wheel node, so the simulation can turn it with the steering input
// (docs/revisions/post-defense-plan.md, section 4.2, Phase 3).
//
//   node scripts/split-steering-wheel.mjs            # rewrites public/models/forklift.glb
//   node scripts/split-steering-wheel.mjs --check    # reports, writes nothing
//   node scripts/split-steering-wheel.mjs path.glb   # another copy of the file
//
// The wheel was loose parts of the body mesh: the ring with its two spokes, a
// second ring layer and the hub cap. They were found and confirmed in Blender
// on 2026-09-30. How the split is done, and why not in Blender, is in
// lib/gltfSplit.mjs (shared with split-parts.mjs).
//
// Every other node, mesh, material and texture is untouched. The script
// refuses to run on a file that already has a Steering_Wheel node, so it is
// safe to re-run, and it checks it found exactly the 1,308 faces confirmed in
// Blender before writing.
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { disposeUnusedAccessors, findNode, selectLooseParts, splitOut, vec3 } from './lib/gltfSplit.mjs'

const DEFAULT_MODEL = fileURLToPath(new URL('../public/models/forklift.glb', import.meta.url))
const BODY_NODE = 'Forklift_Body'
const WHEEL_NODE = 'Steering_Wheel'
const EXPECTED_FACES = 1308

// The wheel in the model's own frame (glTF axes, as the viewers show it):
// the ring's centre and its normal, which is the column's axis to within
// 4 degrees. This centre only picks the wheel's faces, and it is 0.0118
// units up the wheel's face from the rim's true centre; the pivot the wheel
// turns about is DEFAULT_RIG.steeringWheel (data/vehicleProfile.js), fitted
// to the split mesh. Keep this one as it is, so the selection still finds
// the 1,308 faces.
const CENTRE = [0, 0.3197, 0.0672]
const AXIS = vec3.normalize([0, 0.8804, -0.4743])
// A loose part belongs to the wheel when every vertex is within this radius
// of the axis and this band along it. The column shroud below the hub and the
// indicator stalk reach further down the axis, so they stay on the body.
const MAX_RADIUS = 0.048
const AXIAL_BAND = [-0.015, 0.005]

const check = process.argv.includes('--check')
const model = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || DEFAULT_MODEL
const io = new NodeIO()
const document = await io.read(model)
const root = document.getRoot()

if (findNode(root, WHEEL_NODE)) {
  console.log(`${WHEEL_NODE} already exists; nothing to do.`)
  process.exit(0)
}

const body = findNode(root, BODY_NODE)
if (body.getMesh().listPrimitives().length !== 1) throw new Error(`${BODY_NODE} should have one primitive`)
const primitive = body.getMesh().listPrimitives()[0]

const inWheel = (point) => {
  const offset = vec3.subtract(point, CENTRE)
  const along = vec3.dot(offset, AXIS)
  const radius = vec3.length(vec3.subtract(offset, vec3.scale(AXIS, along)))
  return radius <= MAX_RADIUS && along >= AXIAL_BAND[0] && along <= AXIAL_BAND[1]
}
const selection = selectLooseParts(primitive, body.getSkin(), inWheel)
const faces = selection.partTriangles.length / 3
console.log(`wheel: ${faces} faces; body keeps ${selection.restTriangles.length / 3}`)
if (faces !== EXPECTED_FACES) throw new Error(`expected ${EXPECTED_FACES} wheel faces (confirmed in Blender), found ${faces}`)
if (check) process.exit(0)

splitOut(document, body, WHEEL_NODE, selection)
disposeUnusedAccessors(document)

await io.write(model, document)
console.log(`wrote ${model}`)
