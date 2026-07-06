export const engineOffInspectionChecks = [
  {
    id: 'fluid-leaks',
    label: 'Underside / Fluid Leaks',
    hotspotId: 'counterweight',
    targetArea: 'Underside',
    inspect: 'Look under and around the forklift for engine oil, hydraulic oil, coolant, or battery electrolyte leaks.',
    found: 'No active puddle is visible in the normal condition.',
    status: 'safe',
    feedback: 'No visible leak means the learner may continue the inspection, but any puddle should be reported immediately.',
  },
  {
    id: 'engine-bay',
    label: 'Engine Bay / Oil and Coolant',
    hotspotId: 'operator-area',
    targetArea: 'Engine bay',
    inspect: 'Check oil and coolant areas for visible leakage, missing caps, or unsafe condition.',
    found: 'Oil and coolant check points appear normal in this training state.',
    status: 'safe',
    feedback: 'Engine oil and coolant concerns must be reported before operation.',
  },
  {
    id: 'battery-area',
    label: 'Battery Area / Electrolyte',
    hotspotId: 'operator-area',
    targetArea: 'Battery area',
    inspect: 'Look for electrolyte leakage, corrosion, or unsafe battery condition.',
    found: 'No battery electrolyte leak is shown.',
    status: 'safe',
    feedback: 'Battery electrolyte is hazardous. Do not operate or touch unsafe battery conditions.',
  },
  {
    id: 'tires',
    label: 'Tires',
    hotspotId: 'tires',
    targetArea: 'Tires',
    inspect: 'Check for cuts, wear, flat tire condition, and visible tire damage.',
    found: 'The tires appear usable in this guided inspection state.',
    status: 'safe',
    feedback: 'Tire condition affects stability and steering.',
  },
  {
    id: 'mast-assembly',
    label: 'Mast Assembly',
    hotspotId: 'mast',
    targetArea: 'Mast',
    inspect: 'Inspect mast channels, lift chain path, and visible structural areas for cracks or damage.',
    found: 'No mast crack is shown in the normal inspection state.',
    status: 'safe',
    feedback: 'A damaged mast or lift chain path can make lifting unsafe.',
  },
  {
    id: 'forks-carriage',
    label: 'Forks / Carriage',
    hotspotId: 'forks',
    targetArea: 'Forks and carriage',
    inspect: 'Check fork heels, tips, locking pins, carriage attachment, and visible cracks.',
    found: 'Forks and carriage show no visible defect in this state.',
    status: 'safe',
    feedback: 'Fork damage should be reported before handling any load.',
  },
  {
    id: 'structural-bolts',
    label: 'Structural Bolts',
    hotspotId: 'overhead-guard',
    targetArea: 'Structure',
    inspect: 'Look for loose, missing, or visibly unsafe structural bolts.',
    found: 'No loose or missing structural bolt is shown.',
    status: 'safe',
    feedback: 'Loose or missing structural fasteners should be reported before use.',
  },
]

export const engineOnGaugeChecks = [
  {
    id: 'battery-charging-indicator',
    label: 'Battery Charging Indicator',
    normalReading: 'Normal',
    feedback: 'The battery charging indicator is within the expected training range.',
  },
  {
    id: 'engine-oil-pressure-gauge',
    label: 'Engine Oil Pressure Gauge',
    normalReading: 'Normal pressure',
    feedback: 'Oil pressure is acceptable in this scenario.',
  },
  {
    id: 'water-temperature-gauge',
    label: 'Water Temperature Gauge',
    normalReading: 'Normal temperature',
    feedback: 'The water temperature gauge is not showing an overheat condition.',
  },
  {
    id: 'fuel-level-gauge',
    label: 'Fuel Level Gauge',
    normalReading: 'Sufficient fuel',
    feedback: 'Fuel level is sufficient for the training scenario.',
  },
]

export const safetyDeviceTests = [
  {
    id: 'horn',
    label: 'Test Horn',
    feedback: 'Horn responds. Audible warning device is working in this scenario.',
  },
  {
    id: 'headlights',
    label: 'Test Headlights',
    feedback: 'Headlights respond. Lighting check passes in this scenario.',
  },
  {
    id: 'turn-signals',
    label: 'Test Turn Signals',
    feedback: 'Turn signals respond. Signal check passes in this scenario.',
  },
  {
    id: 'warning-beacon',
    label: 'Test Warning Beacon',
    feedback: 'Warning beacon responds. Visual warning check passes in this scenario.',
  },
  {
    id: 'backup-alarm',
    label: 'Test Backup Alarm',
    feedback: 'Backup alarm responds. Reverse warning check passes in this scenario.',
  },
]

export const defectRecognitionScenarios = [
  {
    id: 'leaking-oil',
    title: 'Scenario 1: Obvious defect - leaking oil',
    visualState: 'oil-leak',
    question: 'Is this forklift usable for operation?',
    choices: ['Yes', 'No'],
    answer: 'No',
    feedback:
      'Visible fluid leaks may indicate engine oil, hydraulic oil, coolant, or battery electrolyte problems. The forklift should not be used until the issue is reported and cleared.',
  },
  {
    id: 'good-forklift',
    title: 'Scenario 2: Good forklift',
    visualState: 'normal',
    question: 'Is this forklift usable for operation?',
    choices: ['Yes', 'No'],
    answer: 'Yes',
    feedback:
      'If the walk-around inspection and engine-on controls show no unsafe condition, the forklift may proceed to supervised training use.',
  },
  {
    id: 'flat-tire',
    title: 'Scenario 3: Worn-out or flat tire',
    visualState: 'flat-tire',
    question: 'Is this forklift usable for operation?',
    choices: ['Yes', 'No'],
    answer: 'No',
    feedback:
      'Unsafe tire condition affects steering and stability. The forklift must not be used until the issue is reported and corrected.',
  },
]
