// Upgrading built-in content an admin never touched.
//
// The seed is create-if-missing: it never overwrites a row, so an edit made
// through the dashboard survives every boot. The cost is that a built-in step
// whose stock text or geometry improved in a release keeps the old version
// until someone presses "Reset to default", which also throws away any edits
// on that step.
//
// This closes the gap without that risk. backend/prisma/stockHistory.js
// (written by scripts/recordStockHistory.js) records, per table (built-in
// Course rows by id, Module rows by slug, built-in Skill rows by id) and
// field, a fingerprint of the
// stock value each earlier release shipped. A field whose stored value matches
// one of them is still exactly what a release put there, never edited, so the
// seed moves it to the current stock value. A field an admin changed, even by
// one character, matches nothing and is left alone. Fields are judged one by
// one, so an admin's edited instructions on a step do not hold back its
// untouched hint.
import { createHash } from 'node:crypto'

// Significant digits a number is compared at. Prisma writes a Json column's
// numbers with 16, so a stock value read back from the database is not
// always the one the data file holds: Math.PI / 2 is stored as
// 1.570796326794897. Found by the module improvements Phase 8 rehearsal;
// without this, a stock rotation or heading never matched its fingerprint.
const NUMBER_PRECISION = 15

// JSON with object keys sorted and numbers rounded to NUMBER_PRECISION, so
// the same value fingerprints the same however the database or a data file
// ordered its keys, and whichever of them last wrote its numbers.
export function canonicalJson(value) {
  return JSON.stringify(value ?? null, (key, entry) => {
    if (typeof entry === 'number' && Number.isFinite(entry)) return Number(entry.toPrecision(NUMBER_PRECISION))
    return entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.keys(entry).sort().map((name) => [name, entry[name]]))
      : entry
  })
}

export function stockFingerprint(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex').slice(0, 32)
}

// The fields a release's stock sets, per table.
export const COURSE_STOCK_FIELDS = ['title', 'objective', 'instructions', 'hint', 'goalType', 'data', 'content']
export const MODULE_STOCK_FIELDS = ['title', 'fullTitle', 'subtitle', 'description', 'imageUrl']
// A skill's wording and evidence. Its place in the list and its module links
// are the admin's, so neither is upgraded.
export const SKILL_STOCK_FIELDS = ['title', 'description', 'category', 'tesdaRef', 'evidence']

// Each table's stock rows, keyed the way STOCK_HISTORY keys them, from a
// checkout's data modules (the current one, or an earlier release's). A
// release from before the Skills Checklist has no skill defaults, so no
// Skill rows.
export function stockRows({ buildDefaultCourses, trainingModules, SKILL_DEFAULTS = [], skillRowDefaults }) {
  return {
    Course: Object.fromEntries(buildDefaultCourses().map((course) => [course.id, course])),
    Module: Object.fromEntries(
      trainingModules.map((module) => [module.slug, { ...module, fullTitle: module.fullTitle || module.title }]),
    ),
    Skill: Object.fromEntries(SKILL_DEFAULTS.map((skill, index) => [skill.id, skillRowDefaults(skill, index)])),
  }
}

export const STOCK_FIELDS = { Course: COURSE_STOCK_FIELDS, Module: MODULE_STOCK_FIELDS, Skill: SKILL_STOCK_FIELDS }

// The fields of `stored` (a row, or a draft payload) still holding an earlier
// release's stock value, moved to `current`'s. Returns the changed fields
// only, empty when there is nothing to upgrade. `history` is one row's entry
// in STOCK_HISTORY: { field: [fingerprint, ...] }.
export function staleStockUpgrades(stored, current, history, fields = COURSE_STOCK_FIELDS) {
  const upgrades = {}
  if (!stored || !current || !history) return upgrades
  for (const field of fields) {
    if (!(field in current) || !history[field]?.length) continue
    if (canonicalJson(stored[field]) === canonicalJson(current[field])) continue
    if (history[field].includes(stockFingerprint(stored[field]))) upgrades[field] = current[field]
  }
  return upgrades
}
