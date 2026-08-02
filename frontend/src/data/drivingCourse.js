// Ground-plane coordinates for the simplified WASD driving simulation (Module 2).
// No physics engine or collision detection is modeled - checkpoints are simple
// radius/speed checks (or line-crossing checks) used to gate step completion.
// Facing +Z at heading 0, pressing D (steer right) turns the forklift toward
// -X and pressing A (steer left) turns it toward +X - so "right gate" style
// checkpoints sit on the -X side of the course and "left gate" ones on +X.

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
  'turning-practice': {
    id: 'turning-practice',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [
      {
        id: 'turn-right-gate',
        type: 'pass',
        position: [-2.6, 0, 8],
        radius: 1.3,
        label: 'Right Turn Gate',
        completeMessage: 'Right turn complete - continue toward the left gate.',
      },
      {
        id: 'turn-left-gate',
        type: 'pass',
        position: [2.6, 0, 16],
        radius: 1.3,
        label: 'Left Turn Gate',
        completeMessage: 'Left turn complete - head to the finish line.',
      },
      {
        id: 'turning-finish',
        type: 'pass',
        position: [0, 0, 22],
        radius: 1.3,
        label: 'Finish Line',
        completeMessage: 'Turning practice complete.',
      },
    ],
    decorations: [
      { type: 'wall', position: [-4.4, 0, 7], length: 3.2, rotation: 0 },
      { type: 'wall', position: [4.4, 0, 17], length: 3.2, rotation: 0 },
      { type: 'cone', position: [-0.9, 0, 4] },
      { type: 'cone', position: [0.9, 0, 12] },
      { type: 'cone', position: [-0.9, 0, 19] },
      { type: 'cone', position: [0, 0, 22.6] },
    ],
  },
  'driving-course': {
    id: 'driving-course',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [
      {
        id: 'course-checkpoint-1',
        type: 'pass',
        position: [0, 0, 9],
        radius: 1.3,
        label: 'Checkpoint 1',
        completeMessage: 'Checkpoint 1 clear - a right turn is coming up.',
      },
      {
        id: 'course-checkpoint-2',
        type: 'pass',
        position: [-2.6, 0, 16],
        radius: 1.3,
        label: 'Checkpoint 2 - Right Turn',
        completeMessage: 'Checkpoint 2 clear - now steer left.',
      },
      {
        id: 'course-checkpoint-3',
        type: 'pass',
        position: [2.6, 0, 23],
        radius: 1.3,
        label: 'Checkpoint 3 - Left Turn',
        completeMessage: 'Checkpoint 3 clear - bring the forklift to the parking bay.',
      },
      {
        id: 'course-park',
        type: 'stop',
        position: [0, 0, 30],
        radius: 1.2,
        maxSpeed: 0.25,
        label: 'Parking Bay',
        completeMessage: 'You completed the full driving course and parked safely.',
      },
    ],
  },
  // Module 3 (Post-Operation) parking proficiency course. `parkingBay` enables
  // the painted-lines bay in DrivingSimulationViewer: the step completes when
  // the forklift is inside the lines, aligned, stopped, forks lowered, and the
  // engine is switched off. Cones are live colliders (see failConditions).
  'secure-parking': {
    id: 'secure-parking',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    failConditions: { coneCollision: true },
    parkingBay: { position: [-2.6, 0, 16], width: 1.3, depth: 1.9, heading: 0, label: 'Parking Bay' },
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
    ],
  },
  // Module 4 (Pallet Handling Assessment) courses. These enable the kinematic
  // fail system in DrivingSimulationViewer: `capacityKg` + pallet `weightKg`
  // drive the overload tip-over, `obstacles` cones are live colliders, and
  // `failConditions` toggles each fail rule per course.
  'precision-carry': {
    id: 'precision-carry',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { coneCollision: true, suddenStop: true, overload: true },
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
    ],
  },
  'load-limits': {
    id: 'load-limits',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { coneCollision: true, suddenStop: true, overload: true },
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
    ],
  },
}
