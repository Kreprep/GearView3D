import { AUDIO_BUSES, SOUND_BANK, soundUrl } from '../../data/soundBank.js'
import { getAudioSettings, masterGain, subscribeToAudioSettings } from './audioSettings.js'

// The app's one audio system (docs/revisions/post-defense-plan.md, section
// 4.4): a single Web Audio context shared by the driving simulation and the
// walk-around device tests, playing the recorded samples in data/soundBank.js.
//
//   source -> the voice's own gain -> its bus -> master -> speakers
//
// The master gain is the learner's volume and mute (audioSettings.js). The
// buses (engine / machine / alerts / ui) are there so a group can be balanced
// or ducked as one.
//
// Nothing happens until something asks for sound: the context is created and
// a file is fetched on first use, so a page that plays nothing (the hub)
// loads nothing. A file that fails to load is silent, never an error.
//
// Gains and playback rates only ever change through setTargetAtTime, an
// exponential approach: setting an AudioParam's value directly steps the
// signal, which is heard as a click.
//
// createAudioEngine() takes its browser pieces as arguments so the tests can
// run it against a fake context; getAudioEngine() is the app's shared one.

// How fast a gain or rate follows a new target when the caller doesn't say
// (seconds, the exponential's time constant).
const DEFAULT_TIME_CONSTANT = 0.05
const MASTER_TIME_CONSTANT = 0.03
// A stopped loop fades out over a few time constants before its source ends.
const STOP_TIME_CONSTANT = 0.03
const STOP_TAIL = 0.2
// A one-shot that could not start at once (its file still loading, or the
// context still waking up) plays late only up to this long (seconds). Past
// that it no longer belongs to the press that asked for it.
const ONE_SHOT_MAX_DELAY = 0.4
// Targets closer than this are the same target: no new automation event.
const TARGET_EPSILON = 1e-4
// How many one-shots debugSnapshot() remembers.
const PLAYED_HISTORY = 50

const NULL_LOOP = { setGain() {}, setRate() {}, stop() {} }
const NO_STOP = () => {}

function createBrowserContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  return AudioContextClass ? new AudioContextClass({ latencyHint: 'interactive' }) : null
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.arrayBuffer()
}

