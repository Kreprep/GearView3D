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
