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
  // GAUGE_CHOICES in components/WalkAroundStep.jsx.
  'walkAround.gauges.normal': 'Normal',
  'walkAround.gauges.abnormal': 'Abnormal',
  'walkAround.gauges.correct': 'Correct',
  'walkAround.gauges.reread': 'Re-read this gauge',
  'walkAround.gauges.score': 'Gauge readings correct: {correct}/{total}',

  'walkAround.defects.empty': 'This step has no defect scenarios yet.',
  'walkAround.defects.pickerLabel': 'Defect recognition scenarios',
  'walkAround.defects.playDemo': 'Play demo',
  'walkAround.defects.next': 'Next scenario',
  'walkAround.defects.score': 'Defect recognition score: {correct}/{total}',

  'walkAround.noPhase': 'This step has no walk-around phase set yet.',
}
