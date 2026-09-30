import '../../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAudioEngine } from './audioEngine.js'
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  getAudioSettings,
  masterGain,
  resolveAudioSettings,
  setAudioSettings,
} from './audioSettings.js'

// --- a fake Web Audio context ------------------------------------------------
// Just enough of the API to see what the engine asked for: which nodes it
// made, how they are wired, and every change scheduled on an AudioParam.

function fakeParam(value) {
  const param = {
    value,
    initial: value,
    targets: [],
    setTargetAtTime(target, time, timeConstant) {
      param.targets.push({ target, time, timeConstant })
    },
  }
  return param
}

function fakeNode(kind, extra = {}) {
  const node = {
    kind,
    outputs: [],
    connect(target) {
      node.outputs.push(target)
    },
    disconnect() {
      node.outputs = []
    },
    ...extra,
  }
  return node
}

function fakeContext({ state = 'running' } = {}) {
  const context = {
    state,
    currentTime: 0,
    destination: fakeNode('destination'),
    gains: [],
    sources: [],
    listeners: {},
    createGain() {
      const node = fakeNode('gain', { gain: fakeParam(1) })
      context.gains.push(node)
      return node
    },
    createBufferSource() {
      const node = fakeNode('source', {
        playbackRate: fakeParam(1),
        loop: false,
        started: false,
        stopAt: null,
        start() {
          node.started = true
        },
        stop(when) {
          node.stopAt = when ?? context.currentTime
        },
      })
      context.sources.push(node)
      return node
    },
    decodeAudioData: async (data) => ({ decodedFrom: data }),
    addEventListener(type, listener) {
      context.listeners[type] = listener
    },
    async resume() {
      context.state = 'running'
      context.listeners.statechange?.()
    },
    async suspend() {
      context.state = 'suspended'
      context.listeners.statechange?.()
    },
  }
  return context
}

const BANK = {
  beep: { file: 'beep.mp3', bus: 'alerts', gain: 0.5 },
  hum: { file: 'hum.flac', bus: 'engine', loop: true, gain: 0.8 },
}

function setup({ context = fakeContext(), failing = [], settings = { volume: 1, muted: false } } = {}) {
  const fetched = []
  const time = { now: 0 }
  let created = 0
  const engine = createAudioEngine({
    createContext: () => {
      created += 1
      return context
    },
    loadData: async (url) => {
      fetched.push(url)
      if (failing.includes(url)) throw new Error('HTTP 404')
      return url
    },
    bank: BANK,
    urlFor: (name) => (BANK[name] ? `/audio/${BANK[name].file}` : null),
    settings,
    clock: () => time.now,
  })
  return { engine, context, fetched, time, contextsCreated: () => created }
}

// Lets the engine's fetch-then-decode promise chain run.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// The gain node a source plays through, and the bus that feeds.
const voiceOf = (source) => source.outputs[0]
const busOf = (source) => voiceOf(source).outputs[0]

// --- the engine ----------------------------------------------------------------

test('nothing is created or fetched until something asks for sound', () => {
  const { engine, fetched, contextsCreated } = setup()
  assert.equal(engine.state(), 'idle')
  assert.equal(engine.now(), 0)
  assert.equal(contextsCreated(), 0)
  assert.deepEqual(fetched, [])
})

test('one context, a master gain and the four buses', async () => {
  const { engine, context, contextsCreated } = setup({ settings: { volume: 0.5, muted: false } })
  await engine.preload(['beep', 'hum'])
  await engine.preload(['beep'])
  assert.equal(contextsCreated(), 1)
  assert.equal(engine.state(), 'running')
  const [master, ...buses] = context.gains
  assert.equal(master.outputs[0], context.destination)
  assert.equal(master.gain.value, 0.25)
  assert.equal(buses.length, 4)
  for (const bus of buses) assert.equal(bus.outputs[0], master)
})

test('a file is fetched and decoded once, however often it is played', async () => {
  const { engine, fetched } = setup()
  await engine.preload(['beep'])
  engine.playOneShot('beep')
  engine.playOneShot('beep')
  await engine.preload(['beep'])
  assert.deepEqual(fetched, ['/audio/beep.mp3'])
})

test('a one-shot plays through its bus at the bank gain', async () => {
  const { engine, context } = setup()
  await engine.preload(['beep'])
  engine.playOneShot('beep', { gain: 0.5, rate: 1.2 })
  const [source] = context.sources
  assert.equal(source.started, true)
  assert.equal(source.loop, false)
  assert.equal(source.playbackRate.value, 1.2)
  assert.equal(voiceOf(source).gain.value, 0.25)
  // The alerts bus is the third of engine / machine / alerts / ui.
  assert.equal(busOf(source), context.gains[3])
})

