export const forkliftEquipment = {
  id: 'forklift',
  title: 'Forklift',
  description: 'Learn safe forklift familiarization through guided lessons and a labeled 3D model.',
  modelUrl: '/models/Forklift_SEPERATED.glb',
}

export const equipmentUsageModules = [
  {
    id: 1,
    slug: 'walk-around-check',
    title: 'Walk-Around Check',
    fullTitle: 'Walk-Around Check (Visual Inspection)',
    subtitle: 'Visual Inspection',
    description:
      'Inspect the forklift before use by checking leaks, tires, mast, forks, gauges, lights, horn, brakes, and warning devices.',
    syllabusLocation: 'Section 2',
    unitCode: 'CON833309',
    unitTitle: 'Perform pre- and post-operation procedures for lifting equipment',
    element: 'Element 1: Perform visual check of equipment',
    pageReferences: 'pp. 38, 41-42',
    learningObjectives: [
      'Differentiate engine-off and engine-on inspection tasks.',
      'Recognize visible defects that make a forklift unsafe to use.',
      'Practice reporting unsafe conditions before operation.',
    ],
    lessonContent: [
      'Forklift walk-around inspection adapts familiar vehicle inspection routines into equipment-specific safety checks.',
      'Engine-off checks focus on leaks, fluids, tires, mast, forks, carriage, and visible structural condition.',
      'Engine-on checks confirm gauges, warning indicators, horn, lights, beacon, and backup alarm before entering the work area.',
    ],
    interactiveActivities: [
      'Engine-off hotspot inspection',
      'Engine-on gauge and safety device testing',
      'Defect recognition scenarios',
    ],
    checkpointQuestions: [
      {
        id: 'walk-fluid-leaks',
        prompt: 'What should be checked during a walk-around inspection?',
        options: ['Fluid leaks', 'Lunch schedule', 'Paint color', 'Radio volume'],
        answer: 'Fluid leaks',
      },
      {
        id: 'walk-warning-devices',
        prompt: 'Which devices should be tested before operation?',
        options: ['Horn and lights', 'Cup holder', 'Seat fabric', 'Dashboard color'],
        answer: 'Horn and lights',
      },
      {
        id: 'walk-tires',
        prompt: 'Why inspect tires before operation?',
        options: ['They affect stability and steering', 'They change the training score', 'They control the horn', 'They identify the operator'],
        answer: 'They affect stability and steering',
      },
    ],
    checklist: [
      'Check for engine oil, hydraulic oil, coolant, and battery leaks.',
      'Inspect tires for damage, wear, or unsafe condition.',
      'Check forks, mast, carriage, and lift chain for visible damage.',
      'Confirm horn, lights, warning beacon, and backup alarm are working.',
      'Check gauges and dashboard indicators before operation.',
      'Confirm brakes, steering, and controls respond before entering the work area.',
    ],
    completionRequirements: [
      'Complete all engine-off inspection checks.',
      'Complete all engine-on control and safety device tests.',
      'Pass all three defect recognition scenarios.',
    ],
    progressKeys: {
      checklist: 'walk-around-check',
      engineOff: 'walkAround.engineOffChecks',
      engineOn: 'walkAround.engineOnChecks',
      scenarioScore: 'walkAround.scenarioScore',
      completion: 'walkAround.complete',
    },
  },
  {
    id: 2,
    slug: 'load-handling',
    title: 'Load Handling and Operational Controls',
    fullTitle: 'Load Handling and Operational Controls',
    subtitle: 'Operational Controls',
    description:
      'Practice safe load handling concepts including positioning, stability, hydraulic controls, visibility, and worksite hazard awareness.',
    syllabusLocation: 'Section 2',
    unitCode: '505833315',
    unitTitle: 'Perform productive operation for forklift',
    element: 'Element 4: Perform load handling operation',
    pageReferences: 'pp. 55, 57-58',
    learningObjectives: [
      'Apply safe maneuvering and positioning concepts before handling a load.',
      'Explain how the stability triangle and center of gravity affect forklift operation.',
      'Identify correct hydraulic lever use and worksite hazard checks.',
    ],
    lessonContent: [
      'Load handling begins before lifting: the operator must approach slowly, squarely, and with clear visibility.',
      'The stability triangle helps explain why loads must stay centered, low, and within rated capacity.',
      'Hydraulic controls should be used smoothly and only after the path and surrounding area are checked.',
    ],
    interactiveActivities: [
      'Maneuvering and positioning decision task',
      'Stability triangle center-of-gravity diagram',
      'Hydraulic lever control panel',
      'Operational area hazard survey',
    ],
    checkpointQuestions: [
      {
        id: 'load-approach',
        prompt: 'How should the forklift approach a load?',
        options: ['Slowly and squarely', 'Quickly at an angle', 'With raised forks', 'Without checking the path'],
        answer: 'Slowly and squarely',
      },
      {
        id: 'load-travel',
        prompt: 'How should a forklift travel with a load?',
        options: ['With the load low', 'With the load high', 'With sudden turns', 'With blocked visibility'],
        answer: 'With the load low',
      },
      {
        id: 'load-capacity',
        prompt: 'What should be respected before lifting?',
        options: ['Rated capacity plate', 'Paint finish', 'Operator preference', 'Parking location only'],
        answer: 'Rated capacity plate',
      },
    ],
    checklist: [
      'Approach the load slowly and squarely.',
      'Set forks to the correct height before entering the pallet.',
      'Keep the load centered and stable on the forks.',
      'Tilt the mast slightly back after lifting the load.',
      'Travel with the load low and maintain clear visibility.',
      'Follow safe load handling practices.',
    ],
    completionRequirements: [
      'Complete positioning and stability activities.',
      'Complete hydraulic control practice.',
      'Complete the operational area safety survey.',
      'Pass the checkpoint questions.',
    ],
    progressKeys: {
      checklist: 'load-handling',
      positioning: 'loadHandling.positioning',
      stability: 'loadHandling.stability',
      controls: 'loadHandling.controls',
      hazardSurvey: 'loadHandling.hazardSurvey',
      completion: 'loadHandling.complete',
    },
  },
  {
    id: 3,
    slug: 'post-operation',
    title: 'Post-Operation and Secure Parking',
    fullTitle: 'Post-Operation and Secure Parking',
    subtitle: 'Secure Parking',
    description:
      'Follow safe parking and shutdown steps after operation, including level parking, fork lowering, neutral controls, brake engagement, and reporting.',
    syllabusLocation: 'Section 2',
    unitCode: 'CON833309',
    unitTitle: 'Perform pre- and post-operation procedures for lifting equipment',
    element: 'Post-operation procedure and equipment securing',
    pageReferences: 'pp. 38, 41-42',
    learningObjectives: [
      'Sequence safe parking and shutdown actions.',
      'Identify why forks, controls, and parking brake must be secured.',
      'Recognize when unsafe conditions should be reported after operation.',
    ],
    lessonContent: [
      'Post-operation discipline prevents parked forklifts from becoming hazards.',
      'Forks should be lowered, controls set to neutral, and the parking brake engaged before leaving the equipment.',
      'Any unsafe condition or visible damage should be reported for qualified follow-up.',
    ],
    interactiveActivities: [
      'Shutdown sequence ordering',
      'Secure parking checklist',
      'Unsafe condition reporting prompt',
    ],
    checkpointQuestions: [
      {
        id: 'post-forks',
        prompt: 'What should be done to the forks after operation?',
        options: ['Lower them completely', 'Leave them raised', 'Remove them', 'Paint them'],
        answer: 'Lower them completely',
      },
      {
        id: 'post-controls',
        prompt: 'Where should controls be placed during shutdown?',
        options: ['Neutral', 'Reverse', 'Lift position', 'Tilt position'],
        answer: 'Neutral',
      },
      {
        id: 'post-report',
        prompt: 'What should be reported after operation?',
        options: ['Unsafe conditions or visible damage', 'Only the weather', 'Only the operator name', 'Nothing ever'],
        answer: 'Unsafe conditions or visible damage',
      },
    ],
    checklist: [
      'Park on a level surface.',
      'Lower forks completely.',
      'Set controls to neutral.',
      'Engage the parking brake.',
      'Turn off the equipment.',
      'Report unsafe conditions or visible damage.',
    ],
    completionRequirements: [
      'Complete the secure parking checklist.',
      'Complete the shutdown ordering activity.',
      'Pass the checkpoint questions.',
    ],
    progressKeys: {
      checklist: 'post-operation',
      shutdownSequence: 'postOperation.shutdownSequence',
      reporting: 'postOperation.reporting',
      completion: 'postOperation.complete',
    },
  },
]

export const trainingModules = equipmentUsageModules.map((module) => ({
  id: module.id,
  slug: module.slug,
  title: module.title,
  subtitle: module.subtitle,
  description: module.description,
}))

export const moduleChecklists = equipmentUsageModules.reduce((checklists, module) => {
  checklists[module.slug] = module.checklist
  return checklists
}, {})

export const moduleQuizQuestions = equipmentUsageModules.reduce((questions, module) => {
  questions[module.slug] = module.checkpointQuestions
  return questions
}, {})
