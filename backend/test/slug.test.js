import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify, uniqueSlug } from '../src/lib/slug.js'

test('slugify is re-exported from the shared frontend module', () => {
  assert.equal(slugify('Load Handling'), 'load-handling')
})

test('uniqueSlug returns the base unchanged when it is not taken', async () => {
  const result = await uniqueSlug('forklift', async () => false)
  assert.equal(result, 'forklift')
})

test('uniqueSlug appends -2, -3, ... until a free slug is found', async () => {
  const taken = new Set(['forklift', 'forklift-2', 'forklift-3'])
  const result = await uniqueSlug('forklift', async (candidate) => taken.has(candidate))
  assert.equal(result, 'forklift-4')
})

test('uniqueSlug only checks the base once when it is immediately free', async () => {
  let calls = 0
  await uniqueSlug('forklift', async () => {
    calls += 1
    return false
  })
  assert.equal(calls, 1)
})
