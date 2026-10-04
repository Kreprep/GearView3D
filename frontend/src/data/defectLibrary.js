// The defect library of the Defect Recognition Test (docs/modules/
// module-improvements-plan.md, section 3.4): every defect a scenario can put
// on the forklift, and how it shows. Code-owned, like data/soundBank.js,
// because each entry is a recipe the viewers interpret rather than content an
// admin writes. Pure and backend-importable: the server checks a scenario's
// defect ids against it on save.
//
// An entry:
//   label       admin-facing name (the scenario editor's picker). Never shown
//               to a learner, so it cannot give an answer away.
//   view        'exterior' (the walk-around viewer, components/
//               HotspotViewer.jsx) or 'cab' (the cab, components/inspection/
//               CabInspectionViewer.jsx). A scenario's defects all share its
//               view.
//   hotspotId   the walk-around part it is on: the stock answer to a
//               "locate" question, and the part named in feedback. Null for
//               a defect with no part to point at.
//   visual      exterior recipe steps, each a `kind` from VISUAL_KINDS with
//               that kind's fields, in the model's own frame (glTF axes,
//               model units, the same frame as the hotspot positions). The
//               positions were measured off forklift.glb in Blender on
//               2026-10-05.
//   sounds      what it sounds like: { loop, while } plays a sound-bank loop
//               while 'shown' (the scenario is on screen), 'engine' (it runs)
//               or 'braking' (the service brake is on with the truck
//               moving); { replace, with } plays `with` instead of the
//               sound-bank sample `replace`.
//   cab         cab effects: `instrumentFaults` ({ [instrumentId]: fault },
//               lib/inspection/instruments.js; view-side), `controlFaults`
//               (lib/driving/controlFaults.js; in the simulation core) and
//               `switchFaults` ({ [cabSwitch]: 'springs-back' }, lib/driving/
//               dashboardSource.js; a switch that will not stay on).

import { mps } from '../lib/driving/units.js'

const deg = (degrees) => (degrees * Math.PI) / 180

export const DEFECT_VIEWS = ['exterior', 'cab']

// The recipe kinds HotspotViewer's DefectEffects knows how to draw.
//   deflate-wheel { wheel, amount }        squash a wheel about its contact
//                                          patch (amount: share of the radius)
//                                          and drop that corner of the truck
//   roll-carriage { side, angle }          the carriage hangs low on `side`
//   slack-chain   { side, sag }            one lift chain bows out
//   tilt-mast     { angle }                the mast held tilted forward
//   bend-fork     { side, angle }          one tine droops from its heel
//                                          (needs the Fork_L / Fork_R split,
//                                          scripts/split-parts.mjs)
//   bend-bar      { node, sag }            a split-out guard bar sags
//   decal         { node, texture, position, normal, size, spin }
//                                          a CC0 texture projected onto a part
//                                          (public/textures/defects/)
//   puddle        { fluid, position, radius }   on the floor, position [x, z]
//   drip          { fluid, position }      drops falling from a point
//   vapour        { position }             an LPG plume from a point
export const VISUAL_KINDS = ['deflate-wheel', 'roll-carriage', 'slack-chain', 'tilt-mast', 'bend-fork', 'bend-bar', 'decal', 'puddle', 'drip', 'vapour']

// Decal textures, by the name a decal step gives (file in
// public/textures/defects/, credited in CREDITS.md there).
export const DECAL_TEXTURES = ['crack', 'tread-chunk', 'bolt-hole', 'wet', 'frost']

// How each fluid looks on the floor and as drops.
export const FLUIDS = {
  oil: { color: '#14100c', opacity: 0.82 },
  hydraulic: { color: '#a8741a', opacity: 0.7 },
  coolant: { color: '#3fae4a', opacity: 0.65 },
}

export const SOUND_WHILE = ['shown', 'engine', 'braking']

// Lift chain nodes by side, as forklift.glb names them (Ropes holds the right
// chain's mesh, RopeL the left's). Left and right are the operator's: +X.
export const CHAIN_NODES = { L: 'mesh_1', R: 'mesh_0' }
export const FORK_NODES = { L: 'Fork_L', R: 'Fork_R' }
export const GUARD_BAR_NODE = 'Guard_Slat'

