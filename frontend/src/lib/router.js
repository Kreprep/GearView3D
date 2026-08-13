// Forklift's training pages now route through the same generic
// /training/:equipmentId/... scheme as every other equipment (parsed in
// App.jsx), so most keys here are aliases into that scheme. The module keys
// (walkAround, loadHandling, postOperation, palletTesting) and `equipment`
// are kept because Course summary rows store their post-Submit destination as
// one of these keys (see NEXT_ROUTE_OPTIONS in data/courseDefaults.js) -
// deleting a key would strand saved content. `equipment` is the module list
// (formerly the standalone Equipment Usage page), `forklift` the hub above it.
export const routes = {
  login: '/login',
  catalog: '/catalog',
  forklift: '/training/forklift',
  equipment: '/training/forklift/modules',
  walkAround: '/training/forklift/modules/walk-around-check',
  loadHandling: '/training/forklift/modules/load-handling',
  postOperation: '/training/forklift/modules/post-operation',
  palletTesting: '/training/forklift/modules/pallet-testing',
  parts: '/training/forklift/parts',
  assessment: '/training/forklift/assessment',
  admin: '/admin',
  // Training Content: one equipment picker over three sections. Steps,
  // checklist items and quiz questions have no paths of their own - they are
  // edited inside a module at /admin/modules/:slug.
  adminModules: '/admin/modules',
  adminParts: '/admin/parts',
  adminSettings: '/admin/settings',
  adminUsers: '/admin/users',
  adminReports: '/admin/reports',
}

export function adminModuleRoute(moduleSlug) {
  return `${routes.adminModules}/${moduleSlug}`
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
