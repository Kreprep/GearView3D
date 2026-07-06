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
        'Use hotspots or inspection cards to check leaks, fluids, tires, mast, forks, carriage, and structural condition.',
      hint: 'Visible leaks, unsafe tires, or damaged lifting parts should stop operation.',
    },
    {
      id: 'engine-on-inspection',
      title: 'Engine-On Inspection',
      objective: 'Confirm gauges and warning devices respond before entering the work area.',
      instructions:
        'Check dashboard indicators and test safety devices such as horn, lights, beacon, and backup alarm.',
      hint: 'A warning device that does not respond should be reported before use.',
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
      objective: 'Prepare for safe load handling without simulating real forklift physics.',
      instructions: 'Review positioning, stability, control use, and worksite awareness.',
      hint: 'The goal is decision-making and familiarization before supervised practical training.',
    },
    {
      id: 'maneuvering-positioning',
      title: 'Maneuvering and Positioning',
      objective: 'Approach a load slowly, squarely, and with clear visibility.',
      instructions: 'Choose the safe approach posture and fork setup before load entry.',
      hint: 'Raised loads and angled approaches increase risk.',
    },
    {
      id: 'stability-triangle',
      title: 'Stability Triangle / Center of Gravity',
      objective: 'Recognize how load placement affects stability.',
      instructions: 'Use the diagram to keep the center of gravity within the stability triangle.',
      hint: 'Low, centered loads are safer than high or offset loads.',
    },
    {
      id: 'hydraulic-controls',
      title: 'Hydraulic Lever and Control Mastery',
      objective: 'Practice matching lift and tilt controls to safe intent.',
      instructions: 'Use control buttons or sliders to raise, lower, and tilt in a guided sequence.',
      hint: 'Smooth control matters more than speed.',
    },
    {
      id: 'area-safety-survey',
      title: 'Operational Area Safety Survey',
      objective: 'Identify worksite hazards before moving with a load.',
      instructions: 'Click hazards in the worksite scene and review feedback.',
      hint: 'Look for pedestrians, blocked visibility, uneven paths, and obstacles.',
    },
    {
      id: 'summary',
      title: 'Completion Summary',
      objective: 'Review decisions, hazards found, and checkpoint score.',
      instructions: 'Confirm all load-handling learning activities are complete.',
      hint: 'This module prepares the learner for supervised practice, not unsupervised operation.',
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
