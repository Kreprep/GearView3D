// Builds the app's sound files (public/audio/) from the recordings as
// downloaded (audio-src/raw/, not in the repo), with ffmpeg
// (docs/revisions/post-defense-plan.md, section 4.4, Phase 5).
//
//   node scripts/build-audio.mjs              # build every sound whose source is present
//   node scripts/build-audio.mjs horn denied  # build only these
//   node scripts/build-audio.mjs --check      # report, write nothing
//
// The sources are CC0 recordings from Freesound, credited in
// public/audio/CREDITS.md. Download each original (not the preview) into
// audio-src/raw/ and keep Freesound's file name, which starts with the sound's
// id: that id is how a source is found here.
//
// What is done to every sound: cut to the part listed below, mixed to mono,
// resampled to 44.1 kHz and levelled. A loop is also made to repeat without a
// gap and written as FLAC, because a lossy encoder pads the file and clicks
// at the loop point. A one-shot is faded at both ends and written as MP3.
//
// The cut points were chosen from the waveforms and then by ear. Change them
// here and re-run; nothing else in the app needs to know, except that
// data/soundBank.js records two things measured from the results: each engine
// loop's firing frequency, and when the start recording catches.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = join(FRONTEND, 'audio-src', 'raw')
const OUT_DIR = join(FRONTEND, 'public', 'audio')

const SAMPLE_RATE = 44100
// Levels, in dBFS. A loop is levelled by its average, since it plays for a
// long time under other sounds; a one-shot by its peak. Neither may peak
// above the ceiling.
const LOOP_MEAN_DB = -20
const ONE_SHOT_PEAK_DB = -3
const PEAK_CEILING_DB = -1
// The whole bank's size budget (plan, section 4.4).
const BUDGET_BYTES = 3 * 1024 * 1024

// `source` is the Freesound id. Times are seconds into the source.
//
// A loop takes `length` seconds from `start`. With `crossfade`, the
// `crossfade` seconds after that are faded out over the loop's own first
// `crossfade` seconds fading in, so the end runs into the start; the file
// stays `length` long. Without it the cut itself has to be seamless: a whole
// number of periods of a sound with silence between them.
//
// A one-shot takes `length` seconds from `start` (to the end of the source
// when `length` is omitted), with `fadeIn` / `fadeOut` seconds at the ends.
const SOUNDS = [
  // The forklift's steadiest stretch of idle (about 10.5 s to 21.5 s).
  { name: 'engine-idle', source: 571002, loop: true, start: 13, length: 4, crossfade: 0.5 },
  // Held revs, before the pitch starts to climb at about 25 s.
  { name: 'engine-high', source: 865228, loop: true, start: 21.3, length: 3, crossfade: 0.5 },
  // The starter turns at 2.24 s and the engine fires at about 2.7 s.
  { name: 'engine-start', source: 570979, start: 2.2, length: 2.6, fadeIn: 0.01, fadeOut: 1.3 },
  // Switched off at about 36.9 s, silent by 37.7 s.
  { name: 'engine-stop', source: 571002, start: 36.3, length: 1.8, fadeIn: 0.2, fadeOut: 0.1 },
  // Exactly one period of the beep (44,572 samples at 44.1 kHz), cut in the
  // quiet before it.
  { name: 'reverse-beeper', source: 196567, loop: true, start: 0, length: 1.0107 },
  // The long steady lift near the end of the recording (27.5 s to 34.3 s).
  { name: 'hydraulic-whine', source: 221925, loop: true, start: 29.5, length: 3, crossfade: 0.4 },
  // A shorter, higher-pitched stretch of the pump working.
  { name: 'relief-strain', source: 221925, loop: true, start: 14.6, length: 0.9, crossfade: 0.2 },
  // The first and busiest pull of the chain.
  { name: 'chain-rattle', source: 453383, loop: true, start: 3.2, length: 1.7, crossfade: 0.3 },
  // The second of the recording's two toots.
  { name: 'horn', source: 461679, start: 1.9, length: 0.55, fadeIn: 0.005, fadeOut: 0.1 },
  { name: 'parking-brake', source: 461678, start: 0.58, length: 0.75, fadeIn: 0.01, fadeOut: 0.1 },
  { name: 'seatbelt', source: 461675, start: 0.34, length: 0.65, fadeIn: 0.01, fadeOut: 0.1 },
  // The first of the two key turns.
  { name: 'key-click', source: 818298, start: 0.36, length: 0.4, fadeIn: 0.005, fadeOut: 0.1 },
  { name: 'denied', source: 803765, start: 0, fadeIn: 0.005, fadeOut: 0.05 },
  { name: 'caution-chime', source: 660863, start: 0, fadeIn: 0.005, fadeOut: 0.05 },
  { name: 'danger-alarm', source: 832414, start: 0, length: 1.6, fadeIn: 0.005, fadeOut: 0.4 },
  // Phase 7, the physics' sounds. The steadiest drag of the crowbar across
  // the concrete (6.75 s to 9.0 s).
  { name: 'fork-scrape', source: 452587, loop: true, start: 6.9, length: 1.5, crossfade: 0.3 },
]

