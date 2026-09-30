// The tables that hold *content* - everything the admin dashboard edits.
//
// `User`, `ProgressSnapshot` and `SkillSignoffEvent` are deliberately absent:
// those are accounts and learner data, not content. Shipping them between
// machines would overwrite real people's progress, or write sign-offs nobody
// gave into another database's audit trail, with whoever ran the export.
//
// Import order matters. ChecklistItem, QuizQuestion and ModuleSkill have a
// foreign key to Module (ModuleSkill to Skill as well), so those have to exist
// first; the list is written in dependency order and imported in that order.
//
// `key` is a table's primary key when it is not `id`: ModuleSkill's is the
// pair it links.
//
// `prunable` marks the tables whose rows an admin can delete outright, which
// are the only ones `--prune` removes from the target database.
export const contentTables = [
  // `content` (the hub copy overrides) and `simConfig` (the vehicle profile)
  // travel with the row - they are published content, not drafts, so there is
  // nothing to omit here.
  { model: 'equipment', label: 'Equipment', orderBy: [{ id: 'asc' }] },
  { model: 'module', label: 'Module', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  // Not prunable: a skill with sign-offs cannot be deleted (its trail is
  // kept), so --prune would fail on exactly the rows that matter.
  { model: 'skill', label: 'Skill', orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  {
    model: 'moduleSkill',
    label: 'ModuleSkill',
    orderBy: [{ moduleId: 'asc' }, { skillId: 'asc' }],
    key: ['moduleId', 'skillId'],
    prunable: true,
  },
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

// A table's primary key fields, and the `where` that finds one row by them.
export function keyFields(table) {
  return table.key || ['id']
}

export function whereKey(table, row) {
  const fields = keyFields(table)
  if (fields.length === 1) return { [fields[0]]: row[fields[0]] }
  return { [fields.join('_')]: Object.fromEntries(fields.map((field) => [field, row[field]])) }
}

export function stripOmitted(row, omit = []) {
  if (!omit.length) return row
  return Object.fromEntries(Object.entries(row).filter(([key]) => !omit.includes(key)))
}
