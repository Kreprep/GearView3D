// HTTP client for the GearView3D backend (backend/, Express + Prisma +
// PostgreSQL). Every page component calls these functions instead of fetching
// directly, so this file stays the single seam between frontend and backend.
//
// In development the Vite dev server proxies /api to the backend (see
// vite.config.js), so no base URL configuration is needed. Set VITE_API_URL
// only when the API is hosted somewhere else entirely.

// Optional chaining so this file can be imported under plain Node (the test
// runner has no Vite, so `import.meta.env` itself is undefined there) without
// changing behavior under Vite, which always defines it.
const API_BASE = import.meta.env?.VITE_API_URL || '/api'

let authToken = localStorage.getItem('gearview_token')

export function setAuthToken(token) {
  authToken = token || null
}

// Fired when the server refuses the token this client is signed in with - it
// expired, JWT_SECRET changed, or the account was deleted. App.jsx signs the
// learner out on it. Without it nothing noticed: a cached user skips the
// session check on load, so the app stayed on its signed-in pages with every
// request failing "Invalid or expired token".
const SESSION_EXPIRED_EVENT = 'gearview-session-expired'

export function subscribeToSessionExpiry(listener) {
  window.addEventListener(SESSION_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
}

async function request(path, { method = 'GET', body } = {}) {
  // Kept so the 401 check below judges the token this request carried, not
  // whatever the client holds by the time the response lands.
  const sentToken = authToken
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (sentToken) {
    headers.Authorization = `Bearer ${sentToken}`
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the GearView3D API. Is the backend running? (cd backend && npm run dev)')
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON response body; fall through to the status check.
  }

  if (!response.ok) {
    // Only a refusal of the token still in use ends the session: the login
    // form's 401 carries no token, and one landing after the learner has signed
    // back in is about the token they replaced. Dropping it here also means the
    // other requests in flight report it once, not once each.
    if (response.status === 401 && sentToken && sentToken === authToken) {
      authToken = null
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }
    throw new Error(data?.error || `Request failed (${response.status})`)
  }

  return data
}

// --- Auth ---

export async function loginUser(credentials) {
  return request('/auth/login', { method: 'POST', body: credentials })
}

export async function signupUser(credentials) {
  return request('/auth/signup', { method: 'POST', body: credentials })
}

export async function getCurrentUser() {
  return request('/auth/me')
}

// --- Content ---

export async function getEquipment() {
  return request('/content/equipment')
}

// `equipmentId` scopes the result to one equipment's modules (used by an
// equipment hub page listing only its own modules); omitted returns every
// module - fine for callers that just look up one known module by its
// globally-unique slug.
export async function getTrainingModules(equipmentId) {
  return request(equipmentId ? `/content/modules?equipment=${encodeURIComponent(equipmentId)}` : '/content/modules')
}

// One equipment's published markers, in sortOrder. `surface` narrows them to
// the page asking - 'parts' for Parts Identification, 'walk-around' for an
// inspection step - since one row can appear on both.
export async function getHotspots(equipmentId, surface) {
  const query = new URLSearchParams({ equipment: equipmentId })
  if (surface) query.set('surface', surface)
  return request(`/content/hotspots?${query}`)
}

// The detail cards, keyed by hotspot id. Separate from getHotspots because it
// also carries cards for ids with no marker of their own.
export async function getHotspotDetails(equipmentId) {
  return request(`/content/hotspot-details?equipment=${encodeURIComponent(equipmentId)}`)
}

export async function getHotspotCategories(equipmentId) {
  return request(`/content/hotspot-categories?equipment=${encodeURIComponent(equipmentId)}`)
}

// Every quiz - a module's quiz step and an equipment's parts quiz - comes from
// the same endpoint, scoped by one of:
//   { module: 'load-handling' }
//   { equipment: 'forklift', context: 'parts' }
function quizQuery(scope) {
  return new URLSearchParams(
    scope.context === 'parts'
      ? { equipment: scope.equipment, context: 'parts' }
      : { module: scope.module },
  ).toString()
}

export async function getQuizQuestions(scope) {
  return request(`/content/quizzes?${quizQuery(scope)}`)
}

// Quizzes are scored on the server: this sends the chosen options and gets back
// the score, the per-question results and the attempt the server recorded. The
// correct answers are not in the GET payload, so the client cannot mark its
// own work.
export async function submitQuiz(scope, answers) {
  return request('/content/quizzes/submit', { method: 'POST', body: { ...scope, answers } })
}

export async function getChecklistCounts() {
  return request('/content/checklist-counts')
}

export async function getChecklist(moduleSlug) {
  return request(`/content/checklists/${encodeURIComponent(moduleSlug)}`)
}

// Published driving-simulation steps for one module, in step order. Each entry
// is { id, title, objective, instructions, hint, goalType, course } where
// `course` is what DrivingSimulationViewer consumes.
export async function getModuleCourses(moduleSlug) {
  return request(`/content/courses/${encodeURIComponent(moduleSlug)}`)
}

// --- Progress (per signed-in user) ---

export async function getProgress() {
  return request('/progress')
}

export async function saveProgress(progress) {
  return request('/progress', { method: 'PUT', body: progress })
}

// --- Admin ---

export async function adminListContent() {
  return request('/admin/content')
}

export async function adminCreateHotspotCategory(payload) {
  return request('/admin/hotspot-categories', { method: 'POST', body: payload })
}

export async function adminUpdateHotspotCategory(categoryId, payload) {
  return request(`/admin/hotspot-categories/${encodeURIComponent(categoryId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeleteHotspotCategory(categoryId) {
  return request(`/admin/hotspot-categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' })
}

export async function adminCreateEquipment(payload) {
  return request('/admin/equipment', { method: 'POST', body: payload })
}

export async function adminDeleteEquipment(equipmentId) {
  return request(`/admin/equipment/${encodeURIComponent(equipmentId)}`, { method: 'DELETE' })
}

export async function adminUpdateEquipment(equipmentId, payload) {
  return request(`/admin/equipment/${encodeURIComponent(equipmentId)}`, { method: 'PATCH', body: payload })
}

export async function adminCreateModule(payload) {
  return request('/admin/modules', { method: 'POST', body: payload })
}

export async function adminReorderModules(equipmentId, ids) {
  return request('/admin/modules/reorder', { method: 'POST', body: { equipmentId, ids } })
}

export async function adminUpdateModule(moduleId, payload) {
  return request(`/admin/modules/${encodeURIComponent(moduleId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeleteModule(moduleId) {
  return request(`/admin/modules/${encodeURIComponent(moduleId)}`, { method: 'DELETE' })
}

export async function adminCreateChecklistItem(payload) {
  return request('/admin/checklist-items', { method: 'POST', body: payload })
}

export async function adminUpdateChecklistItem(itemId, payload) {
  return request(`/admin/checklist-items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeleteChecklistItem(itemId) {
  return request(`/admin/checklist-items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
}

// Quiz questions, module and parts alike - one table, saved immediately (no
// draft). A parts question needs { equipmentId, context: 'parts' }; a module
// question needs { moduleId }.
export async function adminCreateQuizQuestion(payload) {
  return request('/admin/quiz-questions', { method: 'POST', body: payload })
}

export async function adminUpdateQuizQuestion(questionId, payload) {
  return request(`/admin/quiz-questions/${encodeURIComponent(questionId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeleteQuizQuestion(questionId) {
  return request(`/admin/quiz-questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' })
}

// --- Admin: users ---

export async function adminCreateUser(payload) {
  return request('/admin/users', { method: 'POST', body: payload })
}

export async function adminUpdateUser(userId, payload) {
  return request(`/admin/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeleteUser(userId) {
  return request(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

// --- Admin: driving course editor ---
// Courses carry large geometry blobs, so they are fetched separately from
// adminListContent() rather than bundled into it.

export async function adminListCourses(moduleSlug) {
  const query = moduleSlug ? `?module=${encodeURIComponent(moduleSlug)}` : ''
  return request(`/admin/courses${query}`)
}

export async function adminCreateCourse(payload) {
  return request('/admin/courses', { method: 'POST', body: payload })
}

// Saves an edit as an unpublished draft; learners keep seeing the published
// version until adminPublishCourse().
export async function adminSaveCourseDraft(courseId, payload) {
  return request(`/admin/courses/${encodeURIComponent(courseId)}`, { method: 'PUT', body: payload })
}

export async function adminPublishCourse(courseId) {
  return request(`/admin/courses/${encodeURIComponent(courseId)}/publish`, { method: 'POST' })
}

export async function adminRevertCourse(courseId) {
  return request(`/admin/courses/${encodeURIComponent(courseId)}/revert`, { method: 'POST' })
}

export async function adminResetCourse(courseId) {
  return request(`/admin/courses/${encodeURIComponent(courseId)}/reset`, { method: 'POST' })
}

export async function adminReorderCourses(moduleSlug, ids) {
  return request('/admin/courses/reorder', { method: 'POST', body: { moduleSlug, ids } })
}

export async function adminDeleteCourse(courseId) {
  return request(`/admin/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' })
}

// --- Admin: hotspot editor ---
// One set of calls for every marker on every equipment, whichever surface it
// appears on. Edits save as a draft; learners keep seeing the published
// position and text until adminPublishHotspot().

export async function adminListHotspots(equipmentId) {
  return request(`/admin/hotspots?equipment=${encodeURIComponent(equipmentId)}`)
}

export async function adminCreateHotspot(payload) {
  return request('/admin/hotspots', { method: 'POST', body: payload })
}

export async function adminSaveHotspotDraft(hotspotId, payload) {
  return request(`/admin/hotspots/${encodeURIComponent(hotspotId)}`, { method: 'PUT', body: payload })
}

export async function adminPublishHotspot(hotspotId) {
  return request(`/admin/hotspots/${encodeURIComponent(hotspotId)}/publish`, { method: 'POST' })
}

export async function adminRevertHotspot(hotspotId) {
  return request(`/admin/hotspots/${encodeURIComponent(hotspotId)}/revert`, { method: 'POST' })
}

export async function adminResetHotspot(hotspotId) {
  return request(`/admin/hotspots/${encodeURIComponent(hotspotId)}/reset`, { method: 'POST' })
}

export async function adminReorderHotspots(equipmentId, ids) {
  return request('/admin/hotspots/reorder', { method: 'POST', body: { equipmentId, ids } })
}

export async function adminDeleteHotspot(hotspotId) {
  return request(`/admin/hotspots/${encodeURIComponent(hotspotId)}`, { method: 'DELETE' })
}