test('a one-shot asked for before its file arrived still plays, unless it arrives too late', async () => {
  const prompt = setup()
  prompt.engine.playOneShot('beep')
  await settle()
  assert.equal(prompt.context.sources.length, 1)

  const late = setup()
  late.engine.playOneShot('beep')
  late.time.now = 2
  await settle()
  assert.equal(late.context.sources.length, 0)
})

test('a one-shot that was cut short before it started never plays', async () => {
  const { engine, context } = setup()
  const stop = engine.playOneShot('beep')
  stop()
  await settle()
  assert.equal(context.sources.length, 0)
})

test('cutting a one-shot short fades it rather than chopping it', async () => {
  const { engine, context } = setup()
  await engine.preload(['beep'])
  const stop = engine.playOneShot('beep')
  stop()
  const [source] = context.sources
  assert.equal(voiceOf(source).gain.targets.at(-1).target, 0)
  assert.ok(source.stopAt > context.currentTime)
})

test('a press that wakes a suspended context is heard', async () => {
  const { engine, context } = setup({ context: fakeContext({ state: 'suspended' }) })
  await engine.preload(['beep'])
  assert.equal(engine.state(), 'suspended')
  engine.playOneShot('beep')
  assert.equal(context.sources.length, 0)
  await settle()
  assert.equal(engine.state(), 'running')
  assert.equal(context.sources.length, 1)
})

test('sounds asked for while the context could not wake do not pile up', async () => {
  const context = fakeContext({ state: 'suspended' })
  // The browser has seen no user gesture: resume() stays pending.
  let allow
  context.resume = () =>
    new Promise((resolve) => {
      allow = () => {
        context.state = 'running'
        resolve()
      }
    })
  const { engine, time } = setup({ context })
  engine.playOneShot('beep')
  engine.playOneShot('beep')
  await settle()
  time.now = 30
  allow()
  await settle()
  assert.equal(context.sources.length, 0)
})

test('a loop starts silent and only ever moves by setTargetAtTime', async () => {
  const { engine, context } = setup()
  const loop = engine.createLoop('hum')
  await settle()
  const [source] = context.sources
  const voice = voiceOf(source)
  assert.equal(source.loop, true)
  assert.equal(source.started, true)
  assert.equal(voice.gain.value, 0)
  assert.equal(busOf(source), context.gains[1])

  context.currentTime = 3
  loop.setGain(1, 0.2)
  loop.setRate(1.5, 0.2)
  assert.deepEqual(voice.gain.targets, [{ target: 0.8, time: 3, timeConstant: 0.2 }])
  assert.deepEqual(source.playbackRate.targets, [{ target: 1.5, time: 3, timeConstant: 0.2 }])
  // Never stepped directly: that is what clicks.
  assert.equal(voice.gain.value, 0)
  assert.equal(source.playbackRate.value, 1)
})

test('a loop target that has not changed schedules nothing', async () => {
  const { engine, context } = setup()
  const loop = engine.createLoop('hum')
  await settle()
  for (let frame = 0; frame < 60; frame += 1) {
    loop.setGain(0.5)
    loop.setRate(1.2)
  }
  const [source] = context.sources
  assert.equal(voiceOf(source).gain.targets.length, 1)
  assert.equal(source.playbackRate.targets.length, 1)
  // Out of range is clamped, and a rate of zero or less is ignored.
  loop.setGain(7)
  loop.setRate(0)
  assert.equal(voiceOf(source).gain.targets.at(-1).target, 0.8)
  assert.equal(source.playbackRate.targets.length, 1)
})

test('a loop steered before its file arrived starts at the pitch it was given', async () => {
  const { engine, context } = setup()
  const loop = engine.createLoop('hum')
  loop.setRate(1.4)
  await settle()
  assert.equal(context.sources[0].playbackRate.value, 1.4)
})

test('stopping a loop fades it out, and a loop stopped while loading never starts', async () => {
  const playing = setup()
  const loop = playing.engine.createLoop('hum')
  await settle()
  loop.setGain(1)
  loop.stop()
  loop.setGain(1)
  const [source] = playing.context.sources
  assert.equal(voiceOf(source).gain.targets.at(-1).target, 0)
  assert.ok(source.stopAt > playing.context.currentTime)

  const early = setup()
  early.engine.createLoop('hum').stop()
  await settle()
  assert.equal(early.context.sources.length, 0)
})

