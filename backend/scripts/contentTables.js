// The tables that hold *content* - everything the admin dashboard edits.
//
// `User` and `ProgressSnapshot` are deliberately absent: those are accounts and
// learner data, not content, and shipping them between machines would overwrite
// real people's progress with whoever ran the export.
//
// Import order matters. ChecklistItem and QuizQuestion have a foreign key to
// Module, so Module has to exist first; the list is written in dependency order
// and imported in that order.
export const contentTables = [
  { model: 'equipment', label: 'Equipment', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  { model: 'module', label: 'Module', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  { model: 'part', label: 'Part', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  { model: 'partDetail', label: 'PartDetail', orderBy: [{ id: 'asc' }] },
  {
    model: 'course',
    label: 'Course',
    orderBy: [{ moduleSlug: 'asc' }, { sortOrder: 'asc' }],
    // `draft` is one admin's unfinished work and `updatedAt` is managed by the
    // database, so neither travels.
    omit: ['draft', 'updatedAt'],
    // The only content an admin can delete outright, so it is the only table
    // `--prune` touches.
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
