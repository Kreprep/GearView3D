import { HUB_CONTENT_FIELDS } from '../data/hubContent.js'
import { DEFAULT_LANGUAGE } from './language.js'
import { interpolate } from './interpolate.js'

// Reader for Equipment.content, the same shape as lib/moduleContent.js is for
// Course rows: an admin override wins when it is a non-blank string, otherwise
// the coded default for that field renders.

function substitute(value, context) {
  return interpolate(value, {
    equipment: context.equipmentTitle,
    learner: context.learnerName,
  })
}

// Per-language overrides are suffixed keys on the same flat object - `heading`
// is English, `heading_fil` is Filipino. Not a nested { en, fil } map, because
// the PATCH route (backend/src/routes/admin.js) keeps only entries whose value
// is a non-blank *string*: a nested object would be silently dropped on save.
// The suffixed shape is what that filter was already written for, so there is
// no backend change and no migration - every content row already in the
// database is a valid English layer.
//
// English is unsuffixed rather than `heading_en` for exactly that reason.
// Confine the stringly-typed part to this one function.
export function overrideKey(key, lang) {
  return !lang || lang === DEFAULT_LANGUAGE ? key : `${key}_${lang}`
}

function readOverride(overrides, key) {
  return typeof overrides[key] === 'string' ? overrides[key].trim() : ''
}

export function hubContentDefault(key, context, lang = DEFAULT_LANGUAGE) {
  const field = HUB_CONTENT_FIELDS.find((entry) => entry.key === key)
  return field ? field.default(context, lang) : ''
}

// `context` fills both the token placeholders and the defaults that depend on
// the page's own data:
//   { equipmentTitle, learnerName, hasPartsPage, moduleTitles }
//
// Resolution order is this language's override, then the English override, then
// the coded default. That middle step is deliberate: an admin who wrote only
// English copy for their equipment should see *their* words in Filipino mode,
// not stock Filipino that contradicts them.
export function resolveHubContent(equipment, context, lang = DEFAULT_LANGUAGE) {
  const overrides = equipment?.content || {}

  return HUB_CONTENT_FIELDS.reduce((resolved, field) => {
    const localized = readOverride(overrides, overrideKey(field.key, lang))
    const base = readOverride(overrides, field.key)
    resolved[field.key] = substitute(localized || base || field.default(context, lang), context)
    return resolved
  }, {})
}

// The context a page builds before it has loaded its modules/hotspots, so the
// same defaults render while loading as after.
export function hubContentContext({
  equipmentTitle = 'Equipment',
  learnerName = 'learner',
  hasPartsPage = false,
  moduleTitles = [],
} = {}) {
  return { equipmentTitle, learnerName, hasPartsPage, moduleTitles }
}
