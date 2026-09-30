// The learner's sound preference: volume and mute, kept in localStorage under
// gearview_audio_v1 (docs/revisions/post-defense-plan.md, section 4.4). Like
// the controller config (lib/driving/controllerStore.js) it belongs to this
// browser, not to the account, and a change dispatches an event so the audio
// engine and every volume control on screen follow at once.
//
// Storage can be unavailable (a private window, blocked site data); the
// defaults then apply and a change only lasts for the page.

export const AUDIO_STORAGE_KEY = 'gearview_audio_v1'
export const AUDIO_CHANGE_EVENT = 'gearview-audio-change'

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({ volume: 0.8, muted: false })

// Whatever was stored, as valid settings. Pure.
export function resolveAudioSettings(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {}
  const volume = Number.isFinite(stored.volume) ? Math.min(Math.max(stored.volume, 0), 1) : DEFAULT_AUDIO_SETTINGS.volume
  const muted = typeof stored.muted === 'boolean' ? stored.muted : DEFAULT_AUDIO_SETTINGS.muted
  return { volume, muted }
}

// The master gain for the settings. The slider is squared, because loudness
// is heard roughly logarithmically: half the slider should sound like half
// the volume, which is about a quarter of the amplitude. Pure.
export function masterGain({ volume, muted }) {
  return muted ? 0 : volume * volume
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY)
    return resolveAudioSettings(raw ? JSON.parse(raw) : null)
  } catch {
    return resolveAudioSettings(null)
  }
}

// Cached, and read on first use rather than at import. The object is
// replaced, never mutated, so useSyncExternalStore can compare it by
// identity.
let current = null

export function getAudioSettings() {
  if (!current) current = readStored()
  return current
}

export function setAudioSettings(patch) {
  current = resolveAudioSettings({ ...getAudioSettings(), ...patch })
  try {
    window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Kept in memory for this page only.
  }
  window.dispatchEvent(new Event(AUDIO_CHANGE_EVENT))
  return current
}

// Calls `onChange()` when the settings change here or in another tab.
export function subscribeToAudioSettings(onChange) {
  const handleStorage = (event) => {
    if (event.key !== AUDIO_STORAGE_KEY) return
    // Another tab wrote it, so the cached copy is stale.
    current = readStored()
    onChange()
  }
  window.addEventListener(AUDIO_CHANGE_EVENT, onChange)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(AUDIO_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', handleStorage)
  }
}