const outputFile = (sound) => `${sound.name}.${sound.loop ? 'flac' : 'mp3'}`
const samples = (seconds) => Math.round(seconds * SAMPLE_RATE)

// Freesound names a download "<id>__<user>__<title>.<ext>".
function findSource(id) {
  if (!existsSync(RAW_DIR)) return null
  const file = readdirSync(RAW_DIR).find((entry) => entry.startsWith(`${id}_`) || entry.startsWith(`${id}.`))
  return file ? join(RAW_DIR, file) : null
}

// The filter graph that cuts and shapes one sound, ending in [shaped].
function shapeFilter(sound) {
  const mono = `[0:a]aformat=channel_layouts=mono,aresample=${SAMPLE_RATE}`
  const from = samples(sound.start)

  if (!sound.loop) {
    const end = sound.length ? `:end_sample=${from + samples(sound.length)}` : ''
    return [
      mono,
      `atrim=start_sample=${from}${end}`,
      'asetpts=PTS-STARTPTS',
      sound.fadeIn && `afade=t=in:d=${sound.fadeIn}`,
      // Reversed, a fade-in is a fade-out that needs no end time.
      sound.fadeOut && `areverse,afade=t=in:d=${sound.fadeOut},areverse`,
    ]
      .filter(Boolean)
      .join(',')
      .concat('[shaped]')
  }

  const length = samples(sound.length)
  if (!sound.crossfade) {
    return `${mono},atrim=start_sample=${from}:end_sample=${from + length},asetpts=PTS-STARTPTS[shaped]`
  }

  // The file is the body [crossfade, length), then a seam: the tail
  // [length, length + crossfade) fading out under the head [0, crossfade)
  // fading in. The seam ends where the body begins, so the file repeats
  // without a step. Equal-power curves, because the two ends are not in phase.
  const fade = samples(sound.crossfade)
  return [
    `${mono},atrim=start_sample=${from}:end_sample=${from + length + fade},asetpts=PTS-STARTPTS,asplit=3[h][b][t]`,
    `[h]atrim=end_sample=${fade},afade=t=in:d=${sound.crossfade}:curve=qsin[head]`,
    `[t]atrim=start_sample=${length},asetpts=PTS-STARTPTS,afade=t=out:d=${sound.crossfade}:curve=qsin[tail]`,
    `[head][tail]amix=inputs=2:normalize=0[seam]`,
    `[b]atrim=start_sample=${fade}:end_sample=${length},asetpts=PTS-STARTPTS[body]`,
    `[body][seam]concat=n=2:v=0:a=1[shaped]`,
  ].join(';')
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: 'utf8' })
  if (result.error) throw new Error(`ffmpeg could not be run (${result.error.message}). Install it: winget install Gyan.FFmpeg`)
  if (result.status !== 0) throw new Error(result.stderr.trim().split('\n').slice(-3).join('\n'))
  // ffmpeg reports on stderr, including what volumedetect measured.
  return result.stderr
}