export const DEFECT_LIBRARY = {
  // --- Exterior -----------------------------------------------------------
  'engine-oil-leak': {
    label: 'Engine oil leak',
    view: 'exterior',
    hotspotId: 'ground-leaks',
    visual: [
      // Spread out from under the engine, past the side of the body.
      { kind: 'puddle', fluid: 'oil', position: [0.07, -0.05], radius: 0.11 },
      { kind: 'drip', fluid: 'oil', position: [0.05, 0.045, -0.06] },
    ],
  },
  'hydraulic-hose-leak': {
    label: 'Hydraulic hose leak',
    view: 'exterior',
    hotspotId: 'hydraulic-hoses',
    visual: [
      { kind: 'decal', node: 'Mast', texture: 'wet', position: [0.065, 0.2, 0.27], normal: [1, 0, 0], size: [0.03, 0.12] },
      { kind: 'drip', fluid: 'hydraulic', position: [0.066, 0.06, 0.27] },
      { kind: 'puddle', fluid: 'hydraulic', position: [0.06, 0.27], radius: 0.05 },
    ],
  },
  'coolant-leak': {
    label: 'Coolant leak',
    view: 'exterior',
    hotspotId: 'ground-leaks',
    visual: [
      { kind: 'puddle', fluid: 'coolant', position: [0.03, -0.26], radius: 0.085 },
      { kind: 'drip', fluid: 'coolant', position: [0.03, 0.045, -0.24] },
    ],
  },
  'flat-front-tyre': {
    label: 'Flat front tyre',
    view: 'exterior',
    hotspotId: 'tires',
    visual: [{ kind: 'deflate-wheel', wheel: 'FL', amount: 0.28 }],
  },
  'tyre-chunking': {
    label: 'Damaged tyre (chunks missing from the tread)',
    view: 'exterior',
    hotspotId: 'tires',
    visual: [{ kind: 'decal', node: 'Wheel_FL', texture: 'tread-chunk', position: [0.128, 0.132, 0.249], normal: [0, 0.707, 0.707], size: [0.03, 0.035] }],
  },
  'bent-fork-tip': {
    label: 'Bent fork tip',
    view: 'exterior',
    hotspotId: 'forks',
    visual: [{ kind: 'bend-fork', side: 'L', angle: deg(4) }],
  },
  'fork-heel-crack': {
    label: 'Crack at the fork heel',
    view: 'exterior',
    hotspotId: 'forks',
    visual: [{ kind: 'decal', node: 'Fork_L', texture: 'crack', position: [0.0835, 0.03, 0.312], normal: [1, 0, 0], size: [0.03, 0.03], spin: deg(40) }],
  },
  'mast-channel-crack': {
    label: 'Crack in a mast channel',
    view: 'exterior',
    hotspotId: 'mast',
    visual: [{ kind: 'decal', node: 'Mast', texture: 'crack', position: [0.07, 0.32, 0.269], normal: [1, 0, 0], size: [0.035, 0.05], spin: deg(-20) }],
  },
  'uneven-lift-chains': {
    label: 'Uneven lift chains (one slack, carriage hanging low)',
    view: 'exterior',
    hotspotId: 'lift-chain',
    visual: [
      { kind: 'roll-carriage', side: 'L', angle: deg(3) },
      { kind: 'slack-chain', side: 'L', sag: 0.012 },
    ],
  },
  'mast-stuck-tilted': {
    label: 'Mast stuck tilted forward',
    view: 'exterior',
    hotspotId: 'mast',
    visual: [{ kind: 'tilt-mast', angle: deg(6) }],
  },
  'lpg-leak': {
    label: 'LPG leak at the tank fitting',
    view: 'exterior',
    hotspotId: 'lpg-tank',
    visual: [
      { kind: 'vapour', position: [0.082, 0.31, -0.2] },
      { kind: 'decal', node: 'Forklift_Body', texture: 'frost', position: [0.05, 0.345, -0.2], normal: [0, 1, 0], size: [0.04, 0.04] },
    ],
    sounds: [{ loop: 'lpgHiss', while: 'shown' }],
  },
  'missing-counterweight-bolt': {
    label: 'Missing counterweight bolt',
    view: 'exterior',
    hotspotId: 'counterweight',
    visual: [{ kind: 'decal', node: 'Forklift_Body', texture: 'bolt-hole', position: [0.085, 0.2, -0.283], normal: [0, 0, -1], size: [0.018, 0.018] }],
  },
  'missing-guard-bolt': {
    label: 'Missing bolt on the overhead guard',
    view: 'exterior',
    hotspotId: 'overhead-guard',
    visual: [{ kind: 'decal', node: 'Forklift_Body', texture: 'bolt-hole', position: [0.1, 0.4878, 0.055], normal: [0, 1, 0], size: [0.012, 0.012] }],
  },
  'bent-guard-bar': {
    label: 'Bent overhead-guard bar',
    view: 'exterior',
    hotspotId: 'overhead-guard',
    visual: [{ kind: 'bend-bar', node: GUARD_BAR_NODE, sag: 0.014 }],
  },

  // --- Cab ----------------------------------------------------------------
  'seatbelt-wont-latch': {
    label: 'Seat belt will not latch',
    view: 'cab',
    hotspotId: 'seat-belt',
    cab: { switchFaults: { seatbelt: 'springs-back' }, instrumentFaults: { 'lamp.seatbelt': { lamp: 'stays-lit' } } },
  },
  'charge-lamp-lit': {
    label: 'Charge warning lamp stays lit',
    view: 'cab',
    hotspotId: 'dashboard',
    cab: { instrumentFaults: { 'lamp.charge': { lamp: 'stays-lit' } } },
  },
  'engine-overheating': {
    label: 'Engine overheating',
    view: 'cab',
    hotspotId: 'dashboard',
    cab: { instrumentFaults: { 'gauge.temp': { value: 0.97, after: 'start', rampS: 15, alarmAbove: 0.85 } } },
  },
  'horn-not-working': {
    label: 'Horn not working',
    view: 'cab',
    hotspotId: 'horn',
    sounds: [{ replace: 'horn', with: 'hornClick' }],
  },
  'brake-fade': {
    label: 'Brakes fade (twice the stopping distance)',
    view: 'cab',
    hotspotId: 'brakes',
    cab: { controlFaults: { brakeFade: 0.5 } },
    sounds: [{ loop: 'brakeGrind', while: 'braking' }],
  },
  'steering-play': {
    label: 'Excess steering play',
    view: 'cab',
    hotspotId: 'steering-response',
    cab: { controlFaults: { steeringPlay: deg(30) } },
  },
  'forks-drift-down': {
    label: 'Forks drift down',
    view: 'cab',
    hotspotId: 'lift-tilt-functions',
    // A raised carriage visibly sinks within seconds.
    cab: { controlFaults: { liftDrift: mps(0.03) } },
  },
  'engine-knocking': {
    label: 'Engine knocking',
    view: 'cab',
    hotspotId: null,
    sounds: [{ loop: 'engineKnock', while: 'engine' }],
  },
}

