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
  'hubDefaults.activityTitle': 'Help improve GearView3D',
  'hubDefaults.activityBody':
    'Share your feedback on the GearView3D Survey to help us improve this training tool.',
  'hubDefaults.moduleListHeading': '{equipment} - Training modules',
  'hubDefaults.moduleListIntro': 'Pick a module. Start with number 1.',
}
