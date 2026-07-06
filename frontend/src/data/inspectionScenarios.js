export const engineOffInspectionChecks = [
  {
    id: 'engine-oil',
    label: 'Engine Oil',
    targetArea: 'Engine bay / underside',
    inspect: 'Check for engine oil leakage around the engine bay and underside.',
    found: 'No engine oil leak is visible in the normal condition.',
    status: 'safe',
    feedback: 'Engine oil leaks must be reported before operation.',
  },
  {
    id: 'hydraulic-oil',
    label: 'Hydraulic Oil',
    targetArea: 'Lift system / hydraulic lines',
    inspect: 'Check hydraulic lines and lift areas for visible hydraulic oil leakage.',
    found: 'No hydraulic oil leak is visible in the normal condition.',
    status: 'safe',
    feedback: 'Hydraulic oil leaks can affect lifting safety and must be reported.',
  },
  {
    id: 'battery-electrolyte',
    label: 'Battery Electrolyte',
    targetArea: 'Battery area',
    inspect: 'Look for electrolyte leakage, corrosion, or unsafe battery condition.',
    found: 'No battery electrolyte leak is shown.',
    status: 'safe',
    feedback: 'Battery electrolyte is hazardous. Do not operate or touch unsafe battery conditions.',
  },
  {
    id: 'coolant',
    label: 'Cooling System / Coolant',
    targetArea: 'Cooling system',
    inspect: 'Check coolant areas for visible leakage or unsafe condition.',
    found: 'No coolant leak is visible in the normal condition.',
    status: 'safe',
    feedback: 'Coolant leaks must be reported before operation.',
  },
  {
    id: 'mast-cracks',
    label: 'Mast Assembly Cracks',
    targetArea: 'Mast',
    inspect: 'Inspect mast channels, lift chain path, and visible structural areas for cracks or damage.',
    found: 'No mast crack is shown in the normal inspection state.',
    status: 'safe',
    feedback: 'A damaged mast or lift chain path can make lifting unsafe.',
  },
  {
    id: 'tire-condition',
    label: 'Tire Wear / Inflation',
    targetArea: 'Tires',
    inspect: 'Check for tire wear, cuts, inflation issues, flat tire condition, or visible tire damage.',
    found: 'The tires appear usable in this guided inspection state.',
    status: 'safe',
    feedback: 'Tire condition affects stability and steering.',
  },
  {
    id: 'structural-bolts',
    label: 'Loose or Missing Bolts',
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

export const walkAroundDefects = [
  {
    id: 'fluid-leak',
    title: 'Random Defect: Fluid leak',
    visualState: 'oil-leak',
    label: 'Fluid leak',
    choices: ['Fluid leak', 'Unsafe tire', 'Mast crack', 'Loose or missing bolt'],
    feedback: 'Visible fluid leaks may indicate engine oil, hydraulic oil, coolant, or battery electrolyte problems. The forklift must be reported before operation.',
  },
  {
    id: 'unsafe-tire',
    title: 'Random Defect: Flat or worn tire',
    visualState: 'flat-tire',
    label: 'Unsafe tire',
    choices: ['Fluid leak', 'Unsafe tire', 'Mast crack', 'Loose or missing bolt'],
    feedback: 'Unsafe tire condition affects steering and stability. Report it before operation.',
  },
  {
    id: 'mast-crack',
    title: 'Random Defect: Mast crack',
    visualState: 'mast-crack',
    label: 'Mast crack',
    choices: ['Fluid leak', 'Unsafe tire', 'Mast crack', 'Loose or missing bolt'],
    feedback: 'Mast assembly cracks can make lifting unsafe. Report the defect immediately.',
  },
  {
    id: 'loose-bolt',
    title: 'Random Defect: Loose or missing bolt',
    visualState: 'loose-bolt',
    label: 'Loose or missing bolt',
    choices: ['Fluid leak', 'Unsafe tire', 'Mast crack', 'Loose or missing bolt'],
    feedback: 'Loose or missing structural bolts must be reported before operation.',
  },
]
