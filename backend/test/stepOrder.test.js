import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeNewStep } from '../src/lib/stepOrder.js'

const stock = ['briefing', 'a', 'b', 'new', 'c', 'summary']
const rows = (...ids) => ids.map((id, index) => ({ id, sortOrder: index + 1 }))

test('a new step goes after its stock predecessor and the rest move down one', () => {
  assert.deepEqual(placeNewStep(stock, rows('briefing', 'a', 'b', 'c', 'summary'), 'new'), {
    sortOrder: 4,
    shifted: [
      { id: 'c', sortOrder: 5 },
      { id: 'summary', sortOrder: 6 },
    ],
  })
})

test("the admin's order of the other rows is kept", () => {
  // The admin moved c before b, and added a step of their own at the end.
  const stored = [
    { id: 'briefing', sortOrder: 1 },
    { id: 'a', sortOrder: 2 },
    { id: 'c', sortOrder: 3 },
    { id: 'b', sortOrder: 4 },
    { id: 'summary', sortOrder: 5 },
    { id: 'mine', sortOrder: 6 },
  ]
  assert.deepEqual(placeNewStep(stock, stored, 'new'), {
    sortOrder: 5,
    shifted: [
      { id: 'summary', sortOrder: 6 },
      { id: 'mine', sortOrder: 7 },
    ],
  })
})

test('a deleted predecessor falls back to the one before it', () => {
  assert.equal(placeNewStep(stock, rows('briefing', 'a', 'c', 'summary'), 'new').sortOrder, 3)
})

test('with no predecessor left the step goes before its successor, else last', () => {
  assert.deepEqual(placeNewStep(stock, rows('c', 'summary'), 'briefing'), {
    sortOrder: 1,
    shifted: [
      { id: 'c', sortOrder: 2 },
      { id: 'summary', sortOrder: 3 },
    ],
  })
  assert.deepEqual(placeNewStep(stock, rows('mine'), 'summary'), { sortOrder: 2, shifted: [] })
})

test('an empty module takes the step first, so a fresh database comes out in stock order', () => {
  const stored = []
  for (const id of stock) {
    const { sortOrder, shifted } = placeNewStep(stock, stored, id)
    assert.deepEqual(shifted, [])
    stored.push({ id, sortOrder })
  }
  assert.deepEqual(stored, rows(...stock))
})
