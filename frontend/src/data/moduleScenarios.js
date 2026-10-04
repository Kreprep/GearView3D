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
      objective: 'Spot defects on the forklift and decide what to do about them.',
      instructions:
        'Each forklift may have a defect, or none. Look it over from every side, or check it from the seat when asked, then answer its question: whether it may be used, what is wrong, where the defect is, or what you do.',
      hint: "A defect that affects braking, steering, lifting, stability, fluids or the operator's protection means the forklift must not be used: report it and tag it out.",
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
      objective: 'Prepare for a guided driving exercise on a simulated forklift.',
      instructions: 'Review why operational-control familiarization comes before supervised practical training.',
      hint: 'The goal is control familiarization and decision-making before supervised practical training.',
    },
    {
      id: 'controls-intro',
      title: 'Controls & Engine Start',
      objective: 'Learn the start sequence and the WASD driving controls.',
      instructions:
        'Start the engine the way a real forklift is started: fasten the seatbelt (B), set the parking brake (Space), keep the direction lever in N, then press E. Release the parking brake (Space), then try W, A, S, and D at least once each on the open practice pad.',
      hint: 'The engine will not crank until the seatbelt is fastened, the parking brake is set and the lever is in N - the dashboard marks whatever is missing. The truck will not move while the parking brake is on.',
    },
    {
      id: 'accelerate-course',
      title: 'Accelerate Course',
      objective: 'Practice accelerating the forklift forward using the W key.',
      instructions: 'Start the engine if needed (seatbelt B, parking brake Space, then E), release the parking brake with Space, then press W to accelerate forward to the finish line.',
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
      objective: 'Combine starting, accelerating, braking, and steering through a full course with turns, cone lanes, and a mid-course stop.',
      instructions:
        'Start the engine, then drive through each checkpoint in order - weaving through the cone lanes, stopping fully at the yield point, and clearing the boundary walls - before parking in the final bay.',
      hint: 'Hitting a cone or wall fails the attempt just like in Turning Practice - take the turns slowly and keep clear of the lane markers.',
    },
    {
      id: 'pallet-pickup',
      title: 'Pallet Pickup & Placement',
      objective: 'Pick up a pallet with the forks and place it in the marked drop zone.',
      instructions:
        'Drive up to the pallet with the forks lowered (F), slide them all the way into its pockets, raise a little with R to lift, tilt the mast back with T, carry the pallet to the drop zone, level the mast with G, lower with F until the pallet rests on the ground and the forks are free, then reverse straight out.',
      hint: 'Approach the pallet at a crawl and squarely - the forks only go in when they are low, level and lined up with the pockets, and hitting the pallet at speed fails the attempt. To set it down, level the mast first: with the mast tilted back the fork tips stay caught under the load.',
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
      hint: 'The counterweight only balances loads up to the rated capacity on the capacity plate, and less than that when the load sits further out along the forks.',
    },
    {
      id: 'precision-carry',
      title: 'Precision Carry',
      objective: 'Carry a pallet through a cone-lined lane and deliver it without a single fail condition.',
      instructions:
        'Pick up the pallet, carry it low and tilted back down the cone corridor to the drop zone, level the mast with G, lower it with F until it rests on the ground and the forks are free, and reverse straight out. Hitting a cone, losing the load or travelling fast with the forks raised fails the attempt - use Reset Attempt and try again.',
      hint: 'Ease off W early and let the forklift coast instead of slamming S at speed: a load slides on the forks under hard braking, and one that is not seated all the way comes off.',
    },
    {
      id: 'load-limits',
      title: 'Load Limits',
      objective: 'Judge which pallet is within the rated capacity and deliver it safely.',
      instructions:
        'Three pallets are labeled with their weight. The capacity plate on the dashboard shows what the forklift may lift. Lift a pallet within capacity and deliver it to the drop zone. Lifting the overweight pallet fails the attempt.',
      hint: 'Read the weight labels before driving in - the heaviest pallet exceeds the rated capacity.',
    },
    {
      id: 'rack-storage',
      title: 'Rack Storage',
      objective: 'Raise a pallet to its assigned shelf height and store it in the correct rack level.',
      instructions:
        'Pick up the pallet and carry it low to the rack. Stop in front of the bay, raise it with R just above the target shelf, drive in until the rack stops the truck, level the mast with G, lower with F until the load rests on the shelf and the forks are free, then reverse straight out. Racking has a bottom, middle, and top shelf - this exercise is graded on the middle shelf.',
      hint: 'Watch the pallet through the chase camera as you raise it - line it up with the target ring floating at shelf height before driving in, and stop short of the uprights: the forks do the reaching, not the truck.',
    },
    {
      id: 'rack-storage-top',
      title: 'Top Shelf Storage',
      objective: 'Raise a pallet to the top shelf and store it there.',
      instructions:
        'Pick up the pallet and carry it low to the rack. Stop in front of the bay, hold R to raise it just above the top shelf, drive in until the rack stops the truck, level the mast with G, lower with F until the load rests on the shelf and the forks are free, then reverse straight out. This is a fuller lift than the middle shelf, so give the forks time to reach height before driving in.',
      hint: 'Hold R until the carried pallet lines up with the top target ring - it takes longer to reach than the middle shelf.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review the assessment results.',
      instructions: 'Confirm the precision carry, load limit, and rack storage exercises are complete.',
      hint: 'Completion means you can plan a safe carry, refuse an overweight load, and shelve a pallet at any rack level.',
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
        'Drive the cone-lined route to the painted parking bay, straighten up between the lines and stop completely. Then secure the forklift: direction lever in N, forks lowered with F, parking brake set with Space, engine off with E. Hitting a cone fails the attempt.',
      hint: 'The status badge at the top tells you which parking requirement is still missing.',
    },
    {
      id: 'parallel-parking',
      title: 'Parallel Parking',
      objective: 'Ease sideways into a narrow parallel bay between the boundary cones.',
      instructions:
        'Steer into the gap in the left-hand cone line, straighten up so the forklift sits flush with the bay, then stop and secure it: lever in N, forks lowered with F, parking brake set with Space, engine off with E.',
      hint: 'The bay is only slightly wider than the forklift - small steering corrections beat big ones.',
    },
    {
      id: 'forklift-gap-parking',
      title: 'Parking Between Forklifts',
      objective: 'Park in a tight gap between two parked forklifts without clipping either one.',
      instructions:
        'Approach slowly and centered - the parked forklifts on both sides are live obstacles, so drifting toward either one ends the attempt just like hitting a wall. Once stopped, secure the forklift as before: lever in N, forks down, parking brake set, engine off.',
      hint: 'Center up early. There is very little room to correct once you are between the two forklifts.',
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
      instructions: 'Confirm all three parking drives, shutdown ordering, and reporting decisions are complete.',
      hint: 'Completion means the learner can park precisely in tight spaces, then secure and hand over a forklift safely.',
    },
  ],
}
