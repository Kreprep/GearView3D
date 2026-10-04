import { m } from '../lib/driving/units.js'

// The open pad the engine-on inspection's cab stands on
// (docs/modules/module-improvements-plan.md, section 3.3): a course for the
// simulation core with nothing on it. Code-owned, not a `Course` row, because
// nothing about it is meant to be edited; the step row only says what to
// inspect. Pure and backend-importable, like the rest of data/.
//
// Room enough for the brake and travel tests (lib/inspection/detectors.js:
// 2 km/h, 2 m to stop, half a metre each way) several times over. The truck
// is clamped at the edge of `bounds`, not failed (stepDrive.js), and there
// is nothing to hit, so no fail can fire but a tip-over, which an unladen
// truck at walking pace cannot reach. The speed limit is the safety signs'
// (lib/courseAlerts.js): a sign, not a governor.

const PAD_HALF_SIZE = m(10)

export const INSPECTION_PAD = Object.freeze({
  id: 'inspection-pad',
  start: { position: [0, 0, 0], heading: 0 },
  bounds: { halfWidth: PAD_HALF_SIZE, minZ: -PAD_HALF_SIZE, maxZ: PAD_HALF_SIZE },
  checkpoints: [],
  decorations: [],
  pallets: [],
  racks: [],
  dropZone: null,
  parkingBay: null,
  capacityKg: null,
  failConditions: { overload: false, loadDrop: false, highTravel: false },
  speedLimitKmh: 5,
})
