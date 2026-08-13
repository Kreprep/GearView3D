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

export async function getPracticeQuestions() {
  return request('/content/practice-questions')
}

// Quizzes are scored on the server: these send the chosen options and get back
// the score, the per-question results and the attempt the server recorded. The
// correct answers are not in the GET payloads, so the client cannot mark its
// own work.
export async function submitPracticeQuiz(answers) {
  return request('/content/practice-questions/submit', { method: 'POST', body: { answers } })
}

export async function submitModuleQuiz(moduleSlug, answers) {
  return request(`/content/quizzes/${encodeURIComponent(moduleSlug)}/submit`, {
    method: 'POST',
    body: { answers },
  })
}

export async function getChecklistCounts() {
  return request('/content/checklist-counts')
}

export async function getModuleQuiz(moduleSlug) {
  return request(`/content/quizzes/${encodeURIComponent(moduleSlug)}`)
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

// Parts, part details and practice questions save a draft; the published row a
// learner sees only changes on publish.
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

export async function adminCreatePracticeQuestion(payload) {
  return request('/admin/practice-questions', { method: 'POST', body: payload })
}

export async function adminUpdatePracticeQuestion(questionId, payload) {
  return request(`/admin/practice-questions/${encodeURIComponent(questionId)}`, { method: 'PATCH', body: payload })
}

export async function adminPublishPracticeQuestion(questionId) {
  return request(`/admin/practice-questions/${encodeURIComponent(questionId)}/publish`, { method: 'POST' })
}

export async function adminRevertPracticeQuestion(questionId) {
  return request(`/admin/practice-questions/${encodeURIComponent(questionId)}/revert`, { method: 'POST' })
}

export async function adminDeletePracticeQuestion(questionId) {
  return request(`/admin/practice-questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' })
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

export async function adminUpdateEquipment(equipmentId, payload) {
  return request(`/admin/equipment/${encodeURIComponent(equipmentId)}`, { method: 'PATCH', body: payload })
}

export async function adminUpdateModule(moduleId, payload) {
  return request(`/admin/modules/${encodeURIComponent(moduleId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeleteModule(moduleId) {
  return request(`/admin/modules/${encodeURIComponent(moduleId)}`, { method: 'DELETE' })
}

export async function adminUpdateChecklistItem(itemId, payload) {
  return request(`/admin/checklist-items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: payload })
}

export async function adminDeleteChecklistItem(itemId) {
  return request(`/admin/checklist-items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
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
