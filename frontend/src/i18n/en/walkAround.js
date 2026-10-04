// The three walk-around inspection phases and their task panels.
//
// Note what is NOT here: scenario titles, questions, choices, feedback, gauge
// labels and readings, and device labels all come from the Course row an admin
// authored. Those stay in whatever language the admin wrote them.
export default {
  // Phase names. lib/walkAroundStep.js maps a phase to one of these keys, and
  // that map doubles as the "is this a real phase" check - so a phase with no
  // entry is what renders `walkAround.noPhase`.
  'walkAround.phase.engineOff': 'Engine-off inspection',
  'walkAround.phase.engineOn': 'Engine-on inspection',
  'walkAround.phase.defectTest': 'Defect recognition',

  'walkAround.checks.intro': 'Click each inspection card to inspect that area and save progress.',
  'walkAround.checks.empty': 'This step has no inspection checks yet.',
  'walkAround.startEngine': 'Start engine',
  'walkAround.startEngineHint': 'Walk-around complete. Turn the key here or click the ignition on the model.',

  'walkAround.devices.safety': 'Safety devices',
  'walkAround.devices.controls': 'Operational controls',

  'walkAround.gauges.heading': 'Dashboard indicators',
  // The gauge choices. The *label* is translated; the value saved to progress
  // and compared against the admin's answer key stays English - see
  // GAUGE_CHOICES in lib/walkAroundStep.js.
  'walkAround.gauges.normal': 'Normal',
  'walkAround.gauges.abnormal': 'Abnormal',
  'walkAround.gauges.correct': 'Correct',
  'walkAround.gauges.reread': 'Re-read this gauge',
  'walkAround.gauges.score': 'Gauge readings correct: {correct}/{total}',

  // The engine-on step in the cab (components/inspection/): its checklist in
  // four groups, the judge popover over the dashboard, and how each device
  // test is done (one line per detector, lib/inspection/detectors.js).
  'walkAround.cab.startup': 'Start-up',
  'walkAround.cab.startup.seatbelt': 'Fasten the seatbelt (B)',
  'walkAround.cab.startup.parkingBrake': 'Set the parking brake (Space)',
  'walkAround.cab.startup.neutral': 'Direction lever in N',
  'walkAround.cab.startup.keyOn': 'Key to ON and watch every warning lamp light for two seconds',
  'walkAround.cab.startup.start': 'Key to START (E)',
  'walkAround.cab.startup.started': 'Engine started. Keep it running for the checks below.',
  'walkAround.cab.instruments': 'Instruments',
  'walkAround.cab.instruments.hint': 'Click each ringed instrument on the dashboard and judge its reading.',
  'walkAround.cab.instruments.waitKey': 'Turn the key to ON to check the warning lamps.',
  'walkAround.cab.instruments.waitStart': 'Start the engine to read the other instruments.',
  'walkAround.cab.instruments.cards': 'Other readings',
  'walkAround.cab.status.pending': 'Not judged yet',
  'walkAround.cab.status.done': 'done',
  'walkAround.cab.status.notDone': 'not done yet',
  'walkAround.cab.judge.question': 'Is this reading normal?',
  'walkAround.cab.judge.close': 'Close',
  'walkAround.cab.detect.marker': 'Click its marker on the truck.',
  'walkAround.cab.detect.lit-marker': 'Switch the lights on (L), then click its marker on the truck in Chase view.',
  'walkAround.cab.detect.horn': "Press H or the dashboard's Horn.",
  'walkAround.cab.detect.lights': 'Switch the lights on (L).',
  'walkAround.cab.detect.beacon': 'Switch the beacon on (O).',
  'walkAround.cab.detect.turn-signals': 'Signal left and right ([ and ]).',
  'walkAround.cab.detect.backup-alarm': 'With the engine running, put the lever in R and listen for the beeper.',
  'walkAround.cab.detect.steer-lock': 'Turn the wheel to full lock each way.',
  'walkAround.cab.detect.brake-test': 'Release the parking brake, creep forward past 2 km/h, then brake to a stop.',
  'walkAround.cab.detect.lift-tilt': 'Raise the forks above 0.5 m and lower them, then tilt the mast fully back and forward.',
  'walkAround.cab.detect.travel': 'Drive half a metre forward, then half a metre in reverse.',

  'walkAround.defects.empty': 'This step has no defect scenarios yet.',
  'walkAround.defects.pickerLabel': 'Defect recognition scenarios',
  'walkAround.defects.playDemo': 'Play demo',
  'walkAround.defects.next': 'Next scenario',
  'walkAround.defects.score': 'Defect recognition score: {correct}/{total}',
  'walkAround.defects.firstScore': 'Right first time: {correct} of {total}',
  'walkAround.defects.title': 'Forklift {n} of {total}',
  'walkAround.defects.status.wrong': 'answered wrong',
  'walkAround.defects.prompt.usable': 'May this forklift be used?',
  'walkAround.defects.prompt.identify': 'What is wrong with this forklift?',
  'walkAround.defects.prompt.locate': 'Click the defect on the forklift.',
  'walkAround.defects.prompt.action': 'What do you do?',
  'walkAround.defects.usable.yes': 'Yes',
  'walkAround.defects.usable.no': 'No',
  'walkAround.defects.locate.hint': 'Look the forklift over from every side, then click the marker on the part with the defect.',
  'walkAround.defects.locate.marker': 'Part {n}',
  'walkAround.defects.cab': 'You check this forklift from the seat. Start it and try the controls before you answer.',
  'walkAround.defects.correct': 'Correct.',
  'walkAround.defects.incorrect': 'Not quite. Look again and try another answer.',

  'walkAround.noPhase': 'This step has no walk-around phase set yet.',
}
