// Serialization for the one hotspot table. Defaults are imported from the
// frontend rather than duplicated, for the same reason the seed imports
// frontend/src/data: those files stay the single source of truth.
import { buildDefaultHotspots, defaultHotspotFor } from '../../../frontend/src/data/hotspotDefaults.js'

export { buildDefaultHotspots, defaultHotspotFor }

// Everything an admin can edit, and therefore everything a draft may carry.
// `equipmentId` is absent on purpose: a hotspot cannot be moved to another
// equipment by editing it, since its id and the learner progress keyed on that
// id belong to the equipment it was created under.
export const hotspotDraftFields = [
  'label',
  'position',
  'inParts',
  'inWalkAround',
  'title',
  'subtitle',
  'image',
  'description',
  'category',
  'functionText',
  'inspectionReminder',
  'safetyNote',
  'relatedModule',
  'checklist',
  'inspectCategory',
  'state',
  'inspect',
  'safeFeedback',
  'unsafeFeedback',
  'unsafeScenarios',
]

// What a learner consumes. The detail card fields ride along because every
// surface renders the same PartDetailCard from them.
export function publishedHotspot(row) {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    label: row.label,
    position: row.position,
    sortOrder: row.sortOrder,
    inParts: row.inParts,
    inWalkAround: row.inWalkAround,
    title: row.title,
    subtitle: row.subtitle,
    image: row.image,
    description: row.description,
    category: row.category,
    functionText: row.functionText,
    inspectionReminder: row.inspectionReminder,
    safetyNote: row.safetyNote,
    relatedModule: row.relatedModule,
    checklist: row.checklist || [],
    inspectCategory: row.inspectCategory,
    state: row.state,
    inspect: row.inspect,
    safeFeedback: row.safeFeedback,
    unsafeFeedback: row.unsafeFeedback,
    unsafeScenarios: row.unsafeScenarios || [],
  }
}

export function adminHotspot(row) {
  return {
    ...publishedHotspot(row),
    published: row.published,
    builtIn: row.builtIn,
    draft: row.draft || null,
    updatedAt: row.updatedAt,
  }
}

// The version an admin is editing: the pending draft if there is one,
// otherwise the published columns.
export function editableHotspot(row) {
  if (row.draft) return { ...row.draft }

  const editable = {}
  for (const field of hotspotDraftFields) {
    editable[field] = row[field]
  }
  return editable
}

// The detail card the learner-facing PartDetailCard renders, keyed by id -
// the shape the frontend has always consumed for part details.
export function hotspotDetail(row) {
  return {
    id: row.id,
    title: row.title || row.label,
    subtitle: row.subtitle || row.category || row.inspectCategory,
    image: row.image,
    description: row.description || row.functionText,
  }
}
