import { moduleChecklists, partsHotspots } from './trainingData'
import {
  getChecklistCounts as fetchChecklistCounts,
  getParts as fetchParts,
  getProgress as fetchServerProgress,
  saveProgress as pushServerProgress,
} from './api'

const STORAGE_KEY = 'gearview_progress_v1'
const PARTS_COUNT_KEY = 'gearview_parts_count_v1'
const CHECKLIST_COUNTS_KEY = 'gearview_checklist_counts_v1'
const CHANGE_EVENT = 'gearview-progress-change'
const SERVER_PUSH_DELAY_MS = 800

// localStorage stays the synchronous source the UI reads from; the server copy
// (per signed-in user) is hydrated on login and pushed on every change,
// debounced so rapid simulation updates collapse into one request.
let serverPushTimer = null

function cancelServerPush() {
  clearTimeout(serverPushTimer)
  serverPushTimer = null
}

function scheduleServerPush(progress) {
  cancelServerPush()
  serverPushTimer = setTimeout(() => {
    serverPushTimer = null
    pushServerProgress(progress).catch(() => {
      // Offline or logged out; local copy is still saved.
    })
  }, SERVER_PUSH_DELAY_MS)
}

// Called after login/session restore: replaces the local copy with the
// signed-in user's server copy (if any) so progress follows the account,
// not the browser.
export async function hydrateProgressFromServer() {
  const serverProgress = await fetchServerProgress()
  cancelServerPush()

  if (serverProgress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(serverProgress)))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  notify()
}

// How many parts "all parts viewed" means. The parts themselves live in the
// database and an admin can add or remove them, but every progress reader here
// is synchronous, so the count is cached the same way progress itself is:
// localStorage is the synchronous source, refreshed from the API on login.
// The seeded default is only the fallback before the first successful fetch.
let partsCount = readCachedPartsCount()

function readCachedPartsCount() {
  const cached = Number(localStorage.getItem(PARTS_COUNT_KEY))
  return Number.isInteger(cached) && cached > 0 ? cached : partsHotspots.length
}

// Called alongside hydrateProgressFromServer(). A failure leaves the previous
// count in place rather than resetting to the seeded default.
export async function hydratePartsCount() {
  const parts = await fetchParts()
  if (!Array.isArray(parts) || parts.length === 0) return

  partsCount = parts.length
  localStorage.setItem(PARTS_COUNT_KEY, String(parts.length))
  notify()
}

export function getPartsCount() {
  return partsCount
}

// How many checklist items each module has, keyed by slug. Cached for the same
// reason as partsCount: getChecklistCompletion is synchronous.
let checklistCounts = readCachedChecklistCounts()

function readCachedChecklistCounts() {
  try {
    const cached = JSON.parse(localStorage.getItem(CHECKLIST_COUNTS_KEY))
    return cached && typeof cached === 'object' ? cached : null
  } catch {
    return null
  }
}

export async function hydrateChecklistCounts() {
  const counts = await fetchChecklistCounts()
  if (!counts || typeof counts !== 'object') return

  checklistCounts = counts
  localStorage.setItem(CHECKLIST_COUNTS_KEY, JSON.stringify(counts))
  notify()
}

// Falls back to the seeded list only while nothing has been fetched yet - not
// per slug, or a module whose items an admin deleted would keep the old total.
function checklistTotal(moduleSlug) {
  if (checklistCounts) return checklistCounts[moduleSlug] || 0
  return (moduleChecklists[moduleSlug] || []).length
}

const equipmentModuleSlugs = ['walk-around-check', 'load-handling', 'post-operation', 'pallet-testing']
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
    simulations: {},
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
    simulations: progress?.simulations || {},
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
  scheduleServerPush(next)
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

// Clears only the local copy (used on logout); the server copy is untouched
// and comes back on the next login via hydrateProgressFromServer().
export function resetStoredProgress() {
  cancelServerPush()
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

export function setSimulationProgress(moduleSlug, simulationProgress) {
  const progress = getStoredProgress()

  return persist({
    ...progress,
    simulations: {
      ...progress.simulations,
      [moduleSlug]: {
        ...(progress.simulations[moduleSlug] || {}),
        ...simulationProgress,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export function getChecklistCompletion(progress, moduleSlug) {
  const totalCount = checklistTotal(moduleSlug)
  const completedItems = progress.checklists[moduleSlug]?.completedItems || []
  // Items are stored by their text, so one an admin edited or deleted lingers
  // in the saved list; clamped so it cannot report more than the module has.
  const completedCount = Math.min(completedItems.length, totalCount)

  return {
    completedItems,
    completedCount,
    totalCount,
    percentage: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
  }
}

export function getModuleProgress(progress, moduleSlug) {
  const simulationProgress = progress.simulations[moduleSlug]?.percentage

  if (typeof simulationProgress === 'number') {
    return simulationProgress
  }

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
  // Clamped because a part an admin deleted can still be in viewedPartIds,
  // which would otherwise push this over 100%.
  const viewedCount = Math.min(progress.parts.viewedPartIds.length, partsCount)
  const viewedPercentage = partsCount ? (viewedCount / partsCount) * 100 : 0
  const latestPractice = progress.parts.practiceAttempts[0]
  const practicePercentage = latestPractice ? latestPractice.percentage : 0

  return Math.round(viewedPercentage * 0.5 + practicePercentage * 0.5)
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
    partsCount,
    quizAttempts: progress.quizzes,
    partsPracticeAttempts: progress.parts.practiceAttempts,
    simulations: progress.simulations,
  }
}

export { CHANGE_EVENT, equipmentModuleSlugs, partsModuleSlug }
