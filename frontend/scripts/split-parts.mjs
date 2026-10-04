// Splits the parts the defect library bends out of forklift.glb's meshes into
// nodes of their own (docs/modules/module-improvements-plan.md, section 3.4,
// Phase 4): the two fork tines out of Lift_Carriage (a tine droops for the
// bent-fork defect) and one bar of the overhead guard's roof out of
// Forklift_Body (it sags for the bent-guard-bar defect). data/defectLibrary.js
// names them, and lib/vehicleRig.js lifts the tines with the carriage.
//
//   node scripts/split-parts.mjs            # rewrites public/models/forklift.glb
//   node scripts/split-parts.mjs --check    # reports, writes nothing
//   node scripts/split-parts.mjs path.glb   # another copy of the file
//
// How the split is done, and why not in Blender, is in lib/gltfSplit.mjs
// (shared with split-steering-wheel.mjs). Nothing moves: each part renders
// exactly where it did, so rigGeometry.js's measurements still hold once the
// rig measures the carriage and its tines together.
//
// The parts were found and measured in Blender on 2026-10-05 (forklift.glb
// imported, island bounding boxes in glTF axes): each is every loose part of
// its source mesh lying wholly inside a box in the model's own frame. A tine
// is its blade, its shank and the hook over the carriage bar, at x 0.052 to
// 0.084 either side of the centre; the roof bar is the middle one of the
// three on the operator's left (+X), over the seat. The triangle counts are
// Blender's for the same boxes, and the script refuses to write unless it
// finds exactly those. Left and right are the operator's: +X is the left,
// as Wheel_FL is.
//
// The script refuses to split a part whose node already exists, so it is
// safe to re-run.
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { disposeUnusedAccessors, findNode, insideBox, selectLooseParts, splitOut } from './lib/gltfSplit.mjs'

const DEFAULT_MODEL = fileURLToPath(new URL('../public/models/forklift.glb', import.meta.url))

const PARTS = [
  { name: 'Fork_L', source: 'Lift_Carriage', min: [0.045, -0.01, 0.25], max: [0.09, 0.15, 0.61], faces: 587 },
  { name: 'Fork_R', source: 'Lift_Carriage', min: [-0.09, -0.01, 0.25], max: [-0.045, 0.15, 0.61], faces: 586 },
  { name: 'Guard_Slat', source: 'Forklift_Body', min: [0.035, 0.465, -0.015], max: [0.067, 0.49, 0.065], faces: 112 },
]

const check = process.argv.includes('--check')
const model = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || DEFAULT_MODEL
const io = new NodeIO()
const document = await io.read(model)
const root = document.getRoot()

const todo = PARTS.filter((part) => {
  if (!findNode(root, part.name)) return true
  console.log(`${part.name} already exists; skipped.`)
  return false
})

// Select every part before splitting any, so each selection reads its source
// as Blender measured it.
const selections = todo.map((part) => {
  const source = findNode(root, part.source)
  if (!source?.getMesh()) throw new Error(`no ${part.source} mesh`)
  if (source.getMesh().listPrimitives().length !== 1) throw new Error(`${part.source} should have one primitive`)
  const selection = selectLooseParts(source.getMesh().listPrimitives()[0], source.getSkin(), insideBox(part.min, part.max))
  const faces = selection.partTriangles.length / 3
  console.log(`${part.name}: ${faces} faces out of ${part.source}`)
  if (faces !== part.faces) throw new Error(`expected ${part.faces} ${part.name} faces (measured in Blender), found ${faces}`)
  return { part, source }
})
if (check || !todo.length) process.exit(0)

// Two parts can come out of one source: each split reselects against what
// the last one left, which differs from the first selection only by the
// triangles already taken.
for (const { part, source } of selections) {
  const selection = selectLooseParts(source.getMesh().listPrimitives()[0], source.getSkin(), insideBox(part.min, part.max))
  if (selection.partTriangles.length / 3 !== part.faces) throw new Error(`${part.name} changed between selections`)
  splitOut(document, source, part.name, selection)
}
disposeUnusedAccessors(document)

await io.write(model, document)
console.log(`wrote ${model}`)