test('a missing file is silent, not an error', async (t) => {
  t.mock.method(console, 'warn', () => {})
  const { engine, context } = setup({ failing: ['/audio/beep.mp3', '/audio/hum.flac'] })
  await engine.preload(['beep', 'hum'])
  engine.playOneShot('beep')
  const loop = engine.createLoop('hum')
  loop.setGain(1)
  loop.setRate(2)
  loop.stop()
  await settle()
  assert.equal(context.sources.length, 0)
  assert.equal(console.warn.mock.callCount(), 2)
})

test('an unknown sound and a browser with no Web Audio do nothing', async () => {
  const { engine, context } = setup()
  engine.playOneShot('nope')()
  engine.createLoop('nope').setGain(1)
  await settle()
  assert.equal(context.sources.length, 0)

  const none = createAudioEngine({ createContext: () => null, loadData: async () => null, bank: BANK, settings: DEFAULT_AUDIO_SETTINGS })
  none.playOneShot('beep')()
  none.createLoop('hum').stop()
  await none.preload(['beep'])
  assert.equal(none.state(), 'unavailable')
})

test('volume and mute move the master gain without a step', async () => {
  const { engine, context } = setup()
  await engine.preload(['beep'])
  const [master] = context.gains
  engine.applySettings({ volume: 0.5, muted: false })
  engine.applySettings({ volume: 0.5, muted: true })
  assert.deepEqual(
    master.gain.targets.map((entry) => entry.target),
    [0.25, 0],
  )
  assert.equal(master.gain.value, 1)
})

test('state changes reach subscribers', async () => {
  const { engine, context } = setup()
  let calls = 0
  const unsubscribe = engine.subscribe(() => {
    calls += 1
  })
  await engine.preload(['beep'])
  assert.equal(calls, 1)
  engine.suspend()
  await settle()
  assert.equal(engine.state(), 'suspended')
  assert.equal(calls, 2)
  unsubscribe()
  await context.resume()
  assert.equal(calls, 2)
})

// --- settings ------------------------------------------------------------------

test('stored settings are sanitised', () => {
  assert.deepEqual(resolveAudioSettings(null), { ...DEFAULT_AUDIO_SETTINGS })
  assert.deepEqual(resolveAudioSettings('loud'), { ...DEFAULT_AUDIO_SETTINGS })
  assert.deepEqual(resolveAudioSettings({ volume: 4, muted: 'yes' }), { volume: 1, muted: DEFAULT_AUDIO_SETTINGS.muted })
  assert.deepEqual(resolveAudioSettings({ volume: -1, muted: true }), { volume: 0, muted: true })
  assert.deepEqual(resolveAudioSettings({ volume: NaN }), { ...DEFAULT_AUDIO_SETTINGS })
})

test('the volume slider is squared, and mute is silence', () => {
  assert.equal(masterGain({ volume: 1, muted: false }), 1)
  assert.equal(masterGain({ volume: 0.5, muted: false }), 0.25)
  assert.equal(masterGain({ volume: 1, muted: true }), 0)
})

test('settings are saved under gearview_audio_v1 and survive unusable storage', () => {
  assert.deepEqual(getAudioSettings(), { ...DEFAULT_AUDIO_SETTINGS })
  setAudioSettings({ muted: true })
  assert.deepEqual(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY)), { volume: DEFAULT_AUDIO_SETTINGS.volume, muted: true })
  assert.equal(getAudioSettings().muted, true)

  const { setItem } = window.localStorage
  window.localStorage.setItem = () => {
    throw new Error('QuotaExceededError')
  }
  try {
    assert.deepEqual(setAudioSettings({ volume: 0.3 }), { volume: 0.3, muted: true })
    assert.equal(getAudioSettings().volume, 0.3)
  } finally {
    window.localStorage.setItem = setItem
  }
})

test('the debug snapshot shows what is loaded, looping and played', async () => {
  const { engine } = setup()
  assert.deepEqual(engine.debugSnapshot(), { state: 'idle', loaded: [], loops: [], played: [] })
  const loop = engine.createLoop('hum')
  await settle()
  loop.setGain(0.5)
  loop.setRate(1.2)
  await engine.preload(['beep'])
  engine.playOneShot('beep')
  assert.deepEqual(engine.debugSnapshot(), {
    state: 'running',
    loaded: ['hum', 'beep'],
    loops: [{ name: 'hum', gain: 0.4, rate: 1.2, playing: true }],
    played: ['beep'],
  })
  loop.stop()
  assert.deepEqual(engine.debugSnapshot().loops, [])
})
