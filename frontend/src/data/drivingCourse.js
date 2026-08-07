// Ground-plane coordinates for the simplified WASD driving simulation (Module 2).
// No physics engine is modeled - checkpoints are simple radius/speed checks
// (or line-crossing checks) used to gate step completion, but cones/walls/
// forklifts placed below ARE live colliders (see DrivingSimulationViewer).
// Facing +Z at heading 0, pressing D (steer right) turns the forklift toward
// -X and pressing A (steer left) turns it toward +X - so "right gate" style
// checkpoints sit on the -X side of the course and "left gate" ones on +X.

// Medium-density boundary cone line bounding one edge of a drivable corridor
// (the autocross-style layout requested for Modules 2-4). `spacing` of
// ~2-2.5 world units (8-10m) reads as "medium" - tight enough to read as a
// wall of cones, loose enough not to be a solid line.
function coneLine(x, zStart, zEnd, spacing = 2.4) {
  const cones = []
  for (let z = zStart; z <= zEnd + 1e-6; z += spacing) {
    cones.push({ type: 'cone', position: [x, 0, Math.round(z * 100) / 100] })
  }
  return cones
}

// Classic single-file slalom: individual cones alternating left/right, like a
// real autocross layout. A point cone can't physically block a straight
// line, so `slalomCheckpoints` below pairs each one with a small sequential
// checkpoint offset toward it - the forklift must actually swing over to
// clear each checkpoint in order, which is what forces the weave.
function slalomCones(amplitude, zStart, spacing, count) {
  return Array.from({ length: count }, (_, i) => ({
    type: 'cone',
    position: [i % 2 === 0 ? amplitude : -amplitude, 0, Math.round((zStart + i * spacing) * 100) / 100],
  }))
}

function slalomCheckpoints(amplitude, zStart, spacing, count, { radius = 0.6, idPrefix = 'slalom', labelPrefix = 'Slalom Gate' } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const x = (i % 2 === 0 ? amplitude : -amplitude) * 0.6
    const z = Math.round((zStart + i * spacing) * 100) / 100
    return {
      id: `${idPrefix}-${i + 1}`,
      type: 'pass',
      position: [x, 0, z],
      radius,
      label: `${labelPrefix} ${i + 1}`,
      completeMessage: `${labelPrefix} ${i + 1} clear - keep weaving through the cones.`,
    }
  })
}

// Dense cone corridor that follows a polyline path (waypoints as [x, z] world
// coordinates, in the order the course is driven), placing cones halfWidth
// to each side at ~spacing intervals along every leg - a narrow, winding
// "chute" that hugs the actual driving line instead of a fixed straight lane.
function corridorCones(waypoints, halfWidth, spacing) {
  const cones = []
  for (let seg = 0; seg < waypoints.length - 1; seg += 1) {
    const [x1, z1] = waypoints[seg]
    const [x2, z2] = waypoints[seg + 1]
    const dx = x2 - x1
    const dz = z2 - z1
    const len = Math.hypot(dx, dz) || 1
    const steps = Math.max(Math.round(len / spacing), 1)
    const nx = -dz / len
    const nz = dx / len
    for (let i = seg === 0 ? 0 : 1; i <= steps; i += 1) {
      const t = i / steps
      const x = x1 + dx * t
      const z = z1 + dz * t
      cones.push({ type: 'cone', position: [Math.round((x + nx * halfWidth) * 100) / 100, 0, Math.round((z + nz * halfWidth) * 100) / 100] })
      cones.push({ type: 'cone', position: [Math.round((x - nx * halfWidth) * 100) / 100, 0, Math.round((z - nz * halfWidth) * 100) / 100] })
    }
  }
  return cones
}

// Cone-marked rectangular pocket (corners + a couple of lane-entry markers) -
// the standard driving-test parallel-parking box layout.
function coneBox({ x, z, width, depth }, margin = 0.15) {
  const halfW = width / 2 + margin
  const halfD = depth / 2 + margin
  return [
    { type: 'cone', position: [x - halfW, 0, z - halfD] },
    { type: 'cone', position: [x + halfW, 0, z - halfD] },
    { type: 'cone', position: [x - halfW, 0, z + halfD] },
    { type: 'cone', position: [x + halfW, 0, z + halfD] },
  ]
}

// Cone-marked bay open on one side (the entry) - three walls of cones like a
// driving-test reverse-parking box: `openSide` is the local +Z/-Z/+X/-X edge
// left clear for entry (heading 0 courses enter from -Z, so 'front' = -Z).
function coneBay({ x, z, width, depth }, margin = 0.15, openSide = 'front') {
  const halfW = width / 2 + margin
  const halfD = depth / 2 + margin
  const left = x - halfW
  const right = x + halfW
  const front = z - halfD
  const back = z + halfD
  const mid = (front + back) / 2
  const cones = []
  if (openSide !== 'left') cones.push({ type: 'cone', position: [left, 0, front] }, { type: 'cone', position: [left, 0, mid] })
  if (openSide !== 'right') cones.push({ type: 'cone', position: [right, 0, front] }, { type: 'cone', position: [right, 0, mid] })
  if (openSide !== 'back') cones.push({ type: 'cone', position: [left, 0, back] }, { type: 'cone', position: [(left + right) / 2, 0, back] }, { type: 'cone', position: [right, 0, back] })
  return cones
}

export const drivingCourses = {
  'controls-intro': {
    id: 'controls-intro',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
  },
  'accelerate-course': {
    id: 'accelerate-course',
    start: { position: [0, 0, 0], heading: 0 },
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
        position: [0, 0, 40],
        radius: 1.2,
        maxSpeed: 0.25,
        label: 'Parking Bay',
        completeMessage: 'You completed the full driving course and parked safely.',
      },
    ],
    decorations: corridorCones(
      [[0, 0], [0, 9], [-2.6, 16], [2.6, 23], [0, 27], [-2.6, 33], [0, 40]],
      0.75,
      1.3,
    ),
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
      { type: 'forklift', position: [-0.45, 0, 16], rotation: 0 },
      { type: 'forklift', position: [0.45, 0, 16], rotation: 0 },
      ...coneLine(-2.6, 2, 11, 2.4),
      ...coneLine(2.6, 2, 11, 2.4),
    ],
  },
  // Module 4 (Pallet Handling Assessment) courses. These enable the kinematic
  // fail system in DrivingSimulationViewer: `capacityKg` + pallet `weightKg`
  // drive the overload tip-over, cones/walls are always live colliders, and
  // `failConditions` toggles the load-specific fail rules per course.
  'precision-carry': {
    id: 'precision-carry',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { suddenStop: true, overload: true },
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
    failConditions: { suddenStop: true, overload: true },
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
  'pallet-pickup': {
    id: 'pallet-pickup',
    start: { position: [0, 0, 0], heading: 0 },
    // No checkpoints - completion is driven by the pallet pickup state machine
    // in DrivingSimulationViewer (pallet-lifted / pallet-dropped / pallet-delivered).
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
}