export const DEFECT_IDS = Object.keys(DEFECT_LIBRARY)

export const defectsForView = (view) => DEFECT_IDS.filter((id) => DEFECT_LIBRARY[id].view === view)

// The library entries for a list of ids, unknown ids left out.
export const resolveDefects = (ids = []) => ids.map((id) => DEFECT_LIBRARY[id]).filter(Boolean)

// Everything a cab scenario's defects do in the cab, merged: instrument
// faults, control faults and switch faults (later entries win on a clash) and
// every sound rule.
export function cabEffects(ids = []) {
  const effects = { instrumentFaults: {}, controlFaults: {}, switchFaults: {}, sounds: [] }
  for (const defect of resolveDefects(ids)) {
    Object.assign(effects.instrumentFaults, defect.cab?.instrumentFaults)
    Object.assign(effects.controlFaults, defect.cab?.controlFaults)
    Object.assign(effects.switchFaults, defect.cab?.switchFaults)
    effects.sounds.push(...(defect.sounds || []))
  }
  return effects
}

// Every exterior recipe step and sound rule of a scenario's defects.
export function exteriorEffects(ids = []) {
  const defects = resolveDefects(ids)
  return {
    visual: defects.flatMap((defect) => defect.visual || []),
    sounds: defects.flatMap((defect) => defect.sounds || []),
  }
}

// The sound-bank names a set of sound rules plays.
export const defectSoundNames = (sounds = []) => [...new Set(sounds.map((rule) => rule.loop || rule.with).filter(Boolean))]
