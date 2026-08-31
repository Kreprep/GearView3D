// The app's language preference, as a module store rather than a React context.
//
// Same mechanism progressService.js already uses (localStorage + a custom event
// + subscribers) and for the same reason: t() has to be callable outside React.
// lib/driving/stepGoals.js produces learner-visible status text inside a
// useFrame loop against refs, where there is no render and no context to read.
//
// Deliberately does NOT import the i18n catalog: this module touches
// localStorage and document at import time, and i18n/translate.js must stay
// pure so data/hubContent.js (backend-importable by contract) can use it.

export const LANGUAGES = [
  // label/name are endonyms - they read the same in either language, so they
  // are data here rather than catalog keys.
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'fil', label: 'FIL', name: 'Filipino' },
]

export const DEFAULT_LANGUAGE = 'en'

const STORAGE_KEY = 'gearview_language'
const CHANGE_EVENT = 'gearview-language-change'

function isSupported(code) {
  return LANGUAGES.some((language) => language.code === code)
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isSupported(raw) ? raw : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

// Cached, because getLanguage() is called on hot paths (per-frame status text).
// That is exactly why subscribeToLanguage has to refresh it - see below.
let current = readStored()

// <html lang> is set here at import time as well as on change. setLanguage only
// fires on a toggle, so a returning learner whose saved preference is `fil`
// would otherwise be announced to a screen reader as English for the whole
// session. `fil` (not `tl`) is a valid BCP-47 subtag, is the standardized
// register the app means, and matches the stored code so no mapping is needed.
function applyDocumentLanguage(code) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = code
}

applyDocumentLanguage(current)

export function getLanguage() {
  return current
}

export function setLanguage(code) {
  const next = isSupported(code) ? code : DEFAULT_LANGUAGE
  if (next === current) return current

  current = next

  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // A private-mode browser that refuses writes still gets the switch for
    // this session; only persistence across reloads is lost.
  }

  applyDocumentLanguage(next)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  }

  return next
}

// The listener re-reads storage before notifying. progressService gets away
// without this because getStoredProgress() re-reads localStorage on every call;
// getLanguage() returns the cached variable, and a `storage` event from a second
// tab never went through setLanguage, so nothing else would refresh it.
export function subscribeToLanguage(listener) {
  if (typeof window === 'undefined') return () => {}

  const handle = () => {
    const stored = readStored()
    if (stored !== current) {
      current = stored
      applyDocumentLanguage(current)
    }
    listener(current)
  }

  window.addEventListener(CHANGE_EVENT, handle)
  window.addEventListener('storage', handle)

  return () => {
    window.removeEventListener(CHANGE_EVENT, handle)
    window.removeEventListener('storage', handle)
  }
}
