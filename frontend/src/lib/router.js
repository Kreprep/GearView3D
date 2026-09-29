// The training pages live under /training (parsed in App.jsx): the hub at
// /training, then /training/modules[/<slug>], /training/parts and
// /training/assessment. Module pages have no key of their own - build them
// with moduleRoute().
export const routes = {
  login: '/login',
  home: '/training',
  modules: '/training/modules',
  parts: '/training/parts',
  assessment: '/training/assessment',
  admin: '/admin',
  // Training Content: three sections. Steps, checklist items and quiz
  // questions have no paths of their own - they are edited inside a module at
  // /admin/modules/:slug.
  adminModules: '/admin/modules',
  adminParts: '/admin/parts',
  adminSettings: '/admin/settings',
  adminUsers: '/admin/users',
  adminReports: '/admin/reports',
}

export function moduleRoute(moduleSlug) {
  return `${routes.modules}/${moduleSlug}`
}

export function adminModuleRoute(moduleSlug) {
  return `${routes.adminModules}/${moduleSlug}`
}

// The pre-2026-09 training URLs, when the app covered more than one
// equipment: the /catalog equipment grid, the forklift's pages under
// /training/forklift, and before those the /training/forklift/equipment module
// list. Bookmarks and history entries still point at them, so each maps to
// its current page. Returns null for a path that is not a legacy URL.
const LEGACY_TRAINING_PREFIX = '/training/forklift'
const LEGACY_MODULE_LIST_PREFIX = `${LEGACY_TRAINING_PREFIX}/equipment`
// The walk-around module's slug was `walk-around` under the old module list.
const LEGACY_MODULE_SLUGS = { 'walk-around': 'walk-around-check' }

function isUnder(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`)
}

export function legacyRedirect(path) {
  if (path === '/catalog') return routes.home

  if (isUnder(path, LEGACY_MODULE_LIST_PREFIX)) {
    const slug = path.slice(LEGACY_MODULE_LIST_PREFIX.length + 1).split('/')[0]
    return slug ? moduleRoute(LEGACY_MODULE_SLUGS[slug] || slug) : routes.modules
  }

  if (isUnder(path, LEGACY_TRAINING_PREFIX)) {
    return `${routes.home}${path.slice(LEGACY_TRAINING_PREFIX.length)}`
  }

  return null
}

export function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

export function goTo(path, { replace = false } = {}) {
  if (window.location.pathname === path) return

  if (replace) {
    window.history.replaceState({}, '', path)
  } else {
    window.history.pushState({}, '', path)
  }

  window.dispatchEvent(new PopStateEvent('popstate'))
}
