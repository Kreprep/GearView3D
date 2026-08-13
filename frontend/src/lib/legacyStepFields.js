// Per-module maps that read simulation snapshots written before completion
// moved to the step-id map (`stepsComplete`). Keyed by module slug; only
// Forklift's three original course-backed modules ever wrote the old field
// names, so any other slug resolves to an empty map. See
// lib/simulationProgress.js for how these are applied.
const REQUIRED_CONTROL_KEYS = ['w', 'a', 's', 'd']

const legacyStepFieldsBySlug = {
  'load-handling': {
    'controls-intro': (saved) =>
      saved.engineStarted && REQUIRED_CONTROL_KEYS.every((key) => (saved.keysUsed || []).includes(key)),
    'accelerate-course': 'accelerateComplete',
    'accelerate-brake': 'brakeComplete',
    'turning-practice': 'turningComplete',
    'driving-course': 'drivingCourseComplete',
    'pallet-pickup': 'palletComplete',
  },
  'post-operation': {
    'secure-parking': 'secureParkingComplete',
    'parallel-parking': 'parallelParkingComplete',
    'forklift-gap-parking': 'gapParkingComplete',
    'shutdown-sequence': 'shutdownComplete',
    reporting: 'reportingComplete',
  },
  'pallet-testing': {
    'precision-carry': 'carryComplete',
    'load-limits': 'limitsComplete',
  },
}

export function legacyStepFieldsFor(moduleSlug) {
  return legacyStepFieldsBySlug[moduleSlug] || {}
}

export { REQUIRED_CONTROL_KEYS }
