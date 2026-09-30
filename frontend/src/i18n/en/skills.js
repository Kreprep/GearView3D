// The Skills Checklist (/training/skills) and the skill lists on the module
// pages. Skill titles and descriptions, module titles and step titles are
// admin-authored rows and stay as written; this is the chrome around them.
//
// The evidence lines are whole sentences with named tokens, because the
// clause order differs between the languages. `{list}` is a comma list of
// `safety.rule.<id>` phrases, the same ones the attempt summary uses.
export default {
  'skills.pageTitle': '{equipment} skills checklist',
  'skills.kicker': 'Your skills',
  'skills.state.loading': 'Loading the skills checklist...',
  'skills.state.error': 'Could not load the skills checklist: {error}',
  'skills.state.empty': 'There are no skills in the checklist yet.',
  'skills.print': 'Print',
  'skills.summary': '{done} of {total} skills shown or signed off',
  'skills.summaryLabel': 'Skills shown or signed off',

  'skills.status.notStarted': 'Not started',
  'skills.status.inProgress': 'In progress',
  'skills.status.demonstrated': 'Shown',
  'skills.status.signedOff': 'Signed off',

  'skills.category.knowledge': 'Knowledge',
  'skills.category.perceptual': 'Awareness and judgement',
  'skills.category.motor': 'Handling the controls',
  'skills.category.safety': 'Safety',
  'skills.category.procedural': 'Procedures',

  'skills.tesdaRef': 'TESDA: {ref}',
  'skills.practisedIn': 'Practised in: {modules}',
  'skills.evidence.heading': 'What shows this skill',
  'skills.evidence.met': 'Done',
  'skills.evidence.notMet': 'Not yet',
  'skills.evidence.none': 'An instructor signs this skill off after seeing you do it.',
  'skills.evidence.step': 'Finish "{step}" ({module})',
  'skills.evidence.cleanRun.any': 'Finish "{step}" ({module}) on a run with none of these signs: {list}',
  'skills.evidence.cleanRun.anyAll': 'Finish "{step}" ({module}) on a run with no safety signs',
  'skills.evidence.cleanRun.danger': 'Finish "{step}" ({module}) on a run with none of these at danger level: {list}',
  'skills.evidence.cleanRun.dangerAll': 'Finish "{step}" ({module}) on a run with no danger-level safety sign',
  'skills.evidence.quiz.module': 'Score at least {min}% on the {module} quiz (your latest try)',
  'skills.evidence.quiz.parts': 'Score at least {min}% on the parts quiz (your latest try)',
  'skills.evidence.partsViewed': 'Look at every part on the parts page',
  'skills.evidence.cautionRecovered':
    'Finish a driving step after a warning sign came up, without it becoming a danger sign',

  'skills.stamp': 'Signed off by {name} on {date}',
  'skills.stampFormer': 'Signed off by {name} (former staff) on {date}',

  'skills.note.clientReported':
    'Your browser saves your progress, so the ticks here show where you stand, not proof of skill. Only an instructor\'s sign-off confirms a skill.',
  'skills.note.draftMapping':
    'How these skills match the TESDA training regulations is a draft, waiting for review.',

  'skills.notSimulated.heading': 'Covered in hands-on training, not in GearView',
  'skills.notSimulated.trailer': 'Loading and unloading the forklift to a low-bed trailer or truck (CON834218 element 2)',
  'skills.notSimulated.maintenance': 'Hands-on basic preventive maintenance (CON834217 element 2)',
  'skills.notSimulated.ppe': 'Personal protective equipment (Rule 1080)',
  'skills.notSimulated.basic': 'The basic and common competencies: communication, teamwork, OSH policy and mensuration',

  'skills.module.practise': "Skills you'll practise",
  'skills.module.need': 'Skills you need',
  'skills.module.chips': 'Skills in this module',
  'skills.open': 'Open skills checklist',
}
