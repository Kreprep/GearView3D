import { useSyncExternalStore } from 'react'
import { getAudioEngine } from '../lib/audio/audioEngine'
import { getAudioSettings, subscribeToAudioSettings } from '../lib/audio/audioSettings'

// The learner's volume and mute (lib/audio/audioSettings.js), live: every
// volume control on screen and in other tabs shows the same thing.
export function useAudioSettings() {
  return useSyncExternalStore(subscribeToAudioSettings, getAudioSettings)
}

const isSuspended = () => getAudioEngine().state() === 'suspended'

// True while the browser is holding the audio context back until it sees a
// user gesture. A click or a key press releases it; gamepad input may not.
export function useAudioSuspended() {
  return useSyncExternalStore((onChange) => getAudioEngine().subscribe(onChange), isSuspended)
}
