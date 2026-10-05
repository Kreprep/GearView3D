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
      instructions:
        'Review how the simulated forklift is started and driven from the seat, and why control familiarization comes before supervised practical training.',
      hint: 'The goal is control familiarization and decision-making before supervised practical training.',
    },
    {
      id: 'controls-intro',
      title: 'Controls & Engine Start',
      objective: 'Learn the start sequence, the driving keys, the horn and the direction lever.',
      instructions:
        'Start the engine the way a real forklift is started: fasten the seatbelt (B), set the parking brake (Space), keep the direction lever in N, then press E. Release the parking brake (Space) and try W, A, S and D at least once each. Sound the horn (H), then click R on the dashboard\'s direction lever and back to Auto.',
      hint: 'The engine will not crank until the seatbelt is fastened, the parking brake is set and the lever is in N - the dashboard marks whatever is missing. With the lever in R, W drives the truck backwards; Auto lets W and S choose the direction again.',
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
      id: 'reverse-travel',
      title: 'Reversing and Looking Behind',
      objective: 'Reverse out of a narrow aisle, looking in the direction of travel.',
      instructions:
        'The forklift is nose-in to a dead end, in an aisle too narrow to turn round in. Reverse out with S, through the aisle and round the bend, and stop at the marked point clear of it. Look behind you while you reverse: in first-person, glance round with the arrow keys or drag the scene; press C for the chase view.',
      hint: 'A rear-steer forklift swings its tail the opposite way to a car when reversing - make small steering corrections and keep the speed down. A sign comes up if you reverse while looking ahead.',
    },
    {
      id: 'speed-zones',
      title: 'Speed Zones and Crossings',
      objective: 'Keep to a speed limit, stop at a stop line and sound the horn at a blind crossing.',
      instructions:
        'This zone has a 5 km/h limit. Stop fully at the stop line, then drive on to the blind crossing between the walls: stop there and sound the horn (H) before crossing, then drive on to the end of the zone.',
      hint: 'The crossing does not clear until you have stopped in it and sounded the horn. Watch the speed on the dashboard - the sign comes up as soon as you go over the limit.',
    },
    {
      id: 'driving-course',
      title: 'Driving Course',
      objective: 'Combine starting, accelerating, braking, steering and reversing through a full course with turns, cone lanes and a mid-course stop.',
      instructions:
        'Start the engine, then drive through each checkpoint in order - weaving through the cone lanes, stopping fully at the yield point and turning past the rack - into the dead end at the far end. Stop there, then reverse out to the last marker, looking behind you.',
      hint: 'Hitting a cone or wall fails the attempt - take the turns slowly. On the turn past the rack the tail swings out toward it, so keep the turn wide.',
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
      instructions:
        'Confirm engine start, acceleration, braking, turning, reversing, the speed zone, the driving course and the pallet pickup task are complete.',
      hint: 'Completion means you can identify and use the basic forklift operating controls in this simplified simulation.',
    },
  ],
  'pallet-testing': [
    {
      id: 'briefing',
      title: 'Scenario Briefing',
      objective: 'Understand rated capacity, load centre, stability and the fail conditions in this assessment.',
      instructions:
        'Review how the capacity plate and the load centre decide what the forklift may lift, why a load slides or a truck tips, and which mistakes fail the attempt.',
      hint: 'The counterweight only balances loads up to the rated capacity on the capacity plate, and less than that when the load sits further out along the forks.',
    },
    {
      id: 'precision-carry',
      title: 'Precision Carry',
      objective: 'Carry a pallet through a cone-lined lane and deliver it without a single fail condition.',
      instructions:
        'Pick up the pallet, carry it low and tilted back down the cone corridor to the drop zone, level the mast with G, lower it with F until it rests on the ground and the forks are free, and reverse straight out. Hitting a cone, losing the load or travelling with the forks raised fails the attempt - use Reset Attempt and try again.',
      hint: 'Ease off W early instead of braking hard at speed: the load is held on the forks only by friction and slides under hard braking, and one that is not seated all the way to the carriage comes off.',
    },
    {
      id: 'load-limits',
      title: 'Load Limits',
      objective: 'Judge which pallet is within the rated capacity and deliver it safely.',
      instructions:
        'Three pallets are labelled with their weight. The capacity plate on the dashboard shows what the forklift may lift. Lift a pallet within capacity and deliver it to the drop zone. Lifting the overweight pallet fails the attempt.',
      hint: 'Read the weight labels before driving in - the heaviest pallet is over the rated capacity, and the plate shows it the moment the forks take its weight.',
    },
    {
      id: 'load-centre',
      title: 'Reading the Load Chart',
      objective: 'Judge a load by its load centre as well as its weight, and deliver the one the forklift may lift.',
      instructions:
        'Both pallets weigh the same, but one load sits toward the far end of its pallet. Read each label: the load centre is how far the load\'s weight sits from the fork face. Lift the pallet that is within the capacity plate at its load centre and deliver it to the drop zone. Lifting the other fails as an overload.',
      hint: 'The rated capacity holds at the rated load centre (0.6 m). The further out the load sits, the less the forklift may lift - the dashboard\'s capacity plate shows the limit for the load on the forks.',
    },
    {
      id: 'stability-turns',
      title: 'Turning with a Load',
      objective: 'Carry a near-rated load round a curve and an S-bend without tipping the truck or losing the load.',
      instructions:
        'Pick up the pallet and carry it low and tilted back down the corridor, round the curve and the S-bend, to the drop zone, then set it down and reverse out. Slow down before each turn, not in it.',
      hint: 'A heavy load raises the risk of a sideways tip in a turn - more so with the forks high or at speed. If the tip-risk or load-shifting sign comes up, ease off and straighten up.',
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
      id: 'rack-retrieval',
      title: 'Retrieving from the Top Shelf',
      objective: 'Take a pallet off the top shelf, lower it before travelling and deliver it to the dock.',
      instructions:
        'Stop in front of the rack and raise the level forks to the pockets of the pallet on the top shelf. Drive in until the rack stops the truck, raise the pallet just clear of the shelf, tilt back a little with T and reverse straight out. Stop, lower it to travel height with F, then reverse to the dock behind you, set it down and back away.',
      hint: 'Do not tilt forward with the load raised, and do not lift or lower while the truck is moving - stop first. Travelling with the forks raised fails the attempt.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review the assessment results.',
      instructions:
        'Confirm the precision carry, the load limit and load chart exercises, the turns with a load and the rack storage and retrieval exercises are complete.',
      hint: 'Completion means you can plan a safe carry, refuse a load over the capacity at its load centre, take turns safely with a load, and store and retrieve a pallet at any rack level.',
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
      hint: 'The status badge at the top tells you which parking requirement is still missing. A forks-raised sign comes up if you park with the forks up.',
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
