// Imports keep explicit .js extensions so this file also loads in plain Node
// (the backend seed script imports it directly).
import { partsHotspots } from './partsData.js'
import { engineOffInspectionChecks } from './inspectionScenarios.js'
import { walkAroundViewerHotspots } from './viewerHotspots.js'

// The stock Hotspot rows: one per physical component, carrying whichever
// surfaces it appears on. This composes the three files that used to seed
// three separate tables, so a component described in both partsData.js and
// viewerHotspots.js - the mast, forks, tires and three others - produces one
// row with both its parts fields and its inspection fields, exactly as the
// merge migration produced from the live tables.
//
// Keep editing partsData.js / viewerHotspots.js / inspectionScenarios.js for
// stock content; this file only joins them. Admin edits stored through the API
// override these per field, and `builtIn` rows can be reset back to them.

function joinBlocks(blocks) {
  return blocks.filter(Boolean).join('\n\n')
}

// partsData.js / viewerHotspots.js / inspectionScenarios.js entries only need
// a filename (e.g. 'forks.jpg') - every reference image lives in this one
// folder, so there's no reason to type the path each time. A value that's
// already a path (starts with '/') or an external URL is left as-is.
function partsImage(image) {
  if (!image) return ''
  if (image.startsWith('/') || image.startsWith('http')) return image
  return `/images/parts/${image}`
}

// The detail card body an admin sees before editing it. Markdown - bullet
// points, bold, and inline images are all allowed anywhere in it.
function partDescription(part) {
  return joinBlocks([
    part.functionText,
    part.inspectionReminder && `**What to inspect**\n\n${part.inspectionReminder}`,
    part.safetyNote && `**Safety**\n\n${part.safetyNote}`,
    part.checklist?.length &&
      `**Quick checklist**\n\n${part.checklist.map((item) => `- ${item}`).join('\n')}`,
    part.relatedModule && `*Related training: ${part.relatedModule}*`,
  ])
}

function inspectionDescription(check) {
  return joinBlocks([
    check.inspect,
    check.feedback && `**Why it matters**\n\n${check.feedback}`,
  ])
}

function hotspotDescription(hotspot) {
  return joinBlocks([
    hotspot.inspect,
    hotspot.unsafeFeedback && `**Why it matters**\n\n${hotspot.unsafeFeedback}`,
  ])
}

function blankHotspot(id, equipmentId) {
  return {
    id,
    equipmentId,
    label: '',
    position: null,
    sortOrder: 0,
    inParts: false,
    inWalkAround: false,
    title: '',
    subtitle: '',
    image: '',
    description: '',
    category: '',
    functionText: '',
    inspectionReminder: '',
    safetyNote: '',
    relatedModule: '',
    checklist: [],
    inspectCategory: '',
    state: '',
    inspect: '',
    safeFeedback: '',
    unsafeFeedback: '',
    unsafeScenarios: [],
  }
}

export function buildDefaultHotspots(equipmentId = 'forklift') {
  const rows = new Map()

  const rowFor = (id) => {
    if (!rows.has(id)) rows.set(id, blankHotspot(id, equipmentId))
    return rows.get(id)
  }

  // Parts first, so the merged list keeps the identification page's order.
  for (const [index, part] of partsHotspots.entries()) {
    Object.assign(rowFor(part.id), {
      label: part.label,
      position: part.position,
      sortOrder: index + 1,
      inParts: true,
      category: part.category,
      functionText: part.functionText,
      inspectionReminder: part.inspectionReminder,
      safetyNote: part.safetyNote,
      relatedModule: part.relatedModule,
      checklist: part.checklist || [],
      title: part.label,
      subtitle: part.category,
      image: partsImage(part.image),
      description: partDescription(part),
    })
  }

  // Inspection markers. A component already seeded as a part keeps its
  // position, category and detail card - the inspection grouping is a separate
  // field precisely because they differ (the mast is "Load Handling Parts" to
  // identify and "Exterior condition" to inspect).
  for (const [index, hotspot] of walkAroundViewerHotspots.entries()) {
    const row = rowFor(hotspot.id)
    const isNew = !row.inParts

    Object.assign(row, {
      inWalkAround: true,
      inspectCategory: hotspot.category || '',
      state: hotspot.state || '',
      inspect: hotspot.inspect || '',
      safeFeedback: hotspot.safeFeedback || '',
      unsafeFeedback: hotspot.unsafeFeedback || '',
      unsafeScenarios: hotspot.unsafeScenarios || [],
    })

    if (isNew) {
      Object.assign(row, {
        label: hotspot.label,
        position: hotspot.position,
        sortOrder: 100 + index + 1,
        title: hotspot.label,
        subtitle: hotspot.category || '',
        image: partsImage(hotspot.image),
        description: hotspotDescription(hotspot),
      })
    }
  }

  // Checks that describe something with no marker of its own still need a
  // detail card, so they become detail-only rows: no position, no surface.
  for (const [index, check] of engineOffInspectionChecks.entries()) {
    if (rows.has(check.id)) continue

    Object.assign(rowFor(check.id), {
      label: check.label,
      sortOrder: 900 + index + 1,
      title: check.label,
      subtitle: check.targetArea || '',
      image: partsImage(check.image),
      description: inspectionDescription(check),
    })
  }

  return [...rows.values()]
}

export function defaultHotspotFor(hotspotId) {
  return buildDefaultHotspots().find((hotspot) => hotspot.id === hotspotId) || null
}
