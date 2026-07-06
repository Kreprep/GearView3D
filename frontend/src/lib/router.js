export const routes = {
  login: '/login',
  dashboard: '/dashboard',
  catalog: '/catalog',
  forklift: '/training/forklift',
  equipment: '/training/forklift/equipment',
  walkAround: '/training/forklift/equipment/walk-around',
  loadHandling: '/training/forklift/equipment/load-handling',
  postOperation: '/training/forklift/equipment/post-operation',
  parts: '/training/forklift/parts',
  assessment: '/training/forklift/assessment',
  admin: '/admin',
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
