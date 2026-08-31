import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clamp } from './math.js'

test('clamp passes through a value already inside the range', () => {
  assert.equal(clamp(5, 0, 10), 5)
})

test('clamp pins a value below the range to the minimum', () => {
  assert.equal(clamp(-5, 0, 10), 0)
})

test('clamp pins a value above the range to the maximum', () => {
  assert.equal(clamp(15, 0, 10), 10)
})
