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

// The Defect Recognition Test's stock forklifts (docs/modules/
// module-improvements-plan.md, 3.4; the shape is in lib/walkAroundStep.js).
// Every question type and both views, and three good forklifts, so "No" is
// not always right. Learners meet them shuffled, titled "Forklift 3 of 10";
// `defects` are data/defectLibrary.js ids. Question text is left blank, so
// each type's own question shows in the learner's language.
const REPORT = 'Report it and tag the forklift out of service'

export const defectRecognitionScenarios = [
  {
    id: 'good-forklift',
    view: 'exterior',
    defects: [],
    question: { type: 'usable', prompt: '', choices: ['Yes', 'No'], answer: 'Yes' },
    demo: null,
    feedback: 'Nothing on this forklift is damaged, loose or leaking. With the rest of the pre-operation check passed, it may be used.',
  },
  {
    id: 'engine-oil-leak',
    view: 'exterior',
    defects: ['engine-oil-leak'],
    question: { type: 'usable', prompt: '', choices: ['Yes', 'No'], answer: 'No' },
    demo: null,
    feedback: 'There is fresh oil under the engine, still dripping. Any fluid leak means the forklift must not be used until it is reported and fixed.',
  },
  {
    id: 'flat-front-tyre',
    view: 'exterior',
    defects: ['flat-front-tyre'],
    question: {
      type: 'identify',
      prompt: '',
      choices: ['A flat front tyre', 'A hydraulic hose leak', 'A bent fork', 'Nothing, it is fine'],
      answer: 'A flat front tyre',
    },
    demo: null,
    feedback: 'The left front tyre is flat and the truck leans toward it. A flat tyre upsets steering and stability, so the forklift must not be used.',
  },
  {
    id: 'bent-fork-tip',
    view: 'exterior',
    defects: ['bent-fork-tip'],
    question: { type: 'locate', prompt: '', choices: [], answer: 'forks' },
    demo: null,
    feedback: 'The left fork droops at its tip. A bent fork can drop or tip a load, so the forklift must be reported and taken out of service.',
  },
  {
    id: 'mast-channel-crack',
    view: 'exterior',
    defects: ['mast-channel-crack'],
    question: { type: 'locate', prompt: '', choices: [], answer: 'mast' },
    demo: null,
    feedback: 'There is a crack in the left mast channel. A cracked mast can fail under load: report it before anyone lifts with this forklift.',
  },
  {
    id: 'lpg-leak',
    view: 'exterior',
    defects: ['lpg-leak'],
    question: {
      type: 'action',
      prompt: '',
      choices: [REPORT, 'Use it carefully until the end of the shift', 'Tighten the fitting yourself and carry on'],
      answer: REPORT,
    },
    demo: null,
    feedback: 'Gas is hissing from the tank fitting and frost has formed on it. An LPG leak is a fire risk: keep sparks away, report it and tag the forklift out. Repairs are for maintenance, not the operator.',
  },
  {
    id: 'good-forklift-brakes',
    view: 'exterior',
    defects: [],
    question: { type: 'usable', prompt: '', choices: ['Yes', 'No'], answer: 'Yes' },
    demo: 'brake-test',
    feedback: 'The forklift stops promptly and squarely in the brake test, and nothing else is wrong. It may be used.',
  },
  {
    id: 'uneven-lift-chains',
    view: 'exterior',
    defects: ['uneven-lift-chains'],
    question: {
      type: 'identify',
      prompt: '',
      choices: ['One lift chain is slack and the carriage hangs low', 'The mast is stuck tilted forward', 'A fork tip is bent', 'Nothing, it is fine'],
      answer: 'One lift chain is slack and the carriage hangs low',
    },
    demo: null,
    feedback: 'The left lift chain is slack and that side of the carriage hangs lower. Uneven chains can let a load slide or a chain fail: report it.',
  },
  {
    id: 'brake-fade',
    view: 'cab',
    defects: ['brake-fade'],
    question: { type: 'usable', prompt: '', choices: ['Yes', 'No'], answer: 'No' },
    demo: null,
    feedback: 'The brakes grind and take about twice as far to stop the truck. Brakes that fade must be reported before the forklift is used.',
  },
  {
    id: 'seatbelt-wont-latch',
    view: 'cab',
    defects: ['seatbelt-wont-latch'],
    question: {
      type: 'identify',
      prompt: '',
      choices: ['The seat belt will not latch', 'The parking brake will not release', 'The battery is flat', 'Nothing, it is fine'],
      answer: 'The seat belt will not latch',
    },
    demo: null,
    feedback: 'The seat belt springs open again and its lamp stays lit, so the truck will not start. A seat belt that does not latch must be reported.',
  },
  {
    id: 'engine-overheating',
    view: 'cab',
    defects: ['engine-overheating'],
    question: {
      type: 'action',
      prompt: '',
      choices: [REPORT, 'Let it cool down, then carry on working', 'Top up the coolant yourself and carry on'],
      answer: REPORT,
    },
    demo: null,
    feedback: 'The temperature needle climbs into the red and the warning chime sounds. Shut the engine down, report it and tag the forklift out.',
  },
  {
    id: 'good-forklift-cab',
    view: 'cab',
    defects: [],
    question: { type: 'usable', prompt: '', choices: ['Yes', 'No'], answer: 'Yes' },
    demo: null,
    feedback: 'Every lamp goes out after the start, the gauges read normal, and the horn, brakes, steering and lift all work. It may be used.',
  },
]
