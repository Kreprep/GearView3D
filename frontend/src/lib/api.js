import { forkliftEquipment, moduleChecklists, partsHotspots, trainingModules } from './trainingData'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

let authToken = localStorage.getItem('gearview_token')

export function setAuthToken(token) {
  authToken = token
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.message || 'Request failed')
  }

  return body
}

export async function loginUser(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export async function getCurrentUser() {
  const data = await request('/auth/me')
  return data.user
}

export async function getEquipment() {
  try {
    const data = await request('/equipment')
    return data.equipment
  } catch {
    return [forkliftEquipment]
  }
}

export async function getTrainingModules() {
  try {
    const data = await request('/equipment/forklift/modules')
    return data.modules
  } catch {
    return trainingModules
  }
}

export async function getParts() {
  try {
    const data = await request('/equipment/forklift/parts')
    return data.parts
  } catch {
    return partsHotspots
  }
}

export async function getChecklist(moduleSlug) {
  try {
    const data = await request(`/modules/${moduleSlug}/checklist`)
    return data.checklist
  } catch {
    return moduleChecklists[moduleSlug] || []
  }
}

export async function saveProgress(payload) {
  try {
    return await request('/progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return { saved: false }
  }
}

export async function getProgress() {
  try {
    const data = await request('/progress')
    return data.progress
  } catch {
    return []
  }
}

export async function adminListContent() {
  try {
    return await request('/admin/content')
  } catch {
    return {
      equipment: [forkliftEquipment],
      modules: trainingModules,
      parts: partsHotspots,
      backendOnline: false,
    }
  }
}

export async function adminUpdatePart(partId, payload) {
  return request(`/admin/parts/${partId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function adminCreatePart(payload) {
  return request('/admin/parts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function adminDeletePart(partId) {
  return request(`/admin/parts/${partId}`, { method: 'DELETE' })
}

export async function adminUpdateModule(moduleId, payload) {
  return request(`/admin/modules/${moduleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function adminDeleteModule(moduleId) {
  return request(`/admin/modules/${moduleId}`, { method: 'DELETE' })
}

export async function adminUpdateChecklistItem(itemId, payload) {
  return request(`/admin/checklists/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function adminDeleteChecklistItem(itemId) {
  return request(`/admin/checklists/${itemId}`, { method: 'DELETE' })
}

export async function adminUpdateQuizQuestion(questionId, payload) {
  return request(`/admin/quizzes/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function adminDeleteQuizQuestion(questionId) {
  return request(`/admin/quizzes/${questionId}`, { method: 'DELETE' })
}
