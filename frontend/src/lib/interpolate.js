// {token} substitution, shared by the i18n catalog and lib/hubContent.js.
//
// Extracted so there is exactly one implementation: hub copy is admin-editable
// text carrying {equipment}/{learner}, and translated strings carry whatever
// the sentence needs, but both are "a template plus a bag of values".
//
// An unknown token is left in place rather than blanked. That is load-bearing,
// not lenient: a hub default is translated first (which consumes the tokens the
// translation supplies) and substituted again later by resolveHubContent, so
// the {equipment} a translation does not fill has to survive the first pass.
export function interpolate(template, values) {
  if (typeof template !== 'string') return ''
  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (match, token) =>
    Object.prototype.hasOwnProperty.call(values, token) ? String(values[token]) : match,
  )
}

// Every {token} a template uses, sorted and de-duplicated. The catalog parity
// test compares these across languages: a translation that drops {error} or
// renames {count} renders a sentence with a hole in it.
export function tokensIn(template) {
  if (typeof template !== 'string') return []

  const found = new Set()
  for (const match of template.matchAll(/\{(\w+)\}/g)) found.add(match[1])
  return [...found].sort()
}