export function createAudioEngine({
  createContext = createBrowserContext,
  loadData = fetchArrayBuffer,
  bank = SOUND_BANK,
  urlFor = soundUrl,
  settings = getAudioSettings(),
  // Wall-clock seconds. The audio clock stands still while suspended.
  clock = () => performance.now() / 1000,
} = {}) {
  let context = null
  let unavailable = false
  let master = null
  let currentSettings = settings
  const buses = {}
  // name -> Promise<AudioBuffer | null>, so a file is fetched and decoded once.
  const loading = new Map()
  const buffers = new Map()
  const listeners = new Set()
  const notify = () => listeners.forEach((listener) => listener())
  // For debugSnapshot(): the loops that are open, and the one-shots started.
  const openLoops = new Set()
  const played = []

  function ensureContext() {
    if (context || unavailable) return context
    try {
      context = createContext()
    } catch {
      context = null
    }
    if (!context) {
      unavailable = true
      notify()
      return null
    }
    master = context.createGain()
    master.gain.value = masterGain(currentSettings)
    master.connect(context.destination)
    for (const bus of AUDIO_BUSES) {
      buses[bus] = context.createGain()
      buses[bus].connect(master)
    }
    context.addEventListener('statechange', notify)
    notify()
    return context
  }

  function load(name) {
    if (loading.has(name)) return loading.get(name)
    const ctx = ensureContext()
    const url = urlFor(name)
    const pending =
      ctx && url
        ? loadData(url)
            .then((data) => ctx.decodeAudioData(data))
            .then((buffer) => {
              buffers.set(name, buffer)
              return buffer
            })
            .catch((error) => {
              console.warn(`Sound "${name}" could not be loaded (${url}):`, error?.message || error)
              return null
            })
        : Promise.resolve(null)
    loading.set(name, pending)
    return pending
  }

  // Ask the browser to start (or restart) the context. Only takes effect
  // from a user gesture, or once the page has had one; until then the
  // promise stays pending.
  function resume() {
    if (!context || context.state === 'running' || context.state === 'closed') return Promise.resolve()
    return context.resume().catch(() => {})
  }

  function startOneShot(name, { gain, rate }) {
    const sound = bank[name]
    const source = context.createBufferSource()
    const voice = context.createGain()
    source.buffer = buffers.get(name)
    source.playbackRate.value = rate
    voice.gain.value = sound.gain * gain
    source.connect(voice)
    voice.connect(buses[sound.bus])
    source.onended = () => voice.disconnect()
    source.start()
    played.push(name)
    if (played.length > PLAYED_HISTORY) played.shift()
    return () => {
      voice.gain.setTargetAtTime(0, context.currentTime, STOP_TIME_CONSTANT)
      source.stop(context.currentTime + STOP_TAIL)
    }
  }

  return {
    // 'idle' before anything has asked for sound, 'unavailable' where there
    // is no Web Audio, otherwise the context's state: 'running', or
    // 'suspended' until the browser has seen a user gesture.
    state() {
      if (unavailable) return 'unavailable'
      return context ? context.state : 'idle'
    },

    // Seconds on the audio clock. It stands still while suspended.
    now() {
      return context ? context.currentTime : 0
    },

    // Calls `listener()` when state() changes. Returns the unsubscribe.
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    // Wake the context (see resume() above). Returns a promise.
    resume,

    // Stop the audio clock, and with it every loop (a hidden tab).
    suspend() {
      if (context && context.state === 'running') context.suspend().catch(() => {})
    },

    // Fetch and decode these sounds now, so the first play isn't late.
    preload(names) {
      return Promise.all(names.map(load))
    },

    applySettings(nextSettings) {
      currentSettings = nextSettings
      if (master) master.gain.setTargetAtTime(masterGain(nextSettings), context.currentTime, MASTER_TIME_CONSTANT)
    },

    // Play a sound once. `gain` and `rate` scale the bank's. Returns a
    // function that cuts it short. A source is never started on a suspended
    // context: everything asked for while it slept would sound at once when
    // it woke.
    playOneShot(name, { gain = 1, rate = 1 } = {}) {
      const ctx = ensureContext()
      if (!ctx || !bank[name]) return NO_STOP
      if (ctx.state === 'running' && buffers.has(name)) return startOneShot(name, { gain, rate })

      const askedAt = clock()
      let stop = NO_STOP
      let cancelled = false
      Promise.all([load(name), resume()]).then(([buffer]) => {
        if (!buffer || cancelled || ctx.state !== 'running' || clock() - askedAt > ONE_SHOT_MAX_DELAY) return
        stop = startOneShot(name, { gain, rate })
      })
      return () => {
        cancelled = true
        stop()
      }
    },

    // Start a looping sound, silent, and return its handle:
    //   setGain(value, timeConstant)  0..1, scaled by the bank's gain
    //   setRate(value, timeConstant)  playback rate, 1 = as recorded
    //   stop()                        fade out and end it
    // The loop keeps running at gain 0, so bringing it back has no start-up.
    createLoop(name) {
      const sound = bank[name]
      const ctx = ensureContext()
      if (!ctx || !sound) return NULL_LOOP
      resume()

      const voice = ctx.createGain()
      voice.gain.value = 0
      voice.connect(buses[sound.bus])
      let source = null
      let stopped = false
      // Where the loop is heading: its gain (bank gain included) and rate.
      const target = { name, gain: 0, rate: 1 }
      openLoops.add(target)

      load(name).then((buffer) => {
        if (!buffer || stopped) return
        source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        if (typeof sound.loopStart === 'number') source.loopStart = sound.loopStart
        if (typeof sound.loopEnd === 'number') source.loopEnd = sound.loopEnd
        source.playbackRate.value = target.rate
        source.connect(voice)
        source.onended = () => voice.disconnect()
        source.start()
      })

      return {
        setGain(value, timeConstant = DEFAULT_TIME_CONSTANT) {
          const gain = Math.min(Math.max(value, 0), 1) * sound.gain
          if (stopped || Math.abs(gain - target.gain) < TARGET_EPSILON) return
          target.gain = gain
          voice.gain.setTargetAtTime(gain, ctx.currentTime, timeConstant)
        },
        setRate(value, timeConstant = DEFAULT_TIME_CONSTANT) {
          if (stopped || !(value > 0) || Math.abs(value - target.rate) < TARGET_EPSILON) return
          target.rate = value
          if (source) source.playbackRate.setTargetAtTime(value, ctx.currentTime, timeConstant)
        },
        stop() {
          if (stopped) return
          stopped = true
          openLoops.delete(target)
          if (!source) {
            voice.disconnect()
            return
          }
          voice.gain.setTargetAtTime(0, ctx.currentTime, STOP_TIME_CONSTANT)
          source.stop(ctx.currentTime + STOP_TAIL)
        },
      }
    },

    // What the engine is doing, for the browser checks (window.__audioDebug
    // in a dev build): its state, the files decoded, where each open loop is
    // heading and the one-shots started, oldest first.
    debugSnapshot() {
      return {
        state: this.state(),
        loaded: [...buffers.keys()],
        loops: [...openLoops].map((loop) => ({ ...loop, playing: buffers.has(loop.name) })),
        played: [...played],
      }
    },
  }
}

let shared = null

// The app's audio engine. The first call wires it to the page: the saved
// volume and mute, a resume on any click or key press (the browser keeps a
// context suspended until a user gesture, and gamepad input may not count as
// one), and a pause while the tab is hidden, where the frame loop that steers
// the loops isn't running.
export function getAudioEngine() {
  if (shared) return shared
  const engine = createAudioEngine()
  shared = engine

  subscribeToAudioSettings(() => engine.applySettings(getAudioSettings()))
  const resume = () => engine.resume()
  window.addEventListener('pointerdown', resume)
  window.addEventListener('keydown', resume)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) engine.suspend()
    else engine.resume()
  })
  if (import.meta.env?.DEV) window.__audioDebug = () => engine.debugSnapshot()
  return engine
}
