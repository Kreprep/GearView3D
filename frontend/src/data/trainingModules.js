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
      'Inspect a Class V (LPG) forklift before use: forks, mast, chains, hydraulic hoses, tires, counterweight, LPG tank/battery, seat belt, overhead guard, and ground leaks, then confirm dashboard indicators, steering, brakes, lift/tilt, travel, and warning devices.',
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
      'Engine-off checks cover forks, mast, lift chains, hydraulic hoses, tires and wheels, counterweight, LPG tank and battery, seat belt, overhead guard, and ground leaks.',
      'Engine-on checks confirm dashboard indicators, steering, brakes, lift and tilt functions, forward/reverse travel, horn, lights, beacon, and backup alarm before entering the work area.',
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
      'Practice basic forklift operational controls in a simplified guided drive: engine start-up, acceleration, braking, and steering, without real vehicle physics or collision.',
    syllabusLocation: 'Section 2',
    unitCode: '505833315',
    unitTitle: 'Perform productive operation for forklift',
    element: 'Element 4: Perform load handling operation',
    pageReferences: 'pp. 55, 57-58',
    learningObjectives: [
      'Identify the basic operating controls used to start and drive a forklift in this simulation.',
      'Practice accelerating and braking smoothly to control forklift speed.',
      'Practice steering left and right while maintaining a safe course.',
      'Combine starting, accelerating, braking, and steering in a short guided driving course.',
    ],
    lessonContent: [
      'This simplified simulation lets you practice the basic operating controls of a forklift: starting the engine, accelerating, braking, and steering.',
      'This is a simplified control-familiarization exercise, not a physics-accurate driving simulator. It does not model collisions, real vehicle dynamics, or unsupervised operation.',
      'Each guided step introduces one control at a time before combining them in a short driving course.',
    ],
    interactiveActivities: [
      'Controls orientation and engine start practice',
      'Guided acceleration course',
      'Guided acceleration and braking course',
      'Steering left/right practice course',
      'Combined guided driving course',
    ],
    checkpointQuestions: [
      {
        id: 'engine-start-key',
        prompt: 'Which key starts the engine in this simulation?',
        options: ['E', 'W', 'S', 'A'],
        answer: 'E',
      },
      {
        id: 'accelerate-key',
        prompt: 'Which key accelerates the forklift forward?',
        options: ['W', 'S', 'A', 'D'],
        answer: 'W',
      },
      {
        id: 'brake-key',
        prompt: 'Which key slows down or stops the forklift?',
        options: ['S', 'W', 'A', 'D'],
        answer: 'S',
      },
    ],
    checklist: [
      'Start the engine before attempting to move.',
      'Accelerate smoothly using the forward control.',
      'Brake smoothly and stop within the marked zone.',
      'Steer left and right with controlled inputs.',
      'Complete the combined guided driving course.',
    ],
    completionRequirements: [
      'Start the engine.',
      'Complete the acceleration course.',
      'Complete the acceleration and braking course.',
      'Complete the turning practice course.',
      'Complete the combined driving course.',
    ],
    progressKeys: {
      checklist: 'load-handling',
      engineStart: 'loadHandling.engineStart',
      accelerate: 'loadHandling.accelerate',
      brake: 'loadHandling.brake',
      turning: 'loadHandling.turning',
      drivingCourse: 'loadHandling.drivingCourse',
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
