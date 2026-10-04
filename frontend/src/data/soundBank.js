// The sound bank: every sample the app plays, by name (docs/revisions/
// post-defense-plan.md, section 4.4). Code-owned, not admin-editable. The
// files are recorded samples in frontend/public/audio/, built from the
// originals by frontend/scripts/build-audio.mjs and credited in
// public/audio/CREDITS.md. Pure data: lib/audio/audioEngine.js plays it, and
// lib/driving/drivingAudio.js decides when.
//
// - `bus` is the mixer channel the sound plays on.
// - `gain` balances the samples against each other (the files are normalised,
//   so this is the mix, judged by ear).
// - `loop: true` marks a file that repeats without a gap: a whole number of
//   periods, or crossfaded end to start. Loops are lossless (FLAC), because
//   MP3 and AAC encoders pad the file and click at the loop point. `loopStart`
//   / `loopEnd` (seconds) narrow the loop inside the file when set.
// - One-shots play once and may be compressed.

export const AUDIO_BASE_URL = '/audio/'

export const AUDIO_BUSES = ['engine', 'machine', 'alerts', 'ui']

export const SOUND_BANK = {
  // The engine: two loops crossfaded by engine speed, each pitched so both
  // fire at the same frequency (drivingAudio.js). `firingHz` is the firing
  // frequency the recording was made at, measured from the file.
  engineIdle: { file: 'engine-idle.flac', bus: 'engine', loop: true, gain: 0.7, firingHz: 45.5 },
  engineHigh: { file: 'engine-high.flac', bus: 'engine', loop: true, gain: 0.7, firingHz: 81 },
  // `catchAt` is when, in the recording, the engine fires and the loops take
  // over from the starter.
  engineStart: { file: 'engine-start.mp3', bus: 'engine', gain: 0.8, catchAt: 0.5 },
  engineStop: { file: 'engine-stop.mp3', bus: 'engine', gain: 0.8 },

  reverseBeeper: { file: 'reverse-beeper.flac', bus: 'alerts', loop: true, gain: 0.35 },
  horn: { file: 'horn.mp3', bus: 'alerts', gain: 0.8 },
  // The pre-start interlock refusing to crank.
  denied: { file: 'denied.mp3', bus: 'alerts', gain: 0.6 },
  // The safety signs (lib/driving/safetyRules.js): a caution and a danger.
  cautionChime: { file: 'caution-chime.mp3', bus: 'alerts', gain: 0.6 },
  dangerAlarm: { file: 'danger-alarm.mp3', bus: 'alerts', gain: 0.7 },

  hydraulicWhine: { file: 'hydraulic-whine.flac', bus: 'machine', loop: true, gain: 0.5 },
  reliefStrain: { file: 'relief-strain.flac', bus: 'machine', loop: true, gain: 0.45 },
  chainRattle: { file: 'chain-rattle.flac', bus: 'machine', loop: true, gain: 0.35 },
  // What the physics does (Phase 7): the fork tips dragged along the floor,
  // and things struck or set down hard. lib/driving/drivingAudio.js scales an
  // impact's gain by how hard it was.
  forkScrape: { file: 'fork-scrape.flac', bus: 'machine', loop: true, gain: 0.5 },
  palletDrop: { file: 'pallet-drop.mp3', bus: 'machine', gain: 0.8 },
  coneKnock: { file: 'cone-knock.mp3', bus: 'machine', gain: 0.7 },
  metalImpact: { file: 'metal-impact.mp3', bus: 'machine', gain: 0.6 },

  // The defect test's faults (data/defectLibrary.js, `sounds`): an LPG leak
  // hissing at the fitting, a knocking engine, worn brakes grinding while
  // they are on, and a dead horn's button clicking.
  lpgHiss: { file: 'lpg-hiss.flac', bus: 'machine', loop: true, gain: 0.5 },
  engineKnock: { file: 'engine-knock.flac', bus: 'engine', loop: true, gain: 0.55 },
  brakeGrind: { file: 'brake-grind.flac', bus: 'machine', loop: true, gain: 0.5 },
  hornClick: { file: 'horn-click.mp3', bus: 'ui', gain: 0.7 },

  keyClick: { file: 'key-click.mp3', bus: 'ui', gain: 0.7 },
  seatbelt: { file: 'seatbelt.mp3', bus: 'ui', gain: 0.7 },
  parkingBrake: { file: 'parking-brake.mp3', bus: 'ui', gain: 0.7 },
}

export function soundUrl(name) {
  const sound = SOUND_BANK[name]
  return sound ? `${AUDIO_BASE_URL}${sound.file}` : null
}

// What each surface needs loaded before it can play without a delay.
export const DRIVING_SOUNDS = [
  'engineIdle',
  'engineHigh',
  'engineStart',
  'engineStop',
  'reverseBeeper',
  'horn',
  'denied',
  'hydraulicWhine',
  'reliefStrain',
  'chainRattle',
  'forkScrape',
  'palletDrop',
  'coneKnock',
  'metalImpact',
  'keyClick',
  'seatbelt',
  'parkingBrake',
  'cautionChime',
  'dangerAlarm',
]
