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
  cabin: { seatOffset: [0, 0.40, -0.05] },
}

// The HUD key legend. `forks: true` on a row means it is only shown when the
// vehicle actually has forks.
export const DEFAULT_KEY_LEGEND = [
  { key: 'w', caption: 'Accelerate' },
  { key: 'a', caption: 'Steer Left' },
  { key: 's', caption: 'Brake' },
  { key: 'd', caption: 'Steer Right' },
  { key: 'e', caption: 'Engine' },
  { key: 'r', caption: 'Raise Forks', forks: true },
  { key: 'f', caption: 'Lower Forks', forks: true },
  { key: 't', caption: 'Tilt Mast Back', forks: true },
  { key: 'g', caption: 'Tilt Mast Forward', forks: true },
]

export const DEFAULT_FAIL_MESSAGES = {
  cone: {
    title: 'Cone Struck',
    message: 'You hit a traffic cone. Treat cones as people or racking - reset the attempt and keep the lane clear.',
  },
  wall: {
    title: 'Wall Struck',
    message: 'You hit a wall or racking upright. Keep clear of structures while driving - reset the attempt and watch your clearance.',
  },
  vehicle: {
    title: 'Vehicle Struck',
    message: 'You clipped a parked vehicle. Ease in slowly and keep clearance on both sides - reset the attempt and try again.',
  },
  rack: {
    title: 'Racking Struck',
    message: 'You drove the truck body into the racking. Only the forks belong inside a bay - stop square in front of the rack and let the forks do the reaching.',
  },
  overload: {
    title: 'Tip-Over: Overloaded',
    message: 'That pallet exceeds the rated capacity, so the vehicle tipped forward. Reset and choose a load within capacity.',
  },
  'load-dropped': {
    title: 'Load Thrown Off',
    message: 'Braking hard at speed threw the pallet off the forks. A load only rides out a hard stop when the forks are all the way in and the mast is tilted back - reset, seat the forks fully, and brake gently while loaded.',
  },
  'load-slipped': {
    title: 'Load Slipped Off',
    message: 'Turning sharply at speed shook the pallet off the forks. Reset, drive the forks fully into the pallet, tilt the mast back, and take corners slowly with a load.',
  },
  'unsecured-load': {
    title: 'Unsecured Load',
    message: 'You travelled with the mast upright or tilted forward, and the pallet worked its way off the forks. Reset, and tilt the mast back with T before moving a raised load.',
  },
  'load-tipping': {
    title: 'Tip-Over: Load Too Far Forward',
    message: 'Tilting a heavy load forward that high moved the centre of gravity past the front wheels. Reset, and only tilt forward once the forks are down at the shelf you are setting the load on.',
  },
  'high-travel': {
    title: 'Unsafe Travel Height',
    message: 'You drove at speed with the forks raised above the standard travel height. Reset, and lower the forks close to the ground before moving with a load.',
  },
}

export function defaultVehicleProfile() {
  return {
    // Blank means "use the equipment's own modelUrl, then forklift.glb".
    modelUrl: '',
    // The model dropped in as a parked obstacle on a course.
    parkedModelUrl: '',
    hasForks: true,
    footprint: { ...DEFAULT_FOOTPRINT },
    rig: { ...DEFAULT_RIG, wheels: { ...DEFAULT_RIG.wheels } },
    keyLegend: DEFAULT_KEY_LEGEND.map((entry) => ({ ...entry })),
    failMessages: Object.fromEntries(
      Object.entries(DEFAULT_FAIL_MESSAGES).map(([key, value]) => [key, { ...value }]),
    ),
  }
}
