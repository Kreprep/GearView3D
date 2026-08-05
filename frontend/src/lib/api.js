import {
  buildDefaultPartDetails,
  forkliftEquipment,
  moduleChecklists,
  moduleQuizQuestions,
  partsHotspots,
  trainingModules,
} from './trainingData'
import { getProgressSummary, getStoredProgress } from './progressService'

const CONTENT_STORAGE_KEY = 'gearview_local_content_v1'

const demoUsers = [
  {
    id: 'admin-demo',
    email: 'admin@mail.com',
    password: 'admin123',
    fullName: 'GearView3D Admin',
    role: 'ADMIN',
  },
  {
    id: 'trainee-demo',
    email: 'trainee@mail.com',
    password: 'trainee123',
    fullName: 'Sample Trainee',
    role: 'TRAINEE',
  },
]

// Mock authentication is for frontend prototype/demo only. Backend authentication will be implemented separately.
function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function checklistRecords() {
  return Object.entries(moduleChecklists).flatMap(([moduleSlug, items]) => {
    const module = trainingModules.find((item) => item.slug === moduleSlug)

    return items.map((text, index) => ({
      id: `${moduleSlug}-check-${index + 1}`,
      moduleId: module?.id,
      text,
      sortOrder: index + 1,
      module,
    }))
  })
}

function quizRecords() {
  return Object.entries(moduleQuizQuestions).flatMap(([moduleSlug, questions]) => {
    const module = trainingModules.find((item) => item.slug === moduleSlug)

    return questions.map((question, index) => ({
      id: question.id,
      moduleId: module?.id,
      prompt: question.prompt,
      answer: question.answer,
      sortOrder: index + 1,
      module,
      options: question.options.map((text, optionIndex) => ({
        id: `${question.id}-option-${optionIndex + 1}`,
        text,
        sortOrder: optionIndex + 1,
      })),
    }))
  })
}

function defaultContent() {
  return {
    localOnly: true,
    equipment: [forkliftEquipment],
    modules: trainingModules,
    parts: partsHotspots,
    partDetails: buildDefaultPartDetails(),
    checklists: checklistRecords(),
    quizQuestions: quizRecords(),
    users: demoUsers.map(publicUser),
    progress: [],
    activityLogs: [],
  }
}

// Part details are merged per entry (seed defaults + saved admin overrides), so
// newly seeded parts still show up after an admin has edited other entries.
function mergePartDetails(defaults, saved) {
  const merged = { ...defaults }
  for (const [id, detail] of Object.entries(saved || {})) {
    merged[id] = { ...merged[id], ...detail, id }
  }
  return merged
}

function getLocalContent() {
  const fallback = defaultContent()

  try {
    const saved = localStorage.getItem(CONTENT_STORAGE_KEY)
    const savedContent = saved ? JSON.parse(saved) : {}
    return {
      ...fallback,
      ...savedContent,
      partDetails: mergePartDetails(fallback.partDetails, savedContent.partDetails),
      localOnly: true,
    }
  } catch {
    return fallback
  }
}

function saveLocalContent(content) {
  const next = {
    ...getLocalContent(),
    ...content,
    localOnly: true,
  }
  localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(next))
  return next
}

function getContentWithProgress() {
  const content = getLocalContent()
  const progress = getStoredProgress()
  const summary = getProgressSummary(progress)
  const user = getSavedUser()

  return {
    ...content,
    progress: Object.entries(summary.modules).map(([moduleSlug, value]) => ({
      id: `local-${moduleSlug}`,
      moduleSlug,
      progress: value,
      updatedAt: progress.updatedAt,
      user: {
        email: user?.email || 'local-user',
        fullName: user?.fullName || 'Local Learner',
      },
    })),
    activityLogs: [
      ...Object.entries(summary.quizAttempts).flatMap(([moduleSlug, attempts]) =>
        attempts.map((attempt) => ({
          id: attempt.id,
          action: 'quiz_attempt',
          detail: moduleSlug,
          createdAt: attempt.attemptedAt,
          user: { email: user?.email, fullName: user?.fullName },
        })),
      ),
      ...summary.partsPracticeAttempts.map((attempt) => ({
        id: attempt.id,
        action: 'parts_practice_attempt',
        detail: `${attempt.score}/${attempt.total}`,
        createdAt: attempt.attemptedAt,
        user: { email: user?.email, fullName: user?.fullName },
      })),
    ],
  }
}

