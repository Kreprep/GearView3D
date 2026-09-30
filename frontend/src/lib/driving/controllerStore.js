import { resolveControllerConfig } from './gamepad.js'

// Where the controller config (bindings, calibration, wheel rotation) is
// kept: localStorage under gearview_controller_v1. It describes this
// machine's hardware, so it doesn't belong in the database or follow the
// learner to another computer. Changes dispatch gearview-controller-change,
// the same pattern lib/language.js and progressService.js use, so an open
// driving screen picks up a binding made in Controller Setup at once.
//
// Storage can be unavailable (a private window, blocked site data); the
// defaults then apply and a save only lasts for the page.

export const CONTROLLER_STORAGE_KEY = 'gearview_controller_v1'
export const CONTROLLER_CHANGE_EVENT = 'gearview-controller-change'

let memoryCopy = null

export function loadControllerConfig() {
  try {
    const raw = window.localStorage.getItem(CONTROLLER_STORAGE_KEY)
    if (raw) return resolveControllerConfig(JSON.parse(raw))
  } catch {
    // Unreadable or unavailable: fall through to the in-memory copy.
  }
  return resolveControllerConfig(memoryCopy)
}

export function saveControllerConfig(config) {
  memoryCopy = config
  try {
    window.localStorage.setItem(CONTROLLER_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Kept in memory for this page only.
  }
  window.dispatchEvent(new Event(CONTROLLER_CHANGE_EVENT))
}

export function resetControllerConfig() {
  memoryCopy = null
  try {
    window.localStorage.removeItem(CONTROLLER_STORAGE_KEY)
  } catch {
    // Nothing stored to remove.
  }
  window.dispatchEvent(new Event(CONTROLLER_CHANGE_EVENT))
}

// Calls `onChange(config)` when the config changes here or in another tab.
export function subscribeToControllerConfig(onChange) {
  const handleChange = () => onChange(loadControllerConfig())
  const handleStorage = (event) => {
    if (event.key === CONTROLLER_STORAGE_KEY) handleChange()
  }
  window.addEventListener(CONTROLLER_CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(CONTROLLER_CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleStorage)
  }
}
