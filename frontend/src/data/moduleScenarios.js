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
      id: 'pallet-pickup',
      title: 'Pallet Pickup & Placement',
      objective: 'Pick up a pallet with the forks and place it in the marked drop zone.',
      instructions:
        'Drive up to the pallet with the forks lowered (F), slide them under the load, raise with R to lift, carry the pallet to the drop zone, lower with F, then reverse away to release it.',
      hint: 'Approach the pallet slowly and squarely - the forks only engage when they are low and centered under the load.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review completed driving control tasks.',
      instructions: 'Confirm engine start, acceleration, braking, turning, the driving course, and the pallet pickup task are complete.',
      hint: 'Completion means you can identify and use the basic forklift operating controls in this simplified simulation.',
    },
  ],
  'pallet-testing': [
    {
      id: 'briefing',
      title: 'Scenario Briefing',
      objective: 'Understand rated capacity, load stability, and the fail conditions in this assessment.',
      instructions:
        'Review why overloading tips a forklift forward, why cones must never be struck, and why sudden braking throws the load off the forks. Any of these fails the attempt.',
      hint: 'The counterweight only balances loads up to the rated capacity shown in the HUD.',
    },
    {
      id: 'precision-carry',
      title: 'Precision Carry',
      objective: 'Carry a pallet through a cone-lined lane and deliver it without a single fail condition.',
      instructions:
        'Pick up the pallet, carry it down the cone corridor to the drop zone, lower it with F, and reverse away. Hitting a cone or braking hard while carrying fails the attempt - use Reset Attempt and try again.',
      hint: 'Ease off W early and let the forklift coast instead of slamming S at speed.',
    },
    {
      id: 'load-limits',
      title: 'Load Limits',
      objective: 'Judge which pallet is within the rated capacity and deliver it safely.',
      instructions:
        'Three pallets are labeled with their weight. The forklift capacity is shown in the HUD. Lift a pallet within capacity and deliver it to the drop zone. Lifting the overweight pallet will tip the forklift and fail the attempt.',
      hint: 'Read the weight labels before driving in - the heaviest pallet exceeds the rated capacity.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review the assessment results.',
      instructions: 'Confirm the precision carry and load limit exercises are complete.',
      hint: 'Completion means you can plan a safe carry and refuse an overweight load.',
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
      id: 'secure-parking',
      title: 'Secure Parking',
      objective: 'Park the forklift inside the painted bay without striking a cone.',
      instructions:
        'Drive the cone-lined route to the painted parking bay, straighten up between the lines, stop completely, lower the forks with F, then switch the engine off with E. Hitting a cone fails the attempt.',
      hint: 'The status badge at the top tells you which parking requirement is still missing.',
    },
    {
      id: 'shutdown-sequence',
      title: 'Shutdown Sequence',
      objective: 'Place post-operation steps in a safe order.',
      instructions:
        'Select the six shutdown actions in the correct order: park level, lower forks, neutral controls, parking brake, power off, then report concerns. Wrong picks are counted.',
      hint: 'Lowering forks and securing movement controls are essential before leaving equipment.',
    },
    {
      id: 'reporting',
      title: 'Unsafe Condition Reporting',
      objective: 'Decide what needs to be reported after operation.',
      instructions:
        'For each end-of-shift condition, choose Report or No Action. Correct every card to complete the step.',
      hint: 'Maintenance is outside this prototype; learners should report concerns to qualified personnel.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review parking, shutdown, and reporting results.',
      instructions: 'Confirm the secure parking drive, shutdown ordering, and reporting decisions are complete.',
      hint: 'Completion means the learner can park, secure, and hand over a forklift safely.',
    },
  ],
}
