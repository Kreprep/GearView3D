import { interpolate } from '../lib/interpolate.js'
import { catalog } from './catalog.js'

// Pure translation: no React, no localStorage, no document. data/hubContent.js
// reads its defaults through this file, and data/ is backend-importable by
// contract (prisma/seed.js imports it directly), so nothing here may touch a
// browser global. The same discipline lib/math.js applies for three.js.
//
// That is also why the fallback language is a literal rather than an import of
// DEFAULT_LANGUAGE: lib/language.js reads localStorage and sets <html lang> at
// import time. i18n/catalog.test.js asserts the two agree.
export const FALLBACK_LANGUAGE = 'en'

// A reserved `count` value selects `<key>.one` / `<key>.other` when those keys
// exist. That is the whole plural story - exactly two plurals exist in the app
// and Filipino does not inflect a noun after a numeral, so a CLDR engine would
// be machinery for nothing. Every other "N of M" form is a whole-sentence key
// with named tokens, because word order differs between the languages.
function lookup(table, key, values) {
  if (!table) return undefined

  if (values && typeof values.count === 'number') {
    const variant = table[`${key}.${values.count === 1 ? 'one' : 'other'}`]
    if (typeof variant === 'string') return variant
  }

  const direct = table[key]
  return typeof direct === 'string' ? direct : undefined
}

// Fallback chain: the requested language, then English, then the key itself.
// A raw key is loud in development and harmless in production - never a blank
// button, which is what returning '' would produce.
export function translate(lang, key, values) {
  const template =
    lookup(catalog[lang], key, values) ?? lookup(catalog[FALLBACK_LANGUAGE], key, values)

  if (template === undefined) return key
  return interpolate(template, values)
}
