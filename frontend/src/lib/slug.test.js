import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify } from './slug.js'

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Load Handling'), 'load-handling')
})

test('slugify collapses runs of non-alphanumeric characters to one hyphen', () => {
  assert.equal(slugify('Engine -- Off!!  Check'), 'engine-off-check')
})

test('slugify strips leading/trailing hyphens', () => {
  assert.equal(slugify('  --Forklift Mast--  '), 'forklift-mast')
})

test('slugify on empty/undefined input is an empty string, not a throw', () => {
  assert.equal(slugify(''), '')
  assert.equal(slugify(undefined), '')
  assert.equal(slugify('!!!'), '')
})
