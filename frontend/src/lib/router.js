export const routes = {
  login: '/login',
  catalog: '/catalog',
  forklift: '/training/forklift',
  equipment: '/training/forklift/equipment',
  walkAround: '/training/forklift/equipment/walk-around',
  loadHandling: '/training/forklift/equipment/load-handling',
  postOperation: '/training/forklift/equipment/post-operation',
  palletTesting: '/training/forklift/equipment/pallet-testing',
  parts: '/training/forklift/parts',
  assessment: '/training/forklift/assessment',
  admin: '/admin',
  adminModules: '/admin/modules',
  adminParts: '/admin/parts',
  adminChecklists: '/admin/checklists',
  adminQuizzes: '/admin/quizzes',
  adminUsers: '/admin/users',
  adminReports: '/admin/reports',
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
