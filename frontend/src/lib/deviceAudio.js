// Synthesized warning-device sounds. Generating these with the Web Audio API
// keeps the prototype free of audio assets and licensing concerns.

let audioContext = null
let activeStopper = null

function getContext() {
  if (typeof window === 'undefined') return null

  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    audioContext = new AudioContextClass()
  }

  // Browsers start the context suspended until a user gesture.
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }

  return audioContext
}

function stopActive() {
  if (activeStopper) {
    activeStopper()
    activeStopper = null
  }
}

/** Two-tone forklift horn. */
function playHorn(context) {
  const now = context.currentTime
  const duration = 0.85
  const master = context.createGain()
  master.connect(context.destination)
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.22, now + 0.03)
  master.gain.setValueAtTime(0.22, now + duration - 0.12)
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  const oscillators = [440, 554].map((frequency) => {
    const oscillator = context.createOscillator()
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.connect(master)
    oscillator.start(now)
    oscillator.stop(now + duration)
    return oscillator
  })

  return () => {
    oscillators.forEach((oscillator) => {
      try {
        oscillator.stop()
      } catch {
        // already stopped
      }
    })
    master.disconnect()
  }
}

/** Intermittent reverse beeper. */
function playBackupAlarm(context) {
  const now = context.currentTime
  const beepCount = 4
  const beepLength = 0.22
  const gap = 0.16
  const master = context.createGain()
  master.gain.setValueAtTime(0.16, now)
  master.connect(context.destination)

  const oscillator = context.createOscillator()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(1000, now)

  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0, now)

  for (let index = 0; index < beepCount; index += 1) {
    const start = now + index * (beepLength + gap)
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.setValueAtTime(1, start + 0.005)
    envelope.gain.setValueAtTime(1, start + beepLength)
    envelope.gain.setValueAtTime(0, start + beepLength + 0.005)
  }

  const total = beepCount * (beepLength + gap)
  oscillator.connect(envelope)
  envelope.connect(master)
  oscillator.start(now)
  oscillator.stop(now + total)

  return () => {
    try {
      oscillator.stop()
    } catch {
      // already stopped
    }
    envelope.disconnect()
    master.disconnect()
  }
}

/** Starter motor cranking, then the engine catching and settling to idle. */
function playEngineStart(context) {
  const now = context.currentTime
  const total = 2.4
  const master = context.createGain()
  master.gain.setValueAtTime(0, now)
  master.gain.linearRampToValueAtTime(0.5, now + 0.05)
  master.connect(context.destination)

  // Low-pass keeps the synthesized engine from sounding buzzy.
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(320, now)
  filter.connect(master)

  const crank = context.createOscillator()
  crank.type = 'sawtooth'
  crank.frequency.setValueAtTime(38, now)
  const crankGain = context.createGain()
  crankGain.gain.setValueAtTime(0, now)

  for (let index = 0; index < 3; index += 1) {
    const start = now + index * 0.27
    crankGain.gain.setValueAtTime(0, start)
    crankGain.gain.linearRampToValueAtTime(0.55, start + 0.07)
    crankGain.gain.linearRampToValueAtTime(0, start + 0.23)
  }

  crank.connect(crankGain)
  crankGain.connect(filter)
  crank.start(now)
  crank.stop(now + 0.85)

  const idleStart = now + 0.8
  const idle = context.createOscillator()
  idle.type = 'sawtooth'
  idle.frequency.setValueAtTime(52, idleStart)
  idle.frequency.exponentialRampToValueAtTime(98, idleStart + 0.28)
  idle.frequency.exponentialRampToValueAtTime(64, idleStart + 1)
  const idleGain = context.createGain()
  idleGain.gain.setValueAtTime(0, idleStart)
  idleGain.gain.linearRampToValueAtTime(0.5, idleStart + 0.16)
  idleGain.gain.setValueAtTime(0.5, now + total - 0.5)
  idleGain.gain.linearRampToValueAtTime(0, now + total)
  idle.connect(idleGain)
  idleGain.connect(filter)
  idle.start(idleStart)
  idle.stop(now + total)

  return () => {
    ;[crank, idle].forEach((oscillator) => {
      try {
        oscillator.stop()
      } catch {
        // already stopped
      }
    })
    filter.disconnect()
    master.disconnect()
  }
}

const players = {
  horn: playHorn,
  alarm: playBackupAlarm,
  'engine-start': playEngineStart,
}

/** Plays one of the synthesized device sounds, cutting off any previous one. */
export function playDeviceSound(name) {
  const player = players[name]
  if (!player) return

  const context = getContext()
  if (!context) return

  stopActive()
  activeStopper = player(context)
}

export function stopDeviceSound() {
  stopActive()
}
