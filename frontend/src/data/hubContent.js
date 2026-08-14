// The editable copy on an equipment's training hub (/training/:equipmentId)
// and module list (/training/:equipmentId/modules).
//
// Every string here is a *default*. `Equipment.content` stores only what an
// admin overrode, so a default improved in this file still reaches every
// equipment that never touched it. Blank means "use the default" - which is
// also how the admin editor clears a field back to stock.
//
// Defaults are functions of the page's own context (equipment title, whether
// it has a parts page, its module titles) so a new equipment reads correctly
// with no content row at all. Resolution + token substitution lives in
// lib/hubContent.js.
//
// Tokens usable in any field: {equipment} - the equipment title,
// {learner} - the signed-in learner's name.

export const HUB_CONTENT_FIELDS = [
  {
    key: 'kicker',
    label: 'Hero kicker',
    section: 'Hero',
    default: () => '{equipment} Training',
  },
  {
    key: 'heading',
    label: 'Hero heading',
    section: 'Hero',
    default: () => 'Welcome back, {learner}.',
  },
  {
    key: 'intro',
    label: 'Hero description',
    section: 'Hero',
    multiline: true,
    default: ({ equipmentTitle }) =>
      `Continue your ${equipmentTitle.toLowerCase()} familiarization training through the sections below.`,
  },
  {
    key: 'continueLabel',
    label: 'Continue button',
    section: 'Hero',
    default: () => 'Continue Training',
  },
  {
    key: 'overallTitle',
    label: 'Overall progress title',
    section: 'Overall progress',
    default: () => 'Overall Progress',
  },
  {
    key: 'overallDescription',
    label: 'Overall progress description',
    section: 'Overall progress',
    multiline: true,
    default: ({ hasPartsPage }) =>
      `Combined progress across all training modules${hasPartsPage ? ' and parts identification' : ''}.`,
  },
  {
    key: 'assessmentCta',
    label: 'Assessment button',
    section: 'Overall progress',
    default: () => 'View final assessment',
  },
  {
    key: 'modulesTitle',
    label: 'Modules card title',
    section: 'Training modules card',
    default: () => 'Training Modules',
  },
  {
    key: 'modulesDescription',
    label: 'Modules card description',
    section: 'Training modules card',
    multiline: true,
    // Left blank by default so the card lists whatever modules the equipment
    // actually has; an override replaces the generated sentence.
    default: ({ moduleTitles }) =>
      moduleTitles.length
        ? `${moduleTitles.length} guided ${moduleTitles.length === 1 ? 'module' : 'modules'}: ${moduleTitles.join(', ')}.`
        : 'Guided step-by-step training modules.',
  },
  {
    key: 'modulesCta',
    label: 'Modules card button',
    section: 'Training modules card',
    default: () => 'Open training modules',
  },
  {
    key: 'partsTitle',
    label: 'Parts card title',
    section: 'Parts identification card',
    default: () => 'Parts Identification',
  },
  {
    key: 'partsDescription',
    label: 'Parts card description',
    section: 'Parts identification card',
    multiline: true,
    default: () => 'Review major {equipment} components, functions, and safety reminders.',
  },
  {
    key: 'partsCta',
    label: 'Parts card button',
    section: 'Parts identification card',
    default: () => 'Open parts identification',
  },
  {
    key: 'activityTitle',
    label: 'Activity card title',
    section: 'Activity card',
    default: () => 'Training activity will appear here',
  },
  {
    key: 'activityBody',
    label: 'Activity card description',
    section: 'Activity card',
    multiline: true,
    default: () =>
      'This placeholder will later show recently completed checklists, quiz attempts, and module updates.',
  },
  {
    key: 'moduleListHeading',
    label: 'Module list heading',
    section: 'Module list page',
    default: () => '{equipment} - Training Modules',
  },
  {
    key: 'moduleListIntro',
    label: 'Module list description',
    section: 'Module list page',
    multiline: true,
    default: ({ equipmentTitle }) => `Select a module to begin your ${equipmentTitle.toLowerCase()} training:`,
  },
]

export const HUB_CONTENT_KEYS = HUB_CONTENT_FIELDS.map((field) => field.key)
