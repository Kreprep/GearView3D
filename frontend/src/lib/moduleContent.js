// Module-level content that is stored on a step row rather than a module row.
//
// `objectives` and the syllabus card describe the whole module but live on its
// briefing step's `content`; the post-Submit destination lives on its summary
// step's `content`. Both fall back to the static defaults in
// `data/trainingModules.js` / the caller, so rows seeded before those fields
// existed keep behaving exactly as they did.
import { moduleRoute, routes } from './router'

export function briefingContent(steps = []) {
  return steps.find((step) => step.kind === 'briefing')?.content || null
}

export function summaryContent(steps = []) {
  return steps.find((step) => step.kind === 'summary')?.content || null
}

// Blank lines are kept in the stored array so the admin can press Enter while
// typing; they are dropped here rather than on every keystroke.
export function moduleObjectives(steps, module) {
  const objectives = (briefingContent(steps)?.objectives || [])
    .map((entry) => entry.trim())
    .filter(Boolean)

  return objectives.length ? objectives : module?.learningObjectives || []
}

// `nextRoute` is a key, not a path, so a route that moves does not strand
// saved content. Two kinds resolve:
//
//   'hub' | 'modules' | 'parts' | 'assessment'  - a training page
//   'module:<slug>'                             - one module
//
// Stored keys were rewritten to this scheme by migration 20260814101000, so
// anything else is unknown and resolves to null.
const TARGETS = {
  hub: routes.home,
  modules: routes.modules,
  parts: routes.parts,
  assessment: routes.assessment,
}

export const MODULE_ROUTE_PREFIX = 'module:'

export function resolveNextRoute(key) {
  if (!key) return null

  if (key.startsWith(MODULE_ROUTE_PREFIX)) {
    const slug = key.slice(MODULE_ROUTE_PREFIX.length)
    return slug ? moduleRoute(slug) : null
  }

  return TARGETS[key] || null
}

// An unknown key - a route that was renamed, or a row seeded before this field
// existed - falls back to the module's built-in destination.
export function nextModuleRoute(steps, fallbackKey) {
  return resolveNextRoute(summaryContent(steps)?.nextRoute) || resolveNextRoute(fallbackKey)
}
