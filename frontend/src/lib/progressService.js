import { moduleChecklists, partsHotspots } from './trainingData'

const STORAGE_KEY = 'gearview_progress_v1'
const CHANGE_EVENT = 'gearview-progress-change'

const equipmentModuleSlugs = ['walk-around-check', 'load-handling', 'post-operation']
const partsModuleSlug = 'parts-identification'

function emptyProgress() {
  return {
    version: 1,
    checklists: {},
    parts: {
      viewedPartIds: [],
      practiceAttempts: [],
    },
    quizzes: {},
    updatedAt: null,
  }
}

function normalizeProgress(progress) {
  return {
    ...emptyProgress(),
    ...progress,
    checklists: progress?.checklists || {},
    parts: {
      viewedPartIds: progress?.parts?.viewedPartIds || [],
      practiceAttempts: progress?.parts?.practiceAttempts || [],
    },
    quizzes: progress?.quizzes || {},
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

function persist(progress) {
  const next = {
    ...normalizeProgress(progress),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
  return next
}

export function getStoredProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeProgress(raw ? JSON.parse(raw) : emptyProgress())
  } catch {
    return emptyProgress()
  }
}

export function subscribeToProgress(listener) {
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)

  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export function resetStoredProgress() {
  localStorage.removeItem(STORAGE_KEY)
  notify()
}

export function setChecklistProgress(moduleSlug, completedItems) {
  const progress = getStoredProgress()
  const uniqueItems = [...new Set(completedItems)]

  return persist({
    ...progress,
    checklists: {
      ...progress.checklists,
      [moduleSlug]: {
        completedItems: uniqueItems,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export function markPartViewed(partId) {
  if (!partId) return getStoredProgress()

  const progress = getStoredProgress()
  const viewedPartIds = new Set(progress.parts.viewedPartIds)

  if (viewedPartIds.has(partId)) {
    return progress
  }

  viewedPartIds.add(partId)

  return persist({
    ...progress,
    parts: {
      ...progress.parts,
      viewedPartIds: [...viewedPartIds],
    },
  })
}

export function recordPartsPracticeAttempt({ score, total }) {
  const progress = getStoredProgress()
  const attempt = {
    id: crypto.randomUUID(),
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    attemptedAt: new Date().toISOString(),
  }

  return persist({
    ...progress,
    parts: {
      ...progress.parts,
      practiceAttempts: [attempt, ...progress.parts.practiceAttempts],
    },
  })
}

export function recordQuizAttempt(moduleSlug, { score, total }) {
  const progress = getStoredProgress()
  const attempt = {
    id: crypto.randomUUID(),
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    attemptedAt: new Date().toISOString(),
  }

  return persist({
    ...progress,
    quizzes: {
      ...progress.quizzes,
      [moduleSlug]: [attempt, ...(progress.quizzes[moduleSlug] || [])],
    },
  })
}

export function getChecklistCompletion(progress, moduleSlug) {
  const checklist = moduleChecklists[moduleSlug] || []
  const completedItems = progress.checklists[moduleSlug]?.completedItems || []

  return {
    completedItems,
    completedCount: completedItems.length,
    totalCount: checklist.length,
    percentage: checklist.length ? Math.round((completedItems.length / checklist.length) * 100) : 0,
  }
}

export function getModuleProgress(progress, moduleSlug) {
  const checklistCompletion = getChecklistCompletion(progress, moduleSlug)
  const latestQuiz = progress.quizzes[moduleSlug]?.[0]

  if (latestQuiz) {
    return Math.round((checklistCompletion.percentage + latestQuiz.percentage) / 2)
  }

  return checklistCompletion.percentage
}

export function getEquipmentProgress(progress) {
  return Math.round(
    equipmentModuleSlugs.reduce((sum, slug) => sum + getModuleProgress(progress, slug), 0) / equipmentModuleSlugs.length,
  )
}

export function getPartsProgress(progress) {
  const viewedCount = progress.parts.viewedPartIds.length
  const viewedPercentage = Math.round((viewedCount / partsHotspots.length) * 100)
  const latestPractice = progress.parts.practiceAttempts[0]

  if (latestPractice) {
    return Math.round((viewedPercentage + latestPractice.percentage) / 2)
  }

  return viewedPercentage
}

export function getOverallProgress(progress) {
  return Math.round((getEquipmentProgress(progress) + getPartsProgress(progress)) / 2)
}

export function getProgressSummary(progress = getStoredProgress()) {
  return {
    raw: progress,
    equipment: getEquipmentProgress(progress),
    parts: getPartsProgress(progress),
    overall: getOverallProgress(progress),
    modules: equipmentModuleSlugs.reduce((summary, slug) => {
      summary[slug] = getModuleProgress(progress, slug)
      return summary
    }, {}),
    checklist: equipmentModuleSlugs.reduce((summary, slug) => {
      summary[slug] = getChecklistCompletion(progress, slug)
      return summary
    }, {}),
    viewedParts: progress.parts.viewedPartIds,
    quizAttempts: progress.quizzes,
    partsPracticeAttempts: progress.parts.practiceAttempts,
  }
}

export { CHANGE_EVENT, equipmentModuleSlugs, partsModuleSlug }
