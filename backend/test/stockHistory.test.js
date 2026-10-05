import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDefaultCourses } from '../../frontend/src/data/courseDefaults.js'
import { canonicalJson, STOCK_FIELDS, staleStockUpgrades, stockFingerprint, stockRows } from '../src/lib/stockHistory.js'
import { trainingModules } from '../../frontend/src/data/trainingModules.js'
import { SKILL_DEFAULTS, skillRowDefaults } from '../../frontend/src/data/skillDefaults.js'
import { STOCK_HISTORY, STOCK_RELEASES } from '../prisma/stockHistory.js'

const current = { instructions: 'Fasten the seatbelt, then press E.', hint: 'New hint', data: { speedLimitKmh: 18, checkpoints: [] } }
const oldStock = { instructions: 'Press E to start the engine.', hint: 'Old hint', data: { checkpoints: [{ id: 'a' }] } }
const history = Object.fromEntries(Object.entries(oldStock).map(([field, value]) => [field, [stockFingerprint(value)]]))

test('a field still holding an earlier release\'s stock moves to the current stock', () => {
  assert.deepEqual(staleStockUpgrades(oldStock, current, history), current)
})

test('an edited field is left alone, even when its neighbours are upgraded', () => {
  const stored = { ...oldStock, instructions: 'Press E to start the engine. Press your left mouse button to move the camera.' }
  assert.deepEqual(staleStockUpgrades(stored, current, history), { hint: current.hint, data: current.data })
})

test('the fingerprint ignores key order, as a database may reorder a JSON object', () => {
  const reordered = { data: JSON.parse('{"checkpoints":[{"id":"a"}]}') }
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }))
  assert.deepEqual(staleStockUpgrades(reordered, current, history), { data: current.data })
})

test('the fingerprint ignores the digit a database write drops, and no more', () => {
  // Math.PI / 2 as Prisma writes it to a Json column, and back.
  const stored = { heading: 1.570796326794897 }
  assert.equal(stockFingerprint({ heading: Math.PI / 2 }), stockFingerprint(stored))
  assert.deepEqual(staleStockUpgrades({ data: stored }, { data: { heading: 0 } }, { data: [stockFingerprint({ heading: Math.PI / 2 })] }), { data: { heading: 0 } })
  // A real change, however small an admin makes it, still counts.
  assert.notEqual(stockFingerprint({ x: 1.2 }), stockFingerprint({ x: 1.2000001 }))
  assert.notEqual(stockFingerprint({ x: 0.1 }), stockFingerprint({ x: 0.2 }))
})

test('nothing happens without history, a stored row, or a difference', () => {
  assert.deepEqual(staleStockUpgrades(oldStock, current, undefined), {})
  assert.deepEqual(staleStockUpgrades(null, current, history), {})
  assert.deepEqual(staleStockUpgrades(current, current, history), {})
})

test('the recorded history names built-in rows and their stock fields only', () => {
  const rows = stockRows({ buildDefaultCourses, trainingModules, SKILL_DEFAULTS, skillRowDefaults })
  assert.deepEqual(STOCK_RELEASES.slice(0, 2), ['7b5763c', 'c94072f'])
  for (const [table, entries] of Object.entries(STOCK_HISTORY)) {
    assert.ok(STOCK_FIELDS[table], table)
    for (const [key, fields] of Object.entries(entries)) {
      assert.ok(rows[table][key], `${table} ${key}`)
      for (const [field, prints] of Object.entries(fields)) {
        assert.ok(STOCK_FIELDS[table].includes(field), `${table} ${key}.${field}`)
        assert.ok(prints.every((print) => /^[0-9a-f]{32}$/.test(print)), `${table} ${key}.${field}`)
      }
    }
  }
})

test("no recorded fingerprint is today's stock, so a current row is never rewritten", () => {
  const rows = stockRows({ buildDefaultCourses, trainingModules, SKILL_DEFAULTS, skillRowDefaults })
  for (const [table, entries] of Object.entries(STOCK_HISTORY)) {
    for (const [key, fields] of Object.entries(entries)) {
      for (const [field, prints] of Object.entries(fields)) {
        assert.ok(!prints.includes(stockFingerprint(rows[table][key][field])), `${table} ${key}.${field}`)
      }
    }
  }
})

test("a skill's wording and evidence are stock fields; its order is not", () => {
  const rows = stockRows({ buildDefaultCourses, trainingModules, SKILL_DEFAULTS, skillRowDefaults })
  assert.deepEqual(Object.keys(rows.Skill), SKILL_DEFAULTS.map((skill) => skill.id))
  assert.ok(STOCK_FIELDS.Skill.includes('evidence'))
  assert.ok(!STOCK_FIELDS.Skill.includes('sortOrder'))
  const old = { ...rows.Skill['load-chart'], evidence: [{ type: 'step-complete', module: 'pallet-testing', stepId: 'load-limits' }] }
  const skillHistory = { evidence: [stockFingerprint(old.evidence)] }
  assert.deepEqual(staleStockUpgrades(old, rows.Skill['load-chart'], skillHistory, STOCK_FIELDS.Skill), {
    evidence: rows.Skill['load-chart'].evidence,
  })
})
