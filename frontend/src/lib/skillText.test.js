import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translate } from '../i18n/translate.js'
import { describeEvidence, SKILL_STATUS_KEYS, skillCategoryKey } from './skillText.js'
import { SKILL_CATEGORIES, SKILL_STATUSES } from './skillProgress.js'

const en = (key, values) => translate('en', key, values)
const fil = (key, values) => translate('fil', key, values)

test('every rule type reads as a sentence, naming the titles it was given', () => {
  const step = { type: 'step-complete', module: 'load-handling', stepId: 'driving-course', moduleTitle: 'Load Handling', stepTitle: 'Driving course' }
  assert.equal(describeEvidence(step, en), 'Finish "Driving course" (Load Handling)')

  const clean = { ...step, type: 'clean-run', rules: ['tail-swing', 'obstacle-ahead'], severity: 'danger' }
  assert.equal(
    describeEvidence(clean, en),
    'Finish "Driving course" (Load Handling) on a run with none of these at danger level: closed on an obstacle ahead, swung the tail near an obstacle',
  )
  assert.match(describeEvidence({ ...clean, rules: [] }, en), /no danger-level safety sign/)
  assert.match(describeEvidence({ ...clean, rules: [], severity: 'any' }, en), /no safety signs/)

  assert.equal(describeEvidence({ type: 'quiz-score', module: 'x', moduleTitle: 'Pallets', min: 80 }, en), 'Score at least 80% on the Pallets quiz (your latest try)')
  assert.match(describeEvidence({ type: 'quiz-score', context: 'parts', min: 80 }, en), /parts quiz/)
  assert.match(describeEvidence({ type: 'parts-viewed' }, fil), /bawat parte/)
  assert.match(describeEvidence({ type: 'caution-recovered' }, en), /warning sign/)
})

test('a deleted step or module falls back to its id', () => {
  assert.equal(describeEvidence({ type: 'step-complete', module: 'gone', stepId: 'old-step' }, en), 'Finish "old-step" (gone)')
})

test('every status and category has chrome in both languages', () => {
  for (const status of SKILL_STATUSES) {
    for (const lang of ['en', 'fil']) assert.notEqual(translate(lang, SKILL_STATUS_KEYS[status]), SKILL_STATUS_KEYS[status])
  }
  for (const category of SKILL_CATEGORIES) {
    for (const lang of ['en', 'fil']) assert.notEqual(translate(lang, skillCategoryKey(category)), skillCategoryKey(category))
  }
})
