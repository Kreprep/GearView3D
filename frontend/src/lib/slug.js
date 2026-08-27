// Turns freeform text into a URL/id-safe slug: lowercase, every run of
// non-alphanumeric characters collapsed to one hyphen, no leading/trailing
// hyphen. Pure, no browser APIs - backend/src/lib/slug.js imports this to
// build ids for admin-created rows, the same way courseGoals.js is shared.
export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