function getSavedUser() {
  try {
    const saved = localStorage.getItem('gearview_user')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function publicUser(user) {
  const safeUser = { ...user }
  delete safeUser.password
  return safeUser
}

export function setAuthToken() {
  // Frontend-only prototype: no backend token is required.
}

export async function loginUser(credentials) {
  const user = demoUsers.find(
    (item) => item.email.toLowerCase() === credentials.email.toLowerCase() && item.password === credentials.password,
  )

  if (!user) {
    throw new Error('Invalid demo account credentials')
  }

  return {
    token: `local-demo-token-${user.id}`,
    user: publicUser(user),
  }
}

export async function getCurrentUser() {
  const user = getSavedUser()

  if (!user) {
    throw new Error('No local demo session found')
  }

  return user
}

export async function getEquipment() {
  return clone(getLocalContent().equipment)
}

export async function getTrainingModules() {
  return clone(getLocalContent().modules)
}

export async function getParts() {
  return clone(getLocalContent().parts)
}

export async function getPartDetails() {
  return clone(getLocalContent().partDetails)
}

export async function getChecklist(moduleSlug) {
  const content = getLocalContent()
  const module = content.modules.find((item) => item.slug === moduleSlug)

  return content.checklists
    .filter((item) => item.moduleId === module?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.text)
}

export async function saveProgress() {
  return { saved: true, localOnly: true }
}

export async function getProgress() {
  return getContentWithProgress().progress
}

export async function adminListContent() {
  return clone(getContentWithProgress())
}

export async function adminUpdatePart(partId, payload) {
  const content = getLocalContent()
  const part = {
    ...content.parts.find((item) => item.id === partId),
    ...payload,
  }
  const next = saveLocalContent({
    parts: content.parts.map((item) => (item.id === partId ? part : item)),
  })

  return { part: clone(next.parts.find((item) => item.id === partId)) }
}

export async function adminCreatePart(payload) {
  const content = getLocalContent()
  const part = {
    id: payload.id || payload.label.toLowerCase().replaceAll(' ', '-'),
    label: payload.label,
    category: payload.category || 'General',
    position: payload.position || [0, 0, 0],
    functionText: payload.functionText || '',
    inspectionReminder: payload.inspectionReminder || '',
    safetyNote: payload.safetyNote || '',
    relatedModule: payload.relatedModule || '',
    checklist: payload.checklist || [],
  }
  saveLocalContent({ parts: [...content.parts, part] })

  return { part: clone(part) }
}

export async function adminUpdatePartDetail(detailId, payload) {
  const content = getLocalContent()
  const detail = {
    ...content.partDetails[detailId],
    ...payload,
    id: detailId,
  }
  const next = saveLocalContent({
    partDetails: { ...content.partDetails, [detailId]: detail },
  })

  return { detail: clone(next.partDetails[detailId]) }
}

export async function adminDeletePart(partId) {
  const content = getLocalContent()
  saveLocalContent({ parts: content.parts.filter((part) => part.id !== partId) })
  return { deleted: true }
}

export async function adminUpdateModule(moduleId, payload) {
  const content = getLocalContent()
  const module = {
    ...content.modules.find((item) => item.id === moduleId),
    ...payload,
  }
  const next = saveLocalContent({
    modules: content.modules.map((item) => (item.id === moduleId ? module : item)),
  })

  return { module: clone(next.modules.find((item) => item.id === moduleId)) }
}

export async function adminDeleteModule(moduleId) {
  const content = getLocalContent()
  saveLocalContent({
    modules: content.modules.filter((module) => module.id !== moduleId),
    checklists: content.checklists.filter((item) => item.moduleId !== moduleId),
    quizQuestions: content.quizQuestions.filter((question) => question.moduleId !== moduleId),
  })
  return { deleted: true }
}

export async function adminUpdateChecklistItem(itemId, payload) {
  const content = getLocalContent()
  const item = {
    ...content.checklists.find((entry) => entry.id === itemId),
    ...payload,
  }
  const next = saveLocalContent({
    checklists: content.checklists.map((entry) => (entry.id === itemId ? item : entry)),
  })

  return { item: clone(next.checklists.find((entry) => entry.id === itemId)) }
}

export async function adminDeleteChecklistItem(itemId) {
  const content = getLocalContent()
  saveLocalContent({ checklists: content.checklists.filter((item) => item.id !== itemId) })
  return { deleted: true }
}

export async function adminUpdateQuizQuestion(questionId, payload) {
  const content = getLocalContent()
  const question = {
    ...content.quizQuestions.find((entry) => entry.id === questionId),
    ...payload,
    options: payload.options.map((text, index) => ({
      id: `${questionId}-option-${index + 1}`,
      text,
      sortOrder: index + 1,
    })),
  }
  const next = saveLocalContent({
    quizQuestions: content.quizQuestions.map((entry) => (entry.id === questionId ? question : entry)),
  })

  return { question: clone(next.quizQuestions.find((entry) => entry.id === questionId)) }
}

export async function adminDeleteQuizQuestion(questionId) {
  const content = getLocalContent()
  saveLocalContent({ quizQuestions: content.quizQuestions.filter((question) => question.id !== questionId) })
  return { deleted: true }
}
