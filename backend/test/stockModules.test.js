import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newModuleRow, stockSkillLinks } from '../src/lib/stockModules.js'

const rows = (...pairs) => pairs.map(([id, sortOrder]) => ({ id, sortOrder }))

test('on an empty database the stock modules come out in stock order', () => {
  assert.deepEqual(newModuleRow(1, []), { id: 1, sortOrder: 1 })
  assert.deepEqual(newModuleRow(2, rows([1, 1])), { id: 2, sortOrder: 2 })
})

test('a new stock module keeps its id when it is free and goes last', () => {
  // The admin moved module 4 to the top.
  assert.deepEqual(newModuleRow(5, rows([1, 2], [2, 3], [3, 4], [4, 1])), { id: 5, sortOrder: 5 })
})

test('an id an admin\'s own module already has is not taken over', () => {
  // The admin's "Add module" handed out 5 before the release that brought
  // the stock module 5.
  assert.deepEqual(newModuleRow(5, rows([1, 1], [2, 2], [3, 3], [4, 4], [5, 5])), { id: 6, sortOrder: 6 })
})

const skill = {
  modules: [
    { module: 'pallet-testing', relation: 'teaches' },
    { module: 'final-driving-test', relation: 'requires' },
    { module: 'gone', relation: 'teaches' },
  ],
}

test('a new skill gets every link to a module the database has', () => {
  assert.deepEqual(stockSkillLinks(skill, { 'pallet-testing': 4, 'final-driving-test': 5 }), [
    { moduleId: 4, relation: 'teaches' },
    { moduleId: 5, relation: 'requires' },
  ])
})

test('an existing skill gets only its links to a module created in this run', () => {
  assert.deepEqual(stockSkillLinks(skill, { 'pallet-testing': 4, 'final-driving-test': 5 }, new Set(['final-driving-test'])), [
    { moduleId: 5, relation: 'requires' },
  ])
  assert.deepEqual(stockSkillLinks(skill, { 'pallet-testing': 4 }, new Set()), [])
})