// The shaped sound's average and peak level, in dBFS.
function measure(source, shape) {
  const report = ffmpeg(['-i', source, '-filter_complex', `${shape};[shaped]volumedetect[out]`, '-map', '[out]', '-f', 'null', '-'])
  const read = (label) => Number(report.match(new RegExp(`${label}: (-?[\\d.]+) dB`))?.[1])
  return { mean: read('mean_volume'), peak: read('max_volume') }
}

function build(sound, source, { check }) {
  const shape = shapeFilter(sound)
  const { mean, peak } = measure(source, shape)
  if (!Number.isFinite(mean) || !Number.isFinite(peak)) throw new Error('nothing to measure: is the cut inside the recording?')
  const wanted = sound.loop ? LOOP_MEAN_DB - mean : ONE_SHOT_PEAK_DB - peak
  const gain = Math.min(wanted, PEAK_CEILING_DB - peak)
  const summary = `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB (was mean ${mean}, peak ${peak})`
  if (check) return summary

  const codec = sound.loop
    ? ['-c:a', 'flac', '-sample_fmt', 's16', '-compression_level', '12']
    : ['-c:a', 'libmp3lame', '-q:a', '4']
  const out = join(OUT_DIR, outputFile(sound))
  ffmpeg([
    '-i', source,
    '-filter_complex', `${shape};[shaped]volume=${gain.toFixed(2)}dB[out]`,
    '-map', '[out]',
    '-ar', String(SAMPLE_RATE), '-ac', '1',
    // No tags: the credits are in CREDITS.md, and a cover image would be dead weight.
    '-map_metadata', '-1', '-bitexact',
    ...codec,
    out,
  ])
  return `${summary}, ${(statSync(out).size / 1024).toFixed(0)} KB`
}

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const only = args.filter((arg) => !arg.startsWith('--'))
  const unknown = only.filter((name) => !SOUNDS.some((sound) => sound.name === name))
  if (unknown.length) {
    console.error(`No such sound: ${unknown.join(', ')}. Known: ${SOUNDS.map((sound) => sound.name).join(', ')}`)
    process.exit(1)
  }
  if (!check) mkdirSync(OUT_DIR, { recursive: true })

  let failed = false
  const missing = []
  for (const sound of SOUNDS.filter((entry) => !only.length || only.includes(entry.name))) {
    const source = findSource(sound.source)
    if (!source) {
      missing.push(`${outputFile(sound)} (Freesound ${sound.source})`)
      continue
    }
    try {
      console.log(`${outputFile(sound).padEnd(22)} ${build(sound, source, { check })}`)
    } catch (error) {
      failed = true
      console.error(`${outputFile(sound).padEnd(22)} FAILED: ${error.message}`)
    }
  }

  if (missing.length) console.warn(`\nNo source in audio-src/raw/ for:\n  ${missing.join('\n  ')}`)

  if (existsSync(OUT_DIR)) {
    const shipped = SOUNDS.map(outputFile).filter((file) => existsSync(join(OUT_DIR, file)))
    const total = shipped.reduce((sum, file) => sum + statSync(join(OUT_DIR, file)).size, 0)
    console.log(`\n${shipped.length} of ${SOUNDS.length} sounds in public/audio/, ${(total / 1024 / 1024).toFixed(2)} MB of a ${BUDGET_BYTES / 1024 / 1024} MB budget.`)
    if (total > BUDGET_BYTES) {
      failed = true
      console.error('Over budget: shorten the loops or drop their sample rate.')
    }
  }
  process.exit(failed ? 1 : 0)
}

main()
