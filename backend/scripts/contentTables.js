// The tables that hold *content* - everything the admin dashboard edits.
//
// `User` and `ProgressSnapshot` are deliberately absent: those are accounts and
// learner data, not content, and shipping them between machines would overwrite
// real people's progress with whoever ran the export.
//
// Import order matters. ChecklistItem and QuizQuestion have a foreign key to
// Module, so Module has to exist first; the list is written in dependency order
// and imported in that order.
//
// `prunable` marks the tables whose rows an admin can delete outright, which
// are the only ones `--prune` removes from the target database.
export const contentTables = [
  // `content` (the hub copy overrides) and `simConfig` (the vehicle profile)
  // travel with the row - they are published content, not drafts, so there is
  // nothing to omit here.
  { model: 'equipment', label: 'Equipment', orderBy: [{ id: 'asc' }] },
  { model: 'module', label: 'Module', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  { model: 'hotspotCategory', label: 'HotspotCategory', orderBy: [{ sortOrder: 'asc' }] },
  // Every marker on the model, whichever surface shows it. `draft` is one
  // admin's unfinished work and `updatedAt` is database-managed, so neither
  // travels - the same rule as Course below.
  {
    model: 'hotspot',
    label: 'Hotspot',
    orderBy: [{ sortOrder: 'asc' }],
    omit: ['draft', 'updatedAt'],
    prunable: true,
  },
  {
    model: 'course',
    label: 'Course',
    orderBy: [{ moduleSlug: 'asc' }, { sortOrder: 'asc' }],
    // `draft` is one admin's unfinished work and `updatedAt` is managed by the
    // database, so neither travels.
    omit: ['draft', 'updatedAt'],
    prunable: true,
  },
  { model: 'checklistItem', label: 'ChecklistItem', orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] },
  // Module quizzes and parts quizzes share this table; parts questions have a
  // null moduleId, so ordering leads with context.
  {
    model: 'quizQuestion',
    label: 'QuizQuestion',
    orderBy: [{ context: 'asc' }, { sortOrder: 'asc' }],
    prunable: true,
  },
]

export const exportPath = new URL('../prisma/content-export.json', import.meta.url)

export function stripOmitted(row, omit = []) {
  if (!omit.length) return row
  return Object.fromEntries(Object.entries(row).filter(([key]) => !omit.includes(key)))
}
