import { translate } from '../i18n/translate.js'

// How an equipment drives in DrivingSimulationViewer.
//
// Every value here is a *default*, measured from forklift.glb. `Equipment.
// simConfig` stores only what an admin overrode, the same rule as the hub copy
// in hubContent.js, so improving a default still reaches every equipment that
// never touched it.
//
// A model with none of the rig nodes below still drives - the rig builder
// skips what it cannot find, so the vehicle moves, steers and collides as one
// solid body, just without spinning wheels or a moving mast.

export const DEFAULT_VEHICLE_MODEL_URL = '/models/forklift.glb'

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

// Node names the rig builder looks for in the GLB, plus the world-space mast
// foot the tilt pivot sits on.
export const DEFAULT_RIG = {
  wheels: { FL: 'Wheel_FL', FR: 'Wheel_FR', RL: 'Wheel_RL', RR: 'Wheel_RR' },
  mast: 'Mast',
  carriage: 'Lift_Carriage',
  mastFoot: [0, 0.024, 0.246],
  // Approximate operator eye point, local to the vehicle (x: side, y: up, z:
  // forward) - what the first-person camera sits at. Tune per equipment in
  // the Vehicle Profile editor if a model's cab sits somewhere else.
  cabin: { seatOffset: [0, 0.40, -0.15] },
}

// The HUD key legend. `forks: true` on a row means it is only shown when the
// vehicle actually has forks.
export function defaultKeyLegend(lang) {
  return [
    { key: 'w', caption: translate(lang, 'driving.key.accelerate') },
    { key: 'a', caption: translate(lang, 'driving.key.steerLeft') },
    { key: 's', caption: translate(lang, 'driving.key.brake') },
    { key: 'd', caption: translate(lang, 'driving.key.steerRight') },
    { key: 'e', caption: translate(lang, 'driving.key.engine') },
    { key: 'r', caption: translate(lang, 'driving.key.raiseForks'), forks: true },
    { key: 'f', caption: translate(lang, 'driving.key.lowerForks'), forks: true },
    { key: 't', caption: translate(lang, 'driving.key.tiltBack'), forks: true },
    { key: 'g', caption: translate(lang, 'driving.key.tiltForward'), forks: true },
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
    'load-tipping': {
      title: translate(lang, 'driving.fail.loadTipping.title'),
      message: translate(lang, 'driving.fail.loadTipping.message'),
    },
    'high-travel': {
      title: translate(lang, 'driving.fail.highTravel.title'),
      message: translate(lang, 'driving.fail.highTravel.message'),
    },
  }
}

export function defaultVehicleProfile(lang) {
  return {
    // Blank means "use the equipment's own modelUrl, then forklift.glb".
    modelUrl: '',
    // The model dropped in as a parked obstacle on a course.
    parkedModelUrl: '',
    hasForks: true,
    footprint: { ...DEFAULT_FOOTPRINT },
    rig: { ...DEFAULT_RIG, wheels: { ...DEFAULT_RIG.wheels } },
    keyLegend: defaultKeyLegend(lang),
    failMessages: defaultFailMessages(lang),
  }
}
