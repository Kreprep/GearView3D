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
  { model: 'equipment', label: 'Equipment', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  { model: 'module', label: 'Module', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  { model: 'partCategory', label: 'PartCategory', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  // `draft` is one admin's unfinished work, so it never travels - the same rule
  // as Course below.
  { model: 'part', label: 'Part', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], omit: ['draft'], prunable: true },
  { model: 'partDetail', label: 'PartDetail', orderBy: [{ id: 'asc' }], omit: ['draft'] },
  {
    model: 'practiceQuestion',
    label: 'PracticeQuestion',
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    omit: ['draft'],
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
  { model: 'quizQuestion', label: 'QuizQuestion', orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] },
]

export const exportPath = new URL('../prisma/content-export.json', import.meta.url)

export function stripOmitted(row, omit = []) {
  if (!omit.length) return row
  return Object.fromEntries(Object.entries(row).filter(([key]) => !omit.includes(key)))
}
