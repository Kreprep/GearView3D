// Records an earlier release's stock values in prisma/stockHistory.js, so the
// seed can recognise a built-in step or module that still holds them and
// move it to the current stock (src/lib/stockHistory.js).
//
//   git worktree add --detach ../gv-old <commit>
//   (link ../gv-old/frontend/node_modules to this checkout's frontend/node_modules)
//   node scripts/recordStockHistory.js ../gv-old <commit>
//   git worktree remove ../gv-old
//
// Run it for every release that has been deployed or seeded somewhere, before
// a change to stock content ships. Fingerprints are merged, never removed: a
// database can be any number of releases behind. Values equal to the current
// stock are skipped, since there is nothing to upgrade from them.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as courseDefaults from '../../frontend/src/data/courseDefaults.js'
import * as trainingData from '../../frontend/src/data/trainingModules.js'
import { canonicalJson, STOCK_FIELDS, stockFingerprint, stockRows } from '../src/lib/stockHistory.js'
import { STOCK_HISTORY, STOCK_RELEASES } from '../prisma/stockHistory.js'

const [checkout, label] = process.argv.slice(2)
if (!checkout || !label) {
  console.error('Usage: node scripts/recordStockHistory.js <old checkout> <release label>')
  process.exit(1)
}

const oldModule = (file) => import(pathToFileURL(resolve(checkout, 'frontend/src/data', file)).href)
const [oldCourses, oldTraining] = await Promise.all([oldModule('courseDefaults.js'), oldModule('trainingModules.js')])
const earlier = stockRows({ ...oldCourses, ...oldTraining })
const current = stockRows({ ...courseDefaults, ...trainingData })

const history = structuredClone(STOCK_HISTORY)
let added = 0
for (const [table, fields] of Object.entries(STOCK_FIELDS)) {
  for (const [key, row] of Object.entries(earlier[table])) {
    const now = current[table][key]
    if (!now) continue
    for (const field of fields) {
      if (!(field in row) || canonicalJson(row[field]) === canonicalJson(now[field])) continue
      const fingerprint = stockFingerprint(row[field])
      const known = (((history[table] ||= {})[key] ||= {})[field] ||= [])
      if (!known.includes(fingerprint)) {
        known.push(fingerprint)
        added += 1
      }
    }
  }
}

const sortKeys = (object) => Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]))
const sorted = Object.fromEntries(Object.entries(history).map(([table, rows]) => [table, sortKeys(rows)]))
const releases = STOCK_RELEASES.includes(label) ? STOCK_RELEASES : [...STOCK_RELEASES, label]
writeFileSync(
  new URL('../prisma/stockHistory.js', import.meta.url),
  `// Fingerprints of the stock values earlier releases gave built-in rows, per
// table (Course by id, Module by slug), row and field. Written by
// scripts/recordStockHistory.js; read by prisma/seed.js through
// src/lib/stockHistory.js, which moves a field still holding one of them to
// the current stock. Do not edit by hand.
export const STOCK_RELEASES = ${JSON.stringify(releases)}

export const STOCK_HISTORY = ${JSON.stringify(sorted, null, 2)}
`,
)
console.log(`Recorded ${added} fingerprint(s) from ${label}; releases: ${releases.join(', ')}`)
