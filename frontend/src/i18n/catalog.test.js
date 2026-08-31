import '../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalog } from './catalog.js'
import { translate, FALLBACK_LANGUAGE } from './translate.js'
import { tokensIn } from '../lib/interpolate.js'
import { DEFAULT_LANGUAGE, LANGUAGES } from '../lib/language.js'

const languages = Object.keys(catalog)
const base = catalog[FALLBACK_LANGUAGE]

test('translate falls back to English, then to the key itself', () => {
  assert.equal(translate('en', 'common.back'), 'Back')
  assert.equal(translate('xx', 'common.back'), 'Back', 'unknown language falls back to English')
  assert.equal(translate('en', 'nope.not.a.key'), 'nope.not.a.key')
  assert.equal(translate('fil', 'nope.not.a.key'), 'nope.not.a.key')
})

test('translate substitutes named tokens and leaves unfilled ones in place', () => {
  assert.equal(
    translate('en', 'moduleList.state.error', { error: 'offline' }),
    'Training modules could not be loaded: offline',
  )
  // Hub defaults rely on this: {equipment} survives translate() and is
  // substituted later by resolveHubContent. Asserted as "the token is still
  // there", not as an exact sentence - the copy is edited often and this test
  // is about the mechanism, not the wording.
  assert.match(translate('en', 'hubDefaults.kicker'), /\{equipment\}/)
})

test('a reserved count selects the .one / .other variant', () => {
  assert.equal(translate('en', 'catalog.availableModels', { count: 1 }), '1 available model')
  assert.equal(translate('en', 'catalog.availableModels', { count: 3 }), '3 available models')
  assert.equal(translate('en', 'catalog.availableModels', { count: 0 }), '0 available models')
  // Filipino has both keys with the same text - the noun does not inflect, but
  // the keys must exist or the lookup would fall through to English.
  assert.equal(translate('fil', 'catalog.availableModels', { count: 1 }), '1 available na modelo')
  assert.equal(translate('fil', 'catalog.availableModels', { count: 5 }), '5 available na modelo')
})

test('every language declared in LANGUAGES has a catalog, and vice versa', () => {
  assert.deepEqual(
    LANGUAGES.map((language) => language.code).sort(),
    languages.slice().sort(),
  )
})

test('the pure fallback language matches the store default', () => {
  // translate.js cannot import language.js (it must stay browser-free), so the
  // two hold the same literal independently. This is the guard on that.
  assert.equal(FALLBACK_LANGUAGE, DEFAULT_LANGUAGE)
})

test('every language defines exactly the English key set', () => {
  const expected = Object.keys(base).sort()

  for (const language of languages) {
    assert.deepEqual(
      Object.keys(catalog[language]).sort(),
      expected,
      `${language} key set differs from ${FALLBACK_LANGUAGE}`,
    )
  }
})

test('every translation uses the same {tokens} as its English source', () => {
  for (const language of languages) {
    if (language === FALLBACK_LANGUAGE) continue

    for (const [key, value] of Object.entries(catalog[language])) {
      assert.deepEqual(
        tokensIn(value),
        tokensIn(base[key]),
        `${language} "${key}" uses different tokens than ${FALLBACK_LANGUAGE}`,
      )
    }
  }
})

test('every key is prefixed with its own namespace and every value is a non-blank string', () => {
  for (const language of languages) {
    for (const [key, value] of Object.entries(catalog[language])) {
      assert.match(key, /^[a-z][A-Za-z]*\./, `${language} "${key}" has no namespace prefix`)
      assert.equal(typeof value, 'string', `${language} "${key}" is not a string`)
      assert.notEqual(value.trim(), '', `${language} "${key}" is blank`)
    }
  }
})
