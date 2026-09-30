// The coded defaults behind HUB_CONTENT_FIELDS in data/hubContent.js. They live
// in the catalog rather than in that file so a field with no admin override
// reads in the learner's language; an override still wins over both.
//
// Two token layers meet here. A {token} the default() builder passes to
// translate() is consumed immediately; a {token} it does not pass survives to
// resolveHubContent, which substitutes {equipment}/{learner} for admin-authored
// copy alike. That is why interpolate() leaves an unknown token in place.
//
// Plain language is the point, not a style preference: the audience is NC II
// trainees, many with limited English. Short verbs, sentence case, one job per
// string - and never a word a learner has to decode before they can act.
export default {
  'hubDefaults.kicker': '{equipment} training',
  'hubDefaults.heading': 'Welcome back, {learner}.',
  'hubDefaults.intro': 'Pick what you want to do today.',
  'hubDefaults.continueLabel': 'Continue training',
  'hubDefaults.overallTitle': 'Overall progress',
  'hubDefaults.overallDescription': 'Combined progress across all training modules.',
  'hubDefaults.overallDescriptionWithParts':
    'Combined progress across all training modules and parts identification.',
  'hubDefaults.assessmentTitle': 'Final check',
  'hubDefaults.assessmentDescription': 'Review everything you have done.',
  'hubDefaults.assessmentCta': 'Open final check',
  'hubDefaults.modulesTitle': 'Training modules',
  'hubDefaults.modulesDescription': 'Learn how to use the {equipment}, step by step.',
  'hubDefaults.modulesCta': 'Open modules',
  'hubDefaults.partsTitle': 'Learn the parts',
  'hubDefaults.partsDescription': 'See each part of the {equipment} and what it does.',
  'hubDefaults.partsCta': 'Open parts',
  'hubDefaults.skillsTitle': 'Skills checklist',
  'hubDefaults.skillsDescription': 'See the skills you have shown and the ones an instructor has signed off.',
  'hubDefaults.skillsCta': 'Open skills',
  'hubDefaults.activityTitle': 'Help improve GearView3D',
  'hubDefaults.activityBody':
    'Share your feedback on the GearView3D Survey to help us improve this training tool.',
  'hubDefaults.moduleListHeading': '{equipment} - Training modules',
  'hubDefaults.moduleListIntro': 'Pick a module. Start with number 1.',
  'hubDefaults.skillsPageHeading': 'Skills checklist',
  'hubDefaults.skillsPageIntro':
    'Each skill fills in as you finish the training. An instructor signs a skill off once they have seen you do it.',
  'hubDefaults.entryRequirementsTitle': 'Before the training',
  'hubDefaults.entryRequirements': '> Trainees or students who wish to enter this training should possess the following requirements:\n>\n> - At least Junior High School Level Completer or an Alternative Learning System (ALS) Certificate of Completion with grade 10 equivalent holder\n> - Must possess good communication skills\n> - Can perform basic mathematical computation\n> - Physically fit\n\nSource: TESDA Training Regulations, Heavy Equipment Operation (Forklift) NC II, Revision 01 (promulgated 11/07/2019), section 3.3, page 93.',
  'hubDefaults.entryRequirementsNote':
    'These are the entry requirements for the TESDA Forklift NC II training program, as applied by TESDA-accredited training institutions. {equipment} training in GearView prepares you for that program. It does not replace it or certify you.',
}
