// HTTP client for the GearView3D backend (backend/, Express + Prisma +
// PostgreSQL). Every page component calls these functions instead of fetching
// directly, so this file stays the single seam between frontend and backend.
//
// In development the Vite dev server proxies /api to the backend (see
// vite.config.js), so no base URL configuration is needed. Set VITE_API_URL
// only when the API is hosted somewhere else entirely.

const API_BASE = import.meta.env.VITE_API_URL || '/api'

let authToken = localStorage.getItem('gearview_token')

export function setAuthToken(token) {
  authToken = token || null
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
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
    throw new Error(data?.error || `Request failed (${response.status})`)
  }

  return data
}

// --- Auth ---

export async function loginUser(credentials) {
  return request('/auth/login', { method: 'POST', body: credentials })
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

export async function getParts() {
  return request('/content/parts')
}

export async function getPartDetails() {
  return request('/content/part-details')
}

export async function getPartCategories() {
  return request('/content/part-categories')
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

// Module 1's published 3D inspection hotspots, in sortOrder.
export async function getWalkAroundHotspots() {
  return request('/content/walkaround-hotspots')
}

// The generic Hotspot Identification page's published hotspots for one
// equipment (any equipment other than Forklift).
export async function getEquipmentHotspots(equipmentId) {
  return request(`/content/equipment-hotspots?equipment=${encodeURIComponent(equipmentId)}`)
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

export async function adminUpdatePart(partId, payload) {
  return request(`/admin/parts/${encodeURIComponent(partId)}`, { method: 'PATCH', body: payload })
}

export async function adminCreatePart(payload) {
  return request('/admin/parts', { method: 'POST', body: payload })
}

export async function adminDeletePart(partId) {
  return request(`/admin/parts/${encodeURIComponent(partId)}`, { method: 'DELETE' })
}

// Parts and part details save a draft; the published row a learner sees only
// changes on publish.
export async function adminPublishPart(partId) {
  return request(`/admin/parts/${encodeURIComponent(partId)}/publish`, { method: 'POST' })
}

export async function adminRevertPart(partId) {
  return request(`/admin/parts/${encodeURIComponent(partId)}/revert`, { method: 'POST' })
}

export async function adminUpdatePartDetail(detailId, payload) {
  return request(`/admin/part-details/${encodeURIComponent(detailId)}`, { method: 'PATCH', body: payload })
}

export async function adminPublishPartDetail(detailId) {
  return request(`/admin/part-details/${encodeURIComponent(detailId)}/publish`, { method: 'POST' })
}

export async function adminRevertPartDetail(detailId) {
  return request(`/admin/part-details/${encodeURIComponent(detailId)}/revert`, { method: 'POST' })
}

export async function adminCreatePartCategory(payload) {
  return request('/admin/part-categories', { method: 'POST', body: payload })
}

export async function adminUpdatePartCategory(categoryId, payload) {
  return request(`/admin/part-categories/${encodeURIComponent(categoryId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeletePartCategory(categoryId) {
  return request(`/admin/part-categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' })
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

export async function adminListCourses() {
  return request('/admin/courses')
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

// --- Admin: walk-around hotspot editor ---

export async function adminListWalkAroundHotspots() {
  return request('/admin/walkaround-hotspots')
}

export async function adminCreateWalkAroundHotspot(payload) {
  return request('/admin/walkaround-hotspots', { method: 'POST', body: payload })
}

// Saves an edit as an unpublished draft; learners keep seeing the published
// version until adminPublishWalkAroundHotspot().
export async function adminSaveWalkAroundHotspotDraft(hotspotId, payload) {
  return request(`/admin/walkaround-hotspots/${encodeURIComponent(hotspotId)}`, { method: 'PUT', body: payload })
}

export async function adminPublishWalkAroundHotspot(hotspotId) {
  return request(`/admin/walkaround-hotspots/${encodeURIComponent(hotspotId)}/publish`, { method: 'POST' })
}

export async function adminRevertWalkAroundHotspot(hotspotId) {
  return request(`/admin/walkaround-hotspots/${encodeURIComponent(hotspotId)}/revert`, { method: 'POST' })
}

export async function adminResetWalkAroundHotspot(hotspotId) {
  return request(`/admin/walkaround-hotspots/${encodeURIComponent(hotspotId)}/reset`, { method: 'POST' })
}

export async function adminReorderWalkAroundHotspots(ids) {
  return request('/admin/walkaround-hotspots/reorder', { method: 'POST', body: { ids } })
}

export async function adminDeleteWalkAroundHotspot(hotspotId) {
  return request(`/admin/walkaround-hotspots/${encodeURIComponent(hotspotId)}`, { method: 'DELETE' })
}

// --- Admin: equipment hotspot editor (any equipment other than Forklift) ---

export async function adminListEquipmentHotspots(equipmentId) {
  return request(`/admin/equipment-hotspots?equipment=${encodeURIComponent(equipmentId)}`)
}

export async function adminCreateEquipmentHotspot(payload) {
  return request('/admin/equipment-hotspots', { method: 'POST', body: payload })
}

// Saves an edit as an unpublished draft; learners keep seeing the published
// version until adminPublishEquipmentHotspot().
export async function adminSaveEquipmentHotspotDraft(hotspotId, payload) {
  return request(`/admin/equipment-hotspots/${encodeURIComponent(hotspotId)}`, { method: 'PUT', body: payload })
}

export async function adminPublishEquipmentHotspot(hotspotId) {
  return request(`/admin/equipment-hotspots/${encodeURIComponent(hotspotId)}/publish`, { method: 'POST' })
}

export async function adminRevertEquipmentHotspot(hotspotId) {
  return request(`/admin/equipment-hotspots/${encodeURIComponent(hotspotId)}/revert`, { method: 'POST' })
}

export async function adminReorderEquipmentHotspots(equipmentId, ids) {
  return request('/admin/equipment-hotspots/reorder', { method: 'POST', body: { equipmentId, ids } })
}

export async function adminDeleteEquipmentHotspot(hotspotId) {
  return request(`/admin/equipment-hotspots/${encodeURIComponent(hotspotId)}`, { method: 'DELETE' })
}
