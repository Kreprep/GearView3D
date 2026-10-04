// Builds the defect library's decal textures (public/textures/defects/) from
// CC0 texture sets as downloaded from ambientCG (textures-src/raw/, not in
// the repo), with ffmpeg (docs/modules/module-improvements-plan.md, section
// 3.4, Phase 4). data/defectLibrary.js names them (DECAL_TEXTURES) and the
// walk-around viewer projects them onto the model.
//
//   node scripts/build-decals.mjs              # build every decal whose sources are present
//   node scripts/build-decals.mjs crack frost  # build only these
//   node scripts/build-decals.mjs --check      # report, write nothing
//
// The sources are credited in public/textures/defects/CREDITS.md. Download
// each set's 1K-PNG zip from https://ambientcg.com/view?id=<asset> and unzip
// it into textures-src/raw/<asset>/, keeping ambientCG's file names.
//
// Every decal is a PNG with an alpha channel, small (a decal covers a few
// centimetres of the truck), cut from its source as listed below. The crop
// boxes are pixels of the 1K maps, picked by eye.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = join(FRONTEND, 'textures-src', 'raw')
const OUT_DIR = join(FRONTEND, 'public', 'textures', 'defects')

const map = (asset, kind) => join(RAW_DIR, asset, `${asset}_1K-PNG_${kind}.png`)

// Each decal: its ffmpeg inputs and the filter graph that ends in [out].
const DECALS = [
  {
    // The thin branching crack at the top left of the asphalt damage atlas,
    // as near-black: a hairline split in painted steel.
    name: 'crack',
    inputs: [map('AsphaltDamageSet001', 'Opacity')],
    filter: '[0:v]crop=280:130:20:290,scale=256:128,format=gray[a];color=c=0x15110e:s=256x128,format=rgb24[c];[c][a]alphamerge,format=rgba[out]',
  },
  {
    // A small ragged pothole from the same atlas as the shape of the gouge,
    // filled with rubber lightened to the grey of a fresh tear: a chunk torn
    // out of the black tread.
    name: 'tread-chunk',
    inputs: [map('AsphaltDamageSet001', 'Opacity'), map('Rubber001', 'Color')],
    filter: '[0:v]crop=80:85:160:400,scale=128:128,format=gray[a];[1:v]crop=256:256:0:0,scale=128:128,eq=brightness=0.3:contrast=1.2,format=rgb24[c];[c][a]alphamerge,format=rgba[out]',
  },
  {
    // A fluid trickle (a 256 x 1024 map), darkened to wet hydraulic oil.
    name: 'wet',
    inputs: [map('Leaking006', 'Color'), map('Leaking006', 'Opacity')],
    filter: '[0:v]scale=64:256,eq=brightness=-0.22:saturation=1.4,format=rgb24[c];[1:v]scale=64:256,format=gray[a];[c][a]alphamerge,format=rgba[out]',
  },
  {
    // Ice crystals, pale and faded out to the edge: frost where expanding
    // LPG chills the fitting.
    name: 'frost',
    inputs: [map('Ice001', 'Color')],
    filter:
      "[0:v]crop=512:512:256:256,scale=128:128,hue=s=0.25,eq=brightness=0.2,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*pow(max(0,1-hypot(X-W/2,Y-H/2)/(W/2)),0.7)*(0.45+0.55*r(X,Y)/255)'[out]",
  },
  {
    // An empty bolt hole: a dark hole, a ring of bright bare steel where the
    // washer sat, and rust round it fading into the paint.
    name: 'bolt-hole',
    inputs: [map('Rust001', 'Color')],
    filter:
      // Rust001's map is 1024 x 256, solid rust along its bottom edge.
      "[0:v]crop=48:48:120:200,scale=64:64,format=rgba,geq=" +
      "r='if(lt(hypot(X-32,Y-32),12),14,if(lt(hypot(X-32,Y-32),17),150,r(X,Y)))':" +
      "g='if(lt(hypot(X-32,Y-32),12),12,if(lt(hypot(X-32,Y-32),17),148,g(X,Y)))':" +
      "b='if(lt(hypot(X-32,Y-32),12),11,if(lt(hypot(X-32,Y-32),17),142,b(X,Y)))':" +
      "a='255*min(1,max(0,(30-hypot(X-32,Y-32))/8))'[out]",
  },
]

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
  if (result.error) throw new Error(`ffmpeg could not be run (${result.error.message}). Install it: winget install Gyan.FFmpeg`)
  if (result.status !== 0) throw new Error(result.stderr)
}

function main() {
  const check = process.argv.includes('--check')
  const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const wanted = only.length ? DECALS.filter((decal) => only.includes(decal.name)) : DECALS
  if (!check) mkdirSync(OUT_DIR, { recursive: true })
  for (const decal of wanted) {
    const missing = decal.inputs.filter((input) => !existsSync(input))
    if (missing.length) {
      console.log(`${decal.name}: skipped, missing ${missing.join(', ')}`)
      continue
    }
    const out = join(OUT_DIR, `${decal.name}.png`)
    if (check) {
      console.log(`${decal.name}: sources present`)
      continue
    }
    ffmpeg([...decal.inputs.flatMap((input) => ['-i', input]), '-filter_complex', decal.filter, '-map', '[out]', '-frames:v', '1', out])
    console.log(`${decal.name}: ${statSync(out).size} bytes`)
  }
}

main()
