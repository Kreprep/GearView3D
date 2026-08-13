// Serialization for the generic per-equipment hotspot admin editor and the
// learner-facing Hotspot Identification page. Mirrors walkAroundHotspots.js's
// shape, minus the fields that only make sense for Forklift's own hardcoded
// walk-around simulation (state gating, defect scenarios) and minus
// builtIn/reset, since admin-created equipment content has no static default
// to reset to.

export const hotspotDraftFields = ['label', 'position', 'category', 'description']

// What the learner-facing Hotspot Identification page consumes.
export function publishedEquipmentHotspot(row) {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    label: row.label,
    position: row.position,
    category: row.category,
    description: row.description,
    sortOrder: row.sortOrder,
  }
}

export function adminEquipmentHotspot(row) {
  return {
    ...publishedEquipmentHotspot(row),
    published: row.published,
    draft: row.draft || null,
    updatedAt: row.updatedAt,
  }
}

// The version an admin is editing: the pending draft if there is one,
// otherwise the published columns.
export function editableEquipmentHotspot(row) {
  if (row.draft) return { ...row.draft }
  return {
    label: row.label,
    position: row.position,
    category: row.category,
    description: row.description,
  }
}
