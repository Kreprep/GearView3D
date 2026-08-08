// Serialization for the admin walk-around hotspot editor. Defaults are
// imported from the frontend rather than duplicated, for the same reason the
// seed imports frontend/src/data: those files stay the single source of truth.
import { walkAroundViewerHotspots } from '../../../frontend/src/data/viewerHotspots.js'

export const hotspotDraftFields = [
  'label',
  'position',
  'state',
  'category',
  'inspect',
  'safeFeedback',
  'unsafeFeedback',
  'unsafeScenarios',
]

// What a learner's Walk-Around Check page consumes.
export function publishedHotspot(row) {
  return {
    id: row.id,
    label: row.label,
    position: row.position,
    state: row.state,
    category: row.category,
    inspect: row.inspect,
    safeFeedback: row.safeFeedback,
    unsafeFeedback: row.unsafeFeedback,
    unsafeScenarios: row.unsafeScenarios || [],
    sortOrder: row.sortOrder,
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
  return {
    label: row.label,
    position: row.position,
    state: row.state,
    category: row.category,
    inspect: row.inspect,
    safeFeedback: row.safeFeedback,
    unsafeFeedback: row.unsafeFeedback,
    unsafeScenarios: row.unsafeScenarios || [],
  }
}

export function defaultHotspotFor(hotspotId) {
  return walkAroundViewerHotspots.find((hotspot) => hotspot.id === hotspotId) || null
}
