export const engineOffInspectionChecks = [
  {
    id: 'forks',
    label: 'Forks',
    targetArea: 'Fork blades and heel',
    inspect: 'Check fork tips, heel area, and mounting pins for cracks, bending, or wear.',
    found: 'Forks show no visible cracks, bending, or wear in this inspection state.',
    status: 'safe',
    feedback: 'Damaged or bent forks can fail under load and must be reported before use.',
  },
  {
    id: 'mast',
    label: 'Mast Assembly',
    targetArea: 'Mast and lift channels',
    inspect: 'Inspect the mast channels and lift path for cracks, bending, or obstruction.',
    found: 'No mast crack or damage is visible in this inspection state.',
    status: 'safe',
    feedback: 'A cracked or damaged mast can make lifting unsafe and must be reported.',
  },
  {
    id: 'lift-chain',
    label: 'Lift Chains',
    targetArea: 'Lift chain and rollers',
    inspect: 'Check the lift chains for proper lubrication and any broken, stretched, or damaged links.',
    found: 'Lift chains appear properly lubricated with no visible damage.',
    status: 'safe',
    feedback: 'Damaged, dry, or stretched chains must be reported before lifting operations.',
  },
  {
    id: 'hydraulic-hoses',
    label: 'Hydraulic Hoses',
    targetArea: 'Hydraulic hoses and cylinders',
    inspect: 'Check hydraulic hoses and cylinders for visible leaks, cracks, or wear.',
    found: 'No hydraulic leak is visible in this inspection state.',
    status: 'safe',
    feedback: 'Hydraulic leaks can affect lifting safety and must be reported before operation.',
  },
  {
    id: 'tires',
    label: 'Tires and Wheels',
    targetArea: 'Tires and wheel nuts',
    inspect: 'Check tire condition, wheel nuts, and tire pressure (for pneumatic tires).',
    found: 'Tires and wheel nuts appear acceptable in this inspection state.',
    status: 'safe',
    feedback: 'Unsafe tire condition or loose wheel nuts affect steering and stability.',
  },
  {
    id: 'counterweight',
    label: 'Counterweight',
    targetArea: 'Rear counterweight',
    inspect: 'Check the counterweight mounting and rear clearance for visible damage.',
    found: 'Counterweight mounting appears secure in this inspection state.',
    status: 'safe',
    feedback: 'A loose or damaged counterweight affects forklift balance and must be reported.',
  },
  {
    id: 'lpg-tank',
    label: 'LPG Tank and Battery',
    targetArea: 'LPG tank, mounting bracket, and battery area',
    inspect: 'Check the propane tank, mounting bracket, hose fittings, and battery area for leaks, damage, or corrosion.',
    found: 'No LPG leak, damaged mounting, or battery concern is visible in this inspection state.',
    status: 'safe',
    feedback: 'A propane leak or unsafe battery condition is hazardous and must be reported before operation.',
  },
  {
    id: 'seat-belt',
    label: 'Seat Belt',
    targetArea: 'Operator seat and restraint',
    inspect: 'Check the seat condition and confirm the seat belt latches and retracts properly.',
    found: 'Seat and seat belt appear in working condition in this inspection state.',
    status: 'safe',
    feedback: 'A damaged or non-functioning seat belt must be reported before operation.',
  },
  {
    id: 'overhead-guard',
    label: 'Overhead Guard',
    targetArea: 'Overhead guard structure',
    inspect: 'Check the overhead guard for bending, cracks, or missing sections.',
    found: 'The overhead guard shows no visible structural damage in this inspection state.',
    status: 'safe',
    feedback: 'A damaged overhead guard reduces operator protection and must be reported.',
  },
  {
    id: 'ground-leaks',
    label: 'Ground Leaks',
    targetArea: 'Ground beneath the forklift',
    inspect: 'Check the ground beneath the forklift for oil, fuel, hydraulic fluid, or coolant leaks.',
    found: 'No fluid leak is visible on the ground in this inspection state.',
    status: 'safe',
    feedback: 'Any fluid leak on the ground must be reported before operation.',
  },
]

// Each gauge is a judgment call, not a click-to-confirm. `dialAngle` places the
// needle (-45 = low end of the dial, 45 = high end) and `answer` is the correct
// Normal/Abnormal call for that reading.
export const engineOnGaugeChecks = [
  {
    id: 'warning-lights',
    label: 'Warning Lights',
    reading: 'No warning lights active',
    dialAngle: -30,
    answer: 'Normal',
    image: '/images/parts/warning-lights.jpeg',
    correctFeedback: 'Correct. No warning light is lit, so the forklift is clear to continue the check.',
    incorrectFeedback: 'A dashboard with no active warning light is a normal reading.',
  },
  {
    id: 'battery-charge-indicator',
    label: 'Battery Charge Indicator',
    reading: 'Charge warning light stays lit',
    dialAngle: -42,
    answer: 'Abnormal',
    image: '/images/parts/battery-charge-indicator.avif',
    correctFeedback: 'Correct. A charge light that stays on means the charging system is not keeping up. Report it.',
    incorrectFeedback: 'A charge warning that stays lit is abnormal. It means the battery is not charging.',
  },
  {
    id: 'lpg-level-gauge',
    label: 'LPG Level Gauge',
    reading: 'Sufficient LPG level',
    dialAngle: 24,
    answer: 'Normal',
    image: '/images/parts/lpg-level-gauge.jfif',
    correctFeedback: 'Correct. There is enough LPG to complete the shift.',
    incorrectFeedback: 'A sufficient LPG level is a normal reading. Only a near-empty tank needs action.',
  },
  {
    id: 'hour-meter',
    label: 'Hour Meter',
    reading: 'Reading logged for maintenance tracking',
    dialAngle: 0,
    answer: 'Normal',
    image: '/images/parts/hour-meter.jfif',
    correctFeedback: 'Correct. The hour meter is a record, not a fault indicator. Log it and continue.',
    incorrectFeedback: 'The hour meter only records running hours. Logging the reading is a normal step.',
  },
  {
    id: 'engine-temperature-gauge',
    label: 'Engine Temperature Gauge',
    reading: 'Needle in the red zone',
    dialAngle: 44,
    answer: 'Abnormal',
    image: '/images/parts/engine-temperature-gauge.webp',
    correctFeedback: 'Correct. An overheating engine must be shut down and reported before operation.',
    incorrectFeedback: 'A needle in the red zone means overheating. That is an abnormal reading and must be reported.',
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
    id: 'tail-lights',
    label: 'Test Tail Lights',
    feedback: 'Tail lights respond. Lighting check passes in this scenario.',
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

export const engineOnControlChecks = [
  {
    id: 'steering-response',
    label: 'Steering Response',
    feedback: 'Steering responds smoothly with no excessive play in this training scenario.',
  },
  {
    id: 'brakes',
    label: 'Brakes',
    feedback: 'Service brake and parking brake respond correctly in this training scenario.',
  },
  {
    id: 'lift-tilt-functions',
    label: 'Lift and Tilt Functions',
    feedback: 'Mast raises, lowers, and tilts smoothly with no unusual noise in this training scenario.',
  },
  {
    id: 'forward-reverse-travel',
    label: 'Forward/Reverse Travel',
    feedback: 'Forward/reverse selector and accelerator respond correctly in this training scenario.',
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
