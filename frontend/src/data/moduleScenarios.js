export const moduleScenarioSteps = {
  'walk-around-check': [
    {
      id: 'briefing',
      title: 'Scenario Briefing',
      objective: 'Understand the purpose of a forklift walk-around check before operation.',
      instructions:
        'Review why a forklift-specific inspection separates engine-off visual checks from engine-on control checks.',
      hint: 'Think of this as a safety gate before the forklift enters the work area.',
    },
    {
      id: 'engine-off-inspection',
      title: 'Engine-Off Inspection',
      objective: 'Inspect visible components before starting or moving the equipment.',
      instructions:
        'Use hotspots or inspection cards to check forks, mast, lift chains, hydraulic hoses, tires and wheels, counterweight, LPG tank and battery, seat belt, overhead guard, and ground leaks. Start the engine once every area is clear.',
      hint: 'Visible leaks, unsafe tires, or damaged lifting parts should stop operation. The engine is only started after the walk-around is complete.',
    },
    {
      id: 'engine-on-inspection',
      title: 'Engine-On Inspection',
      objective: 'Judge gauge readings and confirm controls respond before entering the work area.',
      instructions:
        'Read each dashboard gauge and decide whether it is normal or abnormal, then test the horn, lights, beacon, backup alarm, steering, brakes, lift and tilt, and travel controls.',
      hint: 'Not every gauge reads normal. A warning light that stays lit or a needle in the red zone must be reported.',
    },
    {
      id: 'defect-recognition',
      title: 'Defect Recognition Test',
      objective: 'Decide if the forklift is usable based on visible scenario conditions.',
      instructions:
        'Review each visual state and choose whether the forklift may be used for operation.',
      hint: 'If a visible condition affects stability, steering, lifting, or fluid safety, choose No.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review completed checks and scenario score.',
      instructions:
        'Confirm that required engine-off checks, engine-on checks, and defect recognition questions are complete.',
      hint: 'Completion means the learner can identify what to inspect and when to report unsafe conditions.',
    },
  ],
  'load-handling': [
    {
      id: 'briefing',
      title: 'Scenario Briefing',
      objective: 'Prepare for a simplified guided driving exercise, without real forklift physics.',
      instructions: 'Review why operational-control familiarization comes before supervised practical training.',
      hint: 'The goal is control familiarization and decision-making, not physics-accurate driving.',
    },
    {
      id: 'controls-intro',
      title: 'Controls & Engine Start',
      objective: 'Learn the WASD driving controls and start the engine.',
      instructions: 'Press E to start the engine, then try W, A, S, and D at least once each on the open practice pad.',
      hint: 'The engine must be running before the forklift will accelerate or steer.',
    },
    {
      id: 'accelerate-course',
      title: 'Accelerate Course',
      objective: 'Practice accelerating the forklift forward using the W key.',
      instructions: 'Press E to start the engine if needed, then press W to accelerate forward to the finish line.',
      hint: 'Hold W steadily - you do not need to reach maximum speed to finish.',
    },
    {
      id: 'accelerate-brake',
      title: 'Accelerate and Brake',
      objective: 'Practice accelerating and braking to a controlled stop.',
      instructions: 'Press W to accelerate, then press S in time to stop inside the marked stop zone.',
      hint: 'Begin braking before you reach the zone - stopping distance is not instant.',
    },
    {
      id: 'turning-practice',
      title: 'Left and Right Turning',
      objective: 'Practice steering left and right while moving.',
      instructions: 'Accelerate with W, then use A and D to steer through the marked gates in order.',
      hint: 'Steering only responds while the forklift is moving.',
    },
    {
      id: 'driving-course',
      title: 'Driving Course',
      objective: 'Combine starting, accelerating, braking, and steering in one guided course.',
      instructions: 'Start the engine, then drive through each checkpoint in order and stop in the final parking bay.',
      hint: 'Take the turns slowly - smooth control matters more than speed.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review completed driving control tasks.',
      instructions: 'Confirm engine start, acceleration, braking, turning, and the combined driving course are complete.',
      hint: 'Completion means you can identify and use the basic forklift operating controls in this simplified simulation.',
    },
  ],
  'post-operation': [
    {
      id: 'briefing',
      title: 'Scenario Briefing',
      objective: 'Understand why shutdown and secure parking are part of safe operation.',
      instructions: 'Review the expected order for parking and securing the forklift.',
      hint: 'A parked forklift can still create hazards if not secured.',
    },
    {
      id: 'shutdown-sequence',
      title: 'Shutdown Sequence',
      objective: 'Place post-operation steps in a safe order.',
      instructions: 'Select actions in order: park level, lower forks, neutral controls, brake, power off, report concerns.',
      hint: 'Lowering forks and securing movement controls are essential before leaving equipment.',
    },
    {
      id: 'reporting',
      title: 'Unsafe Condition Reporting',
      objective: 'Decide what needs to be reported after operation.',
      instructions: 'Review prompts and identify visible damage or unsafe conditions.',
      hint: 'Maintenance is outside this prototype; learners should report concerns to qualified personnel.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review shutdown completion and reporting decisions.',
      instructions: 'Confirm post-operation activities and checkpoint questions are complete.',
      hint: 'Completion means the learner can describe a safe shutdown sequence.',
    },
  ],
}
