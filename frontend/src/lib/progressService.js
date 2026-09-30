import { moduleChecklists } from './trainingData.js'
import { migrateParts } from './migrateParts.js'
import {
  getChecklistCounts as fetchChecklistCounts,
  getProgress as fetchServerProgress,
  saveProgress as pushServerProgress,
} from './api.js'

const STORAGE_KEY = 'gearview_progress_v1'
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

// The server copy carries a `revision` that only a reset changes, and a push
// says which revision it was based on. A 409 means an instructor reset this
// learner since that read, and the local copy is what they reset: it is
// dropped and the reset document read back, rather than pushed over it.
function scheduleServerPush(progress) {
  cancelServerPush()
  serverPushTimer = setTimeout(() => {
    serverPushTimer = null
    const { revision = 0, ...document } = progress
    pushServerProgress(document, revision).catch((error) => {
      if (error.status === 409) {
        hydrateProgressFromServer().catch(() => {})
      }
      // Anything else: offline or logged out; the local copy is still saved.
    })
  }, SERVER_PUSH_DELAY_MS)
}

// Called after login/session restore, after a quiz is graded and after a push
// is refused as stale: replaces the local copy with the signed-in user's server
// copy (if any), `revision` included, so progress follows the account, not the
// browser.
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

// How many checklist items each module has, keyed by slug. Cached because
// getChecklistCompletion is synchronous: localStorage is the synchronous
// source, refreshed from the API on login.
//
// There is no equivalent cache for hotspots. Every page that shows a parts
// percentage has already fetched the published hotspots to render them, so it
// passes the ids in.
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

function emptyProgress() {
  return {
    version: 1,
    // The server revision this copy was read at (see scheduleServerPush); 0
    // until the server has a snapshot.
    revision: 0,
    checklists: {},
    parts: {
      viewedPartIds: [],
      // Parts-quiz attempts, newest first.
      quizAttempts: [],
    },
    quizzes: {},
    simulations: {},
    updatedAt: null,
  }
}

// Runs on every read, which is also every hydration.
function normalizeProgress(progress) {
  return {
    ...emptyProgress(),
    ...progress,
    checklists: progress?.checklists || {},
    parts: migrateParts(progress?.parts),
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

// Module, hotspot and overall percentages. The caller passes the module slugs
// and hotspot ids because both are data-driven: an admin adds and removes
// them.
export function getModulesProgress(progress, moduleSlugs) {
  if (!moduleSlugs.length) return 0
  return Math.round(
    moduleSlugs.reduce((sum, slug) => sum + getModuleProgress(progress, slug), 0) / moduleSlugs.length,
  )
}

// Counted against the ids passed in, so a hotspot an admin deleted stays in the
// learner's saved list without pushing this over 100%.
export function getHotspotProgress(progress, hotspotIds) {
  if (!hotspotIds.length) return 0
  const viewed = new Set(progress.parts.viewedPartIds)
  const viewedCount = hotspotIds.filter((id) => viewed.has(id)).length
  return Math.round((viewedCount / hotspotIds.length) * 100)
}

// Parts-quiz attempts, newest first.
export function getPartsQuizAttempts(progress) {
  return progress.parts.quizAttempts
}

// The latest attempt for either kind of quiz, given the same `scope` the Quiz
// component and the API take.
export function getLatestQuizAttempt(progress, scope) {
  if (scope?.context === 'parts') return getPartsQuizAttempts(progress)[0]
  return progress.quizzes?.[scope?.module]?.[0]
}

// The Parts Identification percentage: hotspots viewed, averaged with the
// latest parts-quiz score once the page has a quiz.
export function getPartsProgress(progress, hotspotIds, hasQuiz = false) {
  const viewed = getHotspotProgress(progress, hotspotIds)
  if (!hasQuiz) return viewed

  const latest = getPartsQuizAttempts(progress)[0]
  return Math.round(viewed * 0.5 + (latest ? latest.percentage : 0) * 0.5)
}

// `partsPercentage` is what getPartsProgress() returned, or null when there
// is no parts page to average in.
export function getOverallProgress(progress, moduleSlugs, partsPercentage) {
  const moduleProgress = getModulesProgress(progress, moduleSlugs)
  if (partsPercentage === null || partsPercentage === undefined) return moduleProgress
  return Math.round((moduleProgress + partsPercentage) / 2)
}

// The synchronous snapshot the UI reads.
//
// Nothing here is keyed by module slug on purpose. Anything that would be -
// per-module progress, per-module checklist completion, a parts or overall
// percentage - needs the list of modules or hotspot ids that page is showing,
// and only the page has it. Pre-building those maps here keyed them off a
// hardcoded four-slug list, so every module an admin created reported "no
// checklist items" no matter what it had.
// Call getModuleProgress / getChecklistCompletion / getPartsProgress /
// getOverallProgress with the slugs and ids you already fetched instead.
export function getProgressSummary(progress = getStoredProgress()) {
  return {
    raw: progress,
    viewedParts: progress.parts.viewedPartIds,
    quizAttempts: progress.quizzes,
    simulations: progress.simulations,
  }
}

export { CHANGE_EVENT }
