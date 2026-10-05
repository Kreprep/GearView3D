// Test courses for the simulation features of the module improvements' Phase 5
// (docs/modules/module-improvements-plan.md): a load centre per pallet, a
// pallet that starts on a rack shelf, targets on the pallet with a list of
// drop zones, a checkpoint that wants the horn, and a mission. Fixtures for
// the scripted drives in drivingScenarios.js, not stock content: the stock
// courses that use these features are data/drivingCourse.js's.

export const featureCourses = {
  // Two loads of the same weight. One sits 0.3 m toward the far end of its
  // pallet, so its load centre is 0.9 m: over the 1,000 kg plate derated for
  // that (678 kg). The other is centred (0.6 m) and lifts.
  'load-centre': {
    id: 'load-centre',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    capacityKg: 1000,
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    pallets: [
      { id: 'far-load', position: [-1.5, 0, 6], rotation: 0, weightKg: 700, loadOffsetM: 0.3 },
      { id: 'centred-load', position: [1.5, 0, 6], rotation: 0, weightKg: 700 },
    ],
    dropZone: { position: [0, 0, 14], radius: 0.9, label: 'Drop Zone' },
  },
  // A pallet on the top shelf, to be taken off and put down in a dock zone
  // behind the truck, one of two zones.
  'shelf-retrieval': {
    id: 'shelf-retrieval',
    start: { position: [0, 0, 9], heading: 0 },
    checkpoints: [],
    failConditions: { loadDrop: true, highTravel: true },
    racks: [{ id: 'pick-rack', position: [0, 0, 15], rotation: 0 }],
    pallets: [{ id: 'top-pallet', position: [0, 0, 15], rotation: 0, weightKg: 400, startShelf: { rack: 'pick-rack', level: 'top' }, target: { zone: 'dock' } }],
    dropZones: [
      { id: 'dock', position: [0, 0, 6], radius: 0.9, label: 'Dock' },
      { id: 'spare', position: [3, 0, 6], radius: 0.9, label: 'Spare' },
    ],
  },
  // A blind crossing: stop there and sound the horn, then on to the finish.
  'horn-crossing': {
    id: 'horn-crossing',
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [
      { id: 'crossing', type: 'stop', requireHorn: true, position: [0, 0, 6], radius: 0.9, maxSpeed: 0.25, label: 'Crossing' },
      { id: 'finish', type: 'pass', position: [0, 0, 11], radius: 0.9, label: 'Finish' },
    ],
  },
  // A short mission: start, a blind crossing, a pallet to a zone, then park
  // in the bay behind.
  mission: {
    id: 'mission',
    goalType: 'mission',
    start: { position: [0, 0, 0], heading: 0 },
    failConditions: { loadDrop: true, overload: true, highTravel: true },
    checkpoints: [{ id: 'crossing', type: 'stop', requireHorn: true, position: [0, 0, 4], radius: 0.9, maxSpeed: 0.25, label: 'Crossing' }],
    pallets: [{ id: 'mission-pallet', position: [0, 0, 10], rotation: 0, weightKg: 400, target: { zone: 'dock' } }],
    dropZones: [{ id: 'dock', position: [0, 0, 16], radius: 0.9, label: 'Dock' }],
    parkingBay: { position: [0, 0, 7], width: 0.45, depth: 1, heading: 0, label: 'Bay' },
    tasks: [
      { id: 'start', type: 'start', label: 'Start the truck' },
      { id: 'cross', type: 'checkpoint', ref: 'crossing', label: 'Stop and sound the horn at the crossing' },
      { id: 'deliver', type: 'deliver', ref: 'mission-pallet', label: 'Take the pallet to the dock' },
      { id: 'park', type: 'park', label: 'Park in the bay and secure the truck' },
    ],
  },
}
