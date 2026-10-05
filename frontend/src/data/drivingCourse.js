// Ground-plane coordinates for the driving simulation's stock courses.
// Checkpoints are simple radius/speed checks (or line-crossing checks) used to
// gate step completion. Everything placed below is solid: pallets and cones
// are bodies in the physics world (lib/physics/world.js), and racking, walls
// and parked forklifts are fixed in it.
// Facing +Z at heading 0, pressing D (steer right) turns the forklift toward
// -X and pressing A (steer left) turns it toward +X - so "right gate" style
// checkpoints sit on the -X side of the course and "left gate" ones on +X.

// The cone-layout helpers live in lib/courseGenerators.js so the admin course
// editor's insert tools produce identical layouts.
import {
  coneBay,
  coneBox,
  coneLine,
  corridorCones,
  slalomCheckpoints,
  slalomCones,
} from '../lib/courseGenerators.js'

export const drivingCourses = {
  'controls-intro': {
    id: 'controls-intro',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    // No checkpoints/bay/pallet to complete against (goalType resolves to
    // 'free'), so this is graded by its own completion code instead of a
    // built-in default - see lib/customCompletion.js.
    // The start sequence, the four driving keys, the horn and the direction
    // lever put in R (context.horn and context.leversUsed: the horn and the
    // lever positions since the step was opened, useDrivingController.jsx).
    completionCode:
      "return context.engineStarted && ['w', 'a', 's', 'd'].every((key) => context.keysUsed.includes(key)) && context.horn && context.leversUsed.includes('R')",
  },
  // The two acceleration lanes are open straights for learning the pedals at
  // full throttle, so their speed limit is the truck's top speed rather than
  // the 8 km/h default (lib/courseAlerts.js).
  'accelerate-course': {
    id: 'accelerate-course',
    start: { position: [0, 0, 0], heading: 0 },
    speedLimitKmh: 18,
    checkpoints: [
      {
        id: 'accelerate-finish',
        type: 'pass',
        shape: 'line',
        position: [0, 0, 14],
        halfWidth: 3,
        lineDepth: 1.4,
        label: 'Finish Line',
        completeMessage: 'You accelerated forward and crossed the finish line.',
      },
    ],
  },
  'accelerate-brake': {
    id: 'accelerate-brake',
    start: { position: [0, 0, 0], heading: 0 },
    speedLimitKmh: 18,
    checkpoints: [
      {
        id: 'brake-stop-zone',
        type: 'stop',
        position: [0, 0, 12],
        radius: 1.2,
        maxSpeed: 0.25,
        label: 'Stop Zone',
        completeMessage: 'You braked in time and stopped inside the marked zone.',
      },
    ],
  },
  // Forced serpentine slalom: six individual cones alternating left/right,
  // like a real autocross layout, boxed in by boundary cones on both sides.
  // Each cone is paired with a small sequential checkpoint offset toward it
  // (see slalomCheckpoints) so the forklift must actually swing over to clear
  // each gate in order - that's what forces the weave, not a solid barrier.
  'turning-practice': {
    id: 'turning-practice',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [
      ...slalomCheckpoints(0.95, 3, 2.4, 8),
      {
        id: 'turning-finish',
        type: 'pass',
        position: [0, 0, 23],
        radius: 1.6,
        label: 'Finish Line',
        completeMessage: 'Serpentine complete - smooth, controlled weaving keeps loads and pedestrians safe.',
      },
    ],
    decorations: [
      ...slalomCones(0.95, 3, 2.4, 8),
      ...coneLine(-2.4, 1, 22, 1.3),
      ...coneLine(2.4, 1, 22, 1.3),
    ],
  },
  // Extended capstone course for Module 2 (Load Handling): combines every
  // skill from the earlier steps - straight acceleration, two S-turns, a
  // mid-course controlled stop, a third turn, and a final parking stop - down
  // a single continuous narrow cone corridor that hugs the driving line the
  // whole way (see corridorCones), instead of a wide, sparsely-marked lane.
  'driving-course': {
    id: 'driving-course',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [
      {
        id: 'course-checkpoint-1',
        type: 'pass',
        position: [0, 0, 9],
        radius: 0.9,
        label: 'Checkpoint 1',
        completeMessage: 'Checkpoint 1 clear - a right turn is coming up.',
      },
      {
        id: 'course-checkpoint-2',
        type: 'pass',
        position: [-2.6, 0, 16],
        radius: 0.9,
        label: 'Checkpoint 2 - Right Turn',
        completeMessage: 'Checkpoint 2 clear - now steer left.',
      },
      {
        id: 'course-checkpoint-3',
        type: 'pass',
        position: [2.6, 0, 23],
        radius: 0.9,
        label: 'Checkpoint 3 - Left Turn',
        completeMessage: 'Checkpoint 3 clear - a yield point is ahead, straighten up and be ready to stop.',
      },
      {
        id: 'course-yield',
        type: 'stop',
        position: [0, 0, 27],
        radius: 0.9,
        maxSpeed: 0.3,
        label: 'Yield Point',
        completeMessage: 'Yield point clear - one more right turn before the parking bay.',
      },
      {
        id: 'course-checkpoint-4',
        type: 'pass',
        position: [-2.6, 0, 33],
        radius: 0.9,
        label: 'Checkpoint 4 - Right Turn',
        completeMessage: 'Checkpoint 4 clear - bring the forklift to the parking bay.',
      },
      {
        id: 'course-park',
        type: 'stop',
        position: [0, 0, 41.8],
        radius: 0.9,
        maxSpeed: 0.25,
        label: 'Dead End',
        completeMessage: 'Stopped at the dead end - now reverse out, looking behind you.',
      },
      {
        id: 'course-reverse',
        type: 'stop',
        position: [0, 0, 38.6],
        radius: 0.9,
        maxSpeed: 0.25,
        label: 'Reverse Out',
        completeMessage: 'You completed the full driving course and reversed out safely.',
      },
    ],
    // The corridor, a rack on the outside of the last right turn, where the
    // tail swings toward it (tail-swing), and the wall closing the dead end
    // the course reverses out of.
    decorations: [
      ...corridorCones([[0, 0], [0, 9], [-2.6, 16], [2.6, 23], [0, 27], [-2.6, 33], [0, 38], [0, 42.6]], 0.75, 1.3),
      { type: 'rack-loaded', position: [-3.9, 0, 33], rotation: Math.PI / 2 },
      { type: 'wall', position: [0, 0, 43.4], length: 1.6, rotation: Math.PI / 2 },
    ],
  },
  // Reversing and Looking Behind: the truck starts nose-in to a dead end, in
  // a lane too narrow to turn round in, so the only way out is in reverse,
  // round a bend, to a stop clear of the aisle.
  'reverse-travel': {
    id: 'reverse-travel',
    start: { position: [0, 0, 12], heading: 0 },
    checkpoints: [
      {
        id: 'reverse-aisle',
        type: 'pass',
        position: [0, 0, 8],
        radius: 0.5,
        label: 'Aisle',
        completeMessage: 'Straight back down the aisle - the bend is coming up behind you.',
      },
      {
        id: 'reverse-bend',
        type: 'pass',
        position: [0.9, 0, 4.5],
        radius: 0.5,
        label: 'Bend',
        completeMessage: 'Round the bend - keep looking where the truck is going.',
      },
      {
        id: 'reverse-stop',
        type: 'stop',
        position: [1.8, 0, 1.5],
        radius: 0.6,
        maxSpeed: 0.25,
        label: 'Stop Clear',
        completeMessage: 'You reversed out of the aisle and stopped clear of it.',
      },
    ],
    decorations: [
      ...corridorCones([[0, 13], [0, 8], [0.9, 4.5], [1.8, 2], [1.8, 0.5]], 0.4, 1),
      { type: 'wall', position: [0, 0, 13.4], length: 1.2, rotation: Math.PI / 2 },
    ],
  },
  // Speed Zones and Crossings: a 5 km/h zone with a stop line, then a blind
  // crossing between walls where the truck stops and sounds the horn
  // (requireHorn), then on to the end of the zone.
  'speed-zones': {
    id: 'speed-zones',
    start: { position: [0, 0, 0], heading: 0 },
    speedLimitKmh: 5,
    checkpoints: [
      {
        id: 'stop-line',
        type: 'stop',
        position: [0, 0, 6],
        radius: 0.6,
        maxSpeed: 0.25,
        label: 'Stop Line',
        completeMessage: 'Stopped at the line. The blind crossing is next.',
      },
      {
        id: 'blind-crossing',
        type: 'stop',
        requireHorn: true,
        position: [0, 0, 13],
        radius: 0.7,
        maxSpeed: 0.25,
        label: 'Blind Crossing',
        completeMessage: 'Stopped and warned anyone round the corner - cross when it is clear.',
      },
      {
        id: 'zone-exit',
        type: 'pass',
        position: [0, 0, 20],
        radius: 0.8,
        label: 'End of Zone',
        completeMessage: 'You kept to the speed limit, stopped at the line and sounded the horn at the crossing.',
      },
    ],
    decorations: [
      ...coneLine(-1.2, 1, 9, 1.3),
      ...coneLine(1.2, 1, 9, 1.3),
      // The walls hide the cross aisle until the truck is in it.
      { type: 'wall', position: [-1.3, 0, 10.8], length: 1.6, rotation: 0 },
      { type: 'wall', position: [1.3, 0, 10.8], length: 1.6, rotation: 0 },
      { type: 'wall', position: [-1.3, 0, 15.2], length: 1.6, rotation: 0 },
      { type: 'wall', position: [1.3, 0, 15.2], length: 1.6, rotation: 0 },
      ...coneLine(-1.2, 17, 21, 1.3),
      ...coneLine(1.2, 17, 21, 1.3),
    ],
  },
  // Module 3 (Post-Operation) parking proficiency course. `parkingBay` enables
  // the painted-lines bay in DrivingSimulationViewer: the step completes when
  // the forklift is inside the lines, aligned, stopped, forks lowered, and the
  // engine is switched off. Cones and walls are always live colliders.
  'secure-parking': {
    id: 'secure-parking',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    parkingBay: { position: [-2.6, 0, 16], width: 0.45, depth: 1, heading: 0, label: 'Parking Bay' },
    obstacles: [
      { type: 'cone', position: [-1.2, 0, 4] },
      { type: 'cone', position: [1.2, 0, 4] },
      { type: 'cone', position: [-1.2, 0, 7] },
      { type: 'cone', position: [1.2, 0, 7] },
      { type: 'cone', position: [0.6, 0, 10.5] },
      { type: 'cone', position: [-4.6, 0, 12] },
      { type: 'cone', position: [-0.6, 0, 13.5] },
      { type: 'cone', position: [-4.4, 0, 16] },
      { type: 'cone', position: [-0.8, 0, 16.6] },
    ],
    decorations: [
      { type: 'wall', position: [-2.6, 0, 18.2], length: 2.6, rotation: Math.PI / 2 },
      { type: 'wall', position: [4.4, 0, 8], length: 3.2, rotation: 0 },
      ...coneLine(-5.4, 2, 19, 2.5),
      ...coneLine(5.4, 2, 19, 2.5),
      ...coneBay({ x: -2.6, z: 16, width: 0.45, depth: 1 }),
    ],
  },
  // Parallel parking: a narrow bay running along the lane direction (heading
  // matches the approach), marked with a cone at each corner of the pocket -
  // the standard driving-test parallel-parking box layout - plus lane-entry
  // and lane-exit cone pairs. The learner eases sideways into the marked
  // pocket and straightens up, same completion logic as secure-parking.
  'parallel-parking': {
    id: 'parallel-parking',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    parkingBay: { position: [-1.2, 0, 13], width: 0.42, depth: 1.3, heading: 0, label: 'Parallel Bay' },
    decorations: [
      ...coneBox({ x: -1.2, z: 13, width: 0.42, depth: 1.3 }),
      ...coneLine(-2.2, 2, 11.2, 1.3),
      ...coneLine(-2.2, 14.8, 24, 1.3),
      ...coneLine(2.2, 2, 24, 1.3),
    ],
  },
  // Parking between forklifts: a tight bay flanked by two static parked
  // forklifts instead of paint alone - both are live colliders, so drifting
  // toward either side ends the attempt just like clipping a wall.
  'forklift-gap-parking': {
    id: 'forklift-gap-parking',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    parkingBay: { position: [0, 0, 16], width: 0.35, depth: 1, heading: 0, label: 'Forklift Gap' },
    decorations: [
      { type: 'vehicle', position: [-0.45, 0, 16], rotation: 0 },
      { type: 'vehicle', position: [0.45, 0, 16], rotation: 0 },
      ...coneLine(-2.6, 2, 11, 2.4),
      ...coneLine(2.6, 2, 11, 2.4),
    ],
  },
  // Module 4 (Pallet Handling Assessment) courses. `capacityKg` is the truck's
  // capacity plate, which a pallet's `weightKg` is judged against (the load
  // chart, and the stability model behind a tip-over), and `failConditions`
  // switches the load-handling fails on per course (lib/courseGoals.js,
  // resolveFailConditions). Collisions, a pallet struck at speed and a
  // tip-over always fail.
  'precision-carry': {
    id: 'precision-carry',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    pallets: [{ id: 'carry-pallet', position: [0, 0, 5], rotation: 0, weightKg: 500 }],
    dropZone: { position: [0, 0, 19], radius: 0.9, label: 'Drop Zone' },
    obstacles: [
      { type: 'cone', position: [-1.2, 0, 8] },
      { type: 'cone', position: [1.2, 0, 8] },
      { type: 'cone', position: [-1.2, 0, 11] },
      { type: 'cone', position: [1.2, 0, 11] },
      { type: 'cone', position: [-1.2, 0, 14] },
      { type: 'cone', position: [1.2, 0, 14] },
      { type: 'cone', position: [-1.2, 0, 17] },
      { type: 'cone', position: [1.2, 0, 17] },
    ],
    decorations: [
      { type: 'wall', position: [4.4, 0, 12], length: 3.2, rotation: 0 },
      { type: 'wall', position: [-4.4, 0, 12], length: 3.2, rotation: 0 },
      ...coneLine(-5.4, 3, 21, 2.5),
      ...coneLine(5.4, 3, 21, 2.5),
    ],
  },
  'load-limits': {
    id: 'load-limits',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    pallets: [
      { id: 'pallet-600', position: [-2.2, 0, 7], rotation: 0, weightKg: 600 },
      { id: 'pallet-1500', position: [0, 0, 7], rotation: 0, weightKg: 1500 },
      { id: 'pallet-400', position: [2.2, 0, 7], rotation: 0, weightKg: 400 },
    ],
    dropZone: { position: [0, 0, 16], radius: 0.9, label: 'Drop Zone' },
    obstacles: [
      { type: 'cone', position: [-3.4, 0, 10] },
      { type: 'cone', position: [3.4, 0, 10] },
      { type: 'cone', position: [-1.6, 0, 13] },
      { type: 'cone', position: [1.6, 0, 13] },
    ],
    decorations: [
      { type: 'wall', position: [4.6, 0, 7], length: 3.2, rotation: 0 },
      { type: 'wall', position: [-4.6, 0, 7], length: 3.2, rotation: 0 },
      ...coneLine(-5.4, 3, 18, 2.5),
      ...coneLine(5.4, 3, 18, 2.5),
    ],
  },
  // Reading the Load Chart: two pallets of the same weight. One load sits
  // 0.3 m toward the far end of its pallet, so its load centre is 0.9 m and
  // the plate derated for that (678 kg) is under its 800 kg: lifting it fails
  // as an overload. The other is centred (0.6 m) and within the plate.
  'load-centre': {
    id: 'load-centre',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    pallets: [
      { id: 'pallet-far-load', position: [-1.4, 0, 7], rotation: 0, weightKg: 800, loadOffsetM: 0.3 },
      { id: 'pallet-centred-load', position: [1.4, 0, 7], rotation: 0, weightKg: 800 },
    ],
    dropZone: { position: [0, 0, 15], radius: 0.9, label: 'Drop Zone' },
    obstacles: [
      { type: 'cone', position: [-3.2, 0, 10] },
      { type: 'cone', position: [3.2, 0, 10] },
      { type: 'cone', position: [-1.6, 0, 12.5] },
      { type: 'cone', position: [1.6, 0, 12.5] },
    ],
    decorations: [
      { type: 'wall', position: [4.6, 0, 7], length: 3.2, rotation: 0 },
      { type: 'wall', position: [-4.6, 0, 7], length: 3.2, rotation: 0 },
      ...coneLine(-5.4, 3, 18, 2.5),
      ...coneLine(5.4, 3, 18, 2.5),
    ],
  },
  // Turning with a Load: a near-rated load carried down a cone corridor that
  // curves, then bends back and forth, to the drop zone. Taken fast or with
  // the load high, the turns tip the truck sideways or slide the load.
  'stability-turns': {
    id: 'stability-turns',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    pallets: [{ id: 'turn-pallet', position: [0, 0, 4], rotation: 0, weightKg: 900 }],
    dropZone: { position: [0, 0, 27.5], radius: 0.9, label: 'Drop Zone' },
    decorations: corridorCones([[0, -1], [0, 7], [1.8, 11], [1.8, 14], [0, 17], [-1.8, 20], [0, 23], [0, 29]], 0.7, 1.2),
  },
  'pallet-pickup': {
    id: 'pallet-pickup',
    start: { position: [0, 0, 0], heading: 0 },
    // No checkpoints - completion is driven by the pallet's state
    // (lib/physics/palletState.js: pallet-lifted / pallet-dropped / pallet-delivered).
    checkpoints: [],
    pallet: { id: 'pallet-1', position: [0, 0, 10], rotation: 0 },
    dropZone: { position: [-2.6, 0, 18], radius: 0.9, label: 'Drop Zone' },
    decorations: [
      { type: 'cone', position: [-0.9, 0, 6] },
      { type: 'cone', position: [0.9, 0, 6] },
      { type: 'wall', position: [4.4, 0, 14], length: 3.2, rotation: 0 },
      ...coneLine(-3.4, 2, 20, 2.5),
      ...coneLine(3.4, 2, 20, 2.5),
    ],
  },
  // Module 4 rack-storage exercise: pick up the pallet, then raise it to the
  // assigned shelf height and set it on the rack instead of in a ground drop
  // zone (see `racks`/`targetRack`/`targetLevel`; the delivery is judged in
  // lib/driving/stepPallet.js, atDestination).
  'rack-storage': {
    id: 'rack-storage',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    pallets: [{ id: 'rack-pallet', position: [0, 0, 6], rotation: 0, weightKg: 450, targetRack: 'storage-rack-1', targetLevel: 'middle' }],
    racks: [{ id: 'storage-rack-1', position: [0, 0, 15], rotation: 0 }],
    decorations: [
      { type: 'cone', position: [-0.9, 0, 3] },
      { type: 'cone', position: [0.9, 0, 3] },
      ...coneLine(-2.6, 2, 13, 2.4),
      ...coneLine(2.6, 2, 13, 2.4),
    ],
  },
  // Same mechanic as rack-storage, targeting the top shelf instead - the
  // fuller raise gives the learner practice judging a taller lift.
  'rack-storage-top': {
    id: 'rack-storage-top',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    pallets: [{ id: 'rack-pallet-top', position: [0, 0, 6], rotation: 0, weightKg: 450, targetRack: 'storage-rack-2', targetLevel: 'top' }],
    racks: [{ id: 'storage-rack-2', position: [0, 0, 15], rotation: 0 }],
    decorations: [
      { type: 'cone', position: [-0.9, 0, 3] },
      { type: 'cone', position: [0.9, 0, 3] },
      ...coneLine(-2.6, 2, 13, 2.4),
      ...coneLine(2.6, 2, 13, 2.4),
    ],
  },
  // Retrieving from the Top Shelf: the pallet starts on the rack's top
  // shelf. Take it off, lower it to travel height before moving, and reverse
  // with it to the dock behind the start.
  'rack-retrieval': {
    id: 'rack-retrieval',
    start: { position: [0, 0, 6], heading: 0 },
    checkpoints: [],
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    racks: [{ id: 'retrieval-rack', position: [0, 0, 12], rotation: 0 }],
    pallets: [
      {
        id: 'top-shelf-pallet',
        position: [0, 0, 12],
        rotation: 0,
        weightKg: 450,
        startShelf: { rack: 'retrieval-rack', level: 'top' },
        target: { zone: 'dock' },
      },
    ],
    dropZones: [{ id: 'dock', position: [0, 0, 3], radius: 0.9, label: 'Dock' }],
    decorations: [...coneLine(-1.6, 1, 10, 2.4), ...coneLine(1.6, 1, 10, 2.4)],
  },
  // Module 5, the Final Driving Test: one mission (docs/modules/module-
  // improvements-plan.md, 3.6). The truck starts nose-in to a dead-end bay
  // off the aisle; the learner backs out of it, stops and sounds the horn at
  // the blind crossing, picks the pallet the truck may lift (both weigh
  // 700 kg, but one load sits 0.3 m toward the far end: 0.9 m from the fork
  // face, over the plate derated for that) and stores it on the rack's middle
  // shelf, takes the pallet off the top shelf of the same rack to the dock,
  // then backs into the parking bay and secures the truck. A 5 km/h aisle.
  // Pass rules: lib/missionScore.js's stock ones (D-3).
  'final-test': {
    id: 'final-test',
    goalType: 'mission',
    start: { position: [2, 0, 1], heading: Math.PI / 2 },
    speedLimitKmh: 5,
    capacityKg: 1000,
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    checkpoints: [
      {
        id: 'bay-exit',
        type: 'stop',
        position: [0.3, 0, -0.2],
        radius: 0.6,
        maxSpeed: 0.25,
        label: 'Clear of the Bay',
        completeMessage: 'Out of the bay. Drive up the aisle to the crossing.',
      },
      {
        id: 'crossing',
        type: 'stop',
        requireHorn: true,
        position: [0, 0, 5],
        radius: 0.7,
        maxSpeed: 0.25,
        label: 'Blind Crossing',
        completeMessage: 'Stopped and sounded the horn. Cross when it is clear.',
      },
    ],
    pallets: [
      { id: 'store-pallet', position: [-1.2, 0, 12.5], rotation: 0, weightKg: 700, target: { rack: 'aisle-rack', level: 'middle' } },
      { id: 'far-load-pallet', position: [1.2, 0, 12.5], rotation: 0, weightKg: 700, loadOffsetM: 0.3 },
      {
        id: 'top-shelf-pallet',
        position: [-1.2, 0, 20],
        rotation: 0,
        weightKg: 450,
        startShelf: { rack: 'aisle-rack', level: 'top' },
        target: { zone: 'dock' },
      },
    ],
    racks: [{ id: 'aisle-rack', position: [-1.2, 0, 20], rotation: 0 }],
    dropZones: [{ id: 'dock', position: [-1.2, 0, 15.5], radius: 0.9, label: 'Dock' }],
    parkingBay: { position: [-1.2, 0, 9.5], width: 0.45, depth: 1, heading: 0, label: 'Parking Bay' },
    tasks: [
      { id: 'start', type: 'start', label: 'Start the truck' },
      { id: 'reverse-out', type: 'checkpoint', ref: 'bay-exit', label: 'Reverse out of the bay, looking behind' },
      { id: 'crossing', type: 'checkpoint', ref: 'crossing', label: 'Stop at the crossing and sound the horn' },
      { id: 'store', type: 'deliver', ref: 'store-pallet', label: 'Store the pallet you may lift on the middle shelf' },
      { id: 'retrieve', type: 'deliver', ref: 'top-shelf-pallet', label: 'Take the pallet off the top shelf to the dock' },
      { id: 'park', type: 'park', label: 'Park in the bay and secure the truck' },
    ],
    decorations: [
      // The bay the truck starts in: a wall at its nose and either side.
      { type: 'wall', position: [2.85, 0, 1], length: 1.2, rotation: 0 },
      { type: 'wall', position: [2.25, 0, 0.5], length: 1.2, rotation: Math.PI / 2 },
      { type: 'wall', position: [2.25, 0, 1.5], length: 1.2, rotation: Math.PI / 2 },
      // The walls that hide the cross aisle until the truck is in it.
      { type: 'wall', position: [-1.7, 0, 3.2], length: 1.6, rotation: 0 },
      { type: 'wall', position: [1.7, 0, 3.2], length: 1.6, rotation: 0 },
      { type: 'wall', position: [-1.7, 0, 6.8], length: 1.6, rotation: 0 },
      { type: 'wall', position: [1.7, 0, 6.8], length: 1.6, rotation: 0 },
      ...coneLine(-2.6, 11, 22.5, 2.3),
      ...coneLine(2.6, 11, 22.5, 2.3),
      { type: 'rack-loaded', position: [1.4, 0, 20], rotation: 0 },
    ],
  },
}
