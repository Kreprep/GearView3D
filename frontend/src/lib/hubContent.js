import { HUB_CONTENT_FIELDS } from '../data/hubContent.js'

// Reader for Equipment.content, the same shape as lib/moduleContent.js is for
// Course rows: an admin override wins when it is a non-blank string, otherwise
// the coded default for that field renders.

function substitute(value, context) {
  return value
    .replaceAll('{equipment}', context.equipmentTitle)
    .replaceAll('{learner}', context.learnerName)
}

export function hubContentDefault(key, context) {
  const field = HUB_CONTENT_FIELDS.find((entry) => entry.key === key)
  return field ? field.default(context) : ''
}

// `context` fills both the token placeholders and the defaults that depend on
// the page's own data:
//   { equipmentTitle, learnerName, hasPartsPage, moduleTitles }
export function resolveHubContent(equipment, context) {
  const overrides = equipment?.content || {}

  return HUB_CONTENT_FIELDS.reduce((resolved, field) => {
    const override = typeof overrides[field.key] === 'string' ? overrides[field.key].trim() : ''
    resolved[field.key] = substitute(override || field.default(context), context)
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
