// Interactive content for Module 3 (Post-Operation and Secure Parking).
// The shutdown actions must be selected in `order`; `displayOrder` is the
// fixed scrambled order the cards are presented in (deterministic, no runtime
// shuffle, so retries always look the same).

export const shutdownSequenceActions = [
  {
    id: 'park-level',
    order: 1,
    label: 'Park on a level surface',
    detail: 'Away from traffic lanes, slopes, exits, and obstructions.',
  },
  {
    id: 'lower-forks',
    order: 2,
    label: 'Lower the forks completely',
    detail: 'Flat on the floor so they are not a trip or impact hazard.',
  },
  {
    id: 'neutral-controls',
    order: 3,
    label: 'Set controls to neutral',
    detail: 'Direction and hydraulic levers centered before leaving the seat.',
  },
  {
    id: 'parking-brake',
    order: 4,
    label: 'Engage the parking brake',
    detail: 'The truck must not be able to roll once you step off.',
  },
  {
    id: 'power-off',
    order: 5,
    label: 'Turn off the equipment',
    detail: 'Switch the ignition off and remove the key if required.',
  },
  {
    id: 'report-conditions',
    order: 6,
    label: 'Report unsafe conditions or damage',
    detail: 'Tell qualified personnel about anything found during the shift.',
  },
]

export const shutdownDisplayOrder = [
  'parking-brake',
  'park-level',
  'report-conditions',
  'lower-forks',
  'power-off',
  'neutral-controls',
]

export const postOperationReportPrompts = [
  {
    id: 'hydraulic-drip',
    text: 'A fresh oil patch is forming on the floor under the parked forklift.',
    shouldReport: true,
    feedback: 'Correct - fluid leaks must be reported before the next shift uses the truck.',
    wrongFeedback: 'A forming oil patch means an active leak. This must be reported.',
  },
  {
    id: 'forks-flat',
    text: 'The forks are lowered flat on the floor inside the parking bay.',
    shouldReport: false,
    feedback: 'Correct - lowered forks are the expected parked condition, nothing to report.',
    wrongFeedback: 'Lowered forks are exactly what secure parking requires - no report needed.',
  },
  {
    id: 'chain-kink',
    text: 'One lift chain has a kinked, stiff link after the shift.',
    shouldReport: true,
    feedback: 'Correct - damaged lifting parts must be reported so the truck is not used.',
    wrongFeedback: 'A kinked chain link can fail under load. This must be reported.',
  },
  {
    id: 'seat-belt-fray',
    text: 'The seat belt webbing is frayed near the buckle.',
    shouldReport: true,
    feedback: 'Correct - a damaged seat belt is a safety device defect and must be reported.',
    wrongFeedback: 'A frayed seat belt may not restrain the operator. This must be reported.',
  },
  {
    id: 'beacon-intact',
    text: 'The warning beacon lens is clean and flashes normally during the test.',
    shouldReport: false,
    feedback: 'Correct - a working beacon is a normal condition, nothing to report.',
    wrongFeedback: 'The beacon is working as designed - no report is needed.',
  },
]
