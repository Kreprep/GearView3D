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

export async function getTrainingModules() {
  return request('/content/modules')
}

export async function getParts() {
  return request('/content/parts')
}

export async function getPartDetails() {
  return request('/content/part-details')
}

export async function getChecklist(moduleSlug) {
  return request(`/content/checklists/${encodeURIComponent(moduleSlug)}`)
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

export async function adminUpdatePartDetail(detailId, payload) {
  return request(`/admin/part-details/${encodeURIComponent(detailId)}`, { method: 'PATCH', body: payload })
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
