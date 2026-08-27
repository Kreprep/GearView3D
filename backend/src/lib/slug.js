// slugify() is shared with the frontend admin UI (WalkAroundContentFields.jsx
// derives client-side ids the same way), the same reasoning as importing
// courseGoals.js: one place owns the rule instead of copies drifting apart.
import { slugify } from '../../../frontend/src/lib/slug.js'

export { slugify }

// Appends -2, -3, ... to `base` until `exists(candidate)` resolves false.
// `exists` is typically a Prisma findUnique lookup on the field being
// deduped - checks `base` itself first, so the common case (no collision)
// needs no suffix at all.
export async function uniqueSlug(base, exists) {
  let candidate = base
  let suffix = 2
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}
