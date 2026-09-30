import { translate } from '../i18n/translate.js'

// How the forklift drives in DrivingSimulationViewer.
//
// Every value here is a *default*, measured from forklift.glb
// (EQUIPMENT_MODEL_URL in equipment.js). `Equipment.simConfig` stores only the
// body footprint and first-person seat an admin overrode, the same rule as the
// hub copy in hubContent.js, so improving a default still reaches a row that
// never touched it.

// Half-extents of the body used for cone, wall, rack and pallet collision, in
// metres, along the vehicle's local X (width) and Z (length).
//
// This is the *body*, not the whole model: forklift.glb's chassis and wheels
// span z -0.284 to +0.278 and x +/-0.142, while its mast and forks reach out
// to z +0.606 ahead of them. Measuring the whole bounding box instead put the
// front of the rectangle 0.16 out in the empty air the forks occupy, which
// stopped - and failed - the truck against racking it had not reached, and
// left the tines short of the bay they were supposed to reach into.
export const DEFAULT_FOOTPRINT = { halfWidth: 0.15, halfLength: 0.29 }

// What the stability model (lib/physics/stability.js) and the load chart
// (lib/physics/loadChart.js) know about the truck, in kilograms and metres.
// The reference truck is the Toyota 8FGU25 (docs/revisions/
// post-defense-plan.md, section 2): its figures are from public spec
// listings, and the rest are GearView defaults, marked.
export const STABILITY_DEFAULTS = {
  serviceWeightKg: 3560, // 8FGU25 (public listing)
  ratedCapacityKg: 2270, // 8FGU25: 5,000 lb
  ratedLoadCentre: 0.61, // 8FGU25: 24 in
  wheelbase: 1.65, // 8FGU25 (public listing)
  // Front axle to the fork face, and the front track: measured off
  // forklift.glb (0.113 and 0.238 scene units).
  frontOverhang: 0.45,
  frontTrack: 0.95,
  // The unladen centre of gravity's height is not published. GearView
  // default: low, as a counterbalance truck's is (counterweight, engine and
  // drive axle), and chosen so an unladen truck swerved as hard as the
  // keyboard steers at top speed stays on its wheels with a reserve.
  cgHeight: 0.45,
  // What the rating is taken to guarantee (GearView defaults): the rated
  // load, carried with its centre of gravity this high, held with this
  // reserve under this much braking, in g. 0.25 g is service braking.
  travelLoadHeight: 0.6,
  ratingDecel: 0.25,
  ratingReserve: 1.1,
}

// Node names the rig builder looks for in the GLB, plus the world-space mast
// foot the tilt pivot sits on.
export const DEFAULT_RIG = {
  wheels: { FL: 'Wheel_FL', FR: 'Wheel_FR', RL: 'Wheel_RL', RR: 'Wheel_RR' },
  mast: 'Mast',
  carriage: 'Lift_Carriage',
  mastFoot: [0, 0.024, 0.246],
  // The steering wheel, split out of Forklift_Body by
  // scripts/split-steering-wheel.mjs. It turns about the ring's normal (the
  // column's axis, tilted 28 degrees toward the seat) through the ring's
  // centre. Measured in Blender on 2026-09-30.
  steeringWheel: { node: 'Steering_Wheel', centre: [0, 0.3197, 0.0672], axis: [0, 0.8804, -0.4743] },
  // The hydraulic levers to the operator's right, innermost first: lift, then
  // tilt (Lever_R, an attachment lever, has nothing to drive). Each rocks
  // fore and aft about the model's X axis through the base of its stem.
  levers: {
    lift: { node: 'Lever_L', base: [-0.049, 0.2672, 0.1302] },
    tilt: { node: 'Lever_M', base: [-0.0639, 0.2672, 0.1302] },
  },
  // The operator's eye point, local to the vehicle (x: side, y: up, z:
  // forward) - what the first-person camera sits at. Tunable in the Driving
  // Simulation section of Equipment Settings. Measured in Blender on
  // 2026-09-30: the backrest's front face is at z -0.165 and the steering
  // wheel's centre at z +0.067, so z -0.10 puts the eyes about 26 cm in
  // front of the backrest, where an upright seated operator's are (it was
  // -0.15, inside the head). The height is the original estimate.
  cabin: { seatOffset: [0, 0.40, -0.10] },
}

// The HUD key legend.
export function defaultKeyLegend(lang) {
  return [
    { key: 'w', caption: translate(lang, 'driving.key.accelerate') },
    { key: 'a', caption: translate(lang, 'driving.key.steerLeft') },
    { key: 's', caption: translate(lang, 'driving.key.brake') },
    { key: 'd', caption: translate(lang, 'driving.key.steerRight') },
    { key: 'e', caption: translate(lang, 'driving.key.engine') },
    { key: 'r', caption: translate(lang, 'driving.key.raiseForks') },
    { key: 'f', caption: translate(lang, 'driving.key.lowerForks') },
    { key: 't', caption: translate(lang, 'driving.key.tiltBack') },
    { key: 'g', caption: translate(lang, 'driving.key.tiltForward') },
  ]
}

export function defaultFailMessages(lang) {
  return {
    cone: {
      title: translate(lang, 'driving.fail.cone.title'),
      message: translate(lang, 'driving.fail.cone.message'),
    },
    wall: {
      title: translate(lang, 'driving.fail.wall.title'),
      message: translate(lang, 'driving.fail.wall.message'),
    },
    vehicle: {
      title: translate(lang, 'driving.fail.vehicle.title'),
      message: translate(lang, 'driving.fail.vehicle.message'),
    },
    rack: {
      title: translate(lang, 'driving.fail.rack.title'),
      message: translate(lang, 'driving.fail.rack.message'),
    },
    overload: {
      title: translate(lang, 'driving.fail.overload.title'),
      message: translate(lang, 'driving.fail.overload.message'),
    },
    'load-dropped': {
      title: translate(lang, 'driving.fail.loadDropped.title'),
      message: translate(lang, 'driving.fail.loadDropped.message'),
    },
    'load-slipped': {
      title: translate(lang, 'driving.fail.loadSlipped.title'),
      message: translate(lang, 'driving.fail.loadSlipped.message'),
    },
    'unsecured-load': {
      title: translate(lang, 'driving.fail.unsecuredLoad.title'),
      message: translate(lang, 'driving.fail.unsecuredLoad.message'),
    },
    'tip-over': {
      title: translate(lang, 'driving.fail.tipOver.title'),
      message: translate(lang, 'driving.fail.tipOver.message'),
    },
    'pallet-impact': {
      title: translate(lang, 'driving.fail.palletImpact.title'),
      message: translate(lang, 'driving.fail.palletImpact.message'),
    },
    'high-travel': {
      title: translate(lang, 'driving.fail.highTravel.title'),
      message: translate(lang, 'driving.fail.highTravel.message'),
    },
  }
}

export function defaultVehicleProfile(lang) {
  return {
    footprint: { ...DEFAULT_FOOTPRINT },
    rig: { ...DEFAULT_RIG, wheels: { ...DEFAULT_RIG.wheels } },
    keyLegend: defaultKeyLegend(lang),
    failMessages: defaultFailMessages(lang),
  }
}
