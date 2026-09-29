import { translate } from '../i18n/translate.js'

// The editable copy on the training hub (/training) and module list
// (/training/modules).
//
// Every string here is a *default*. `Equipment.content` stores only what an
// admin overrode, so a default improved in this file still reaches every field
// that was never touched. Blank means "use the default" - which is also how
// the admin editor clears a field back to stock.
//
// Defaults are functions of the page's own context (equipment title, whether
// there is a parts page, the module titles) *and* the learner's language, so
// the hub reads correctly with no content overrides at all, in either
// language.
// The strings themselves live in i18n/en/hubDefaults.js and its Filipino twin;
// this file only decides which key a field reads and what it fills the tokens
// with. Resolution + token substitution lives in lib/hubContent.js.
//
// translate() is the pure entry point deliberately: this file is imported by
// backend/prisma/seed.js, so nothing here may reach a browser global.
//
// Tokens usable in any field: {equipment} - the equipment title,
// {learner} - the signed-in learner's name. A token a default does not fill
// itself survives translate() and is substituted by resolveHubContent.

export const HUB_CONTENT_FIELDS = [
  {
    key: 'kicker',
    label: 'Hero kicker',
    section: 'Hero',
    default: (context, lang) => translate(lang, 'hubDefaults.kicker'),
  },
  {
    key: 'heading',
    label: 'Hero heading',
    section: 'Hero',
    default: (context, lang) => translate(lang, 'hubDefaults.heading'),
  },
  {
    key: 'intro',
    label: 'Hero description',
    section: 'Hero',
    multiline: true,
    default: (context, lang) => translate(lang, 'hubDefaults.intro'),
  },
  {
    key: 'continueLabel',
    label: 'Continue button',
    section: 'Hero',
    default: (context, lang) => translate(lang, 'hubDefaults.continueLabel'),
  },
  {
    key: 'overallTitle',
    label: 'Overall progress title',
    section: 'Overall progress',
    default: (context, lang) => translate(lang, 'hubDefaults.overallTitle'),
  },
  {
    key: 'overallDescription',
    label: 'Overall progress description',
    section: 'Overall progress',
    multiline: true,
    // Two whole sentences rather than one with an optional clause glued on:
    // the languages put "and parts identification" in different places.
    default: ({ hasPartsPage }, lang) =>
      translate(
        lang,
        hasPartsPage ? 'hubDefaults.overallDescriptionWithParts' : 'hubDefaults.overallDescription',
      ),
  },
  {
    key: 'assessmentTitle',
    label: 'Final check title',
    section: 'Final check card',
    default: (context, lang) => translate(lang, 'hubDefaults.assessmentTitle'),
  },
  {
    key: 'assessmentDescription',
    label: 'Final check description',
    section: 'Final check card',
    multiline: true,
    default: (context, lang) => translate(lang, 'hubDefaults.assessmentDescription'),
  },
  {
    key: 'assessmentCta',
    label: 'Final check button',
    section: 'Final check card',
    default: (context, lang) => translate(lang, 'hubDefaults.assessmentCta'),
  },
  {
    key: 'modulesTitle',
    label: 'Modules card title',
    section: 'Training modules card',
    default: (context, lang) => translate(lang, 'hubDefaults.modulesTitle'),
  },
  {
    key: 'modulesDescription',
    label: 'Modules card description',
    section: 'Training modules card',
    multiline: true,
    default: (context, lang) => translate(lang, 'hubDefaults.modulesDescription'),
  },
  {
    key: 'modulesCta',
    label: 'Modules card button',
    section: 'Training modules card',
    default: (context, lang) => translate(lang, 'hubDefaults.modulesCta'),
  },
  {
    key: 'partsTitle',
    label: 'Parts card title',
    section: 'Parts identification card',
    default: (context, lang) => translate(lang, 'hubDefaults.partsTitle'),
  },
  {
    key: 'partsDescription',
    label: 'Parts card description',
    section: 'Parts identification card',
    multiline: true,
    default: (context, lang) => translate(lang, 'hubDefaults.partsDescription'),
  },
  {
    key: 'partsCta',
    label: 'Parts card button',
    section: 'Parts identification card',
    default: (context, lang) => translate(lang, 'hubDefaults.partsCta'),
  },
  {
    key: 'activityTitle',
    label: 'Activity card title',
    section: 'Activity card',
    default: (context, lang) => translate(lang, 'hubDefaults.activityTitle'),
  },
  {
    key: 'activityBody',
    label: 'Activity card description',
    section: 'Activity card',
    multiline: true,
    default: (context, lang) => translate(lang, 'hubDefaults.activityBody'),
  },
  {
    key: 'moduleListHeading',
    label: 'Module list heading',
    section: 'Module list page',
    default: (context, lang) => translate(lang, 'hubDefaults.moduleListHeading'),
  },
  {
    key: 'moduleListIntro',
    label: 'Module list description',
    section: 'Module list page',
    multiline: true,
    default: (context, lang) => translate(lang, 'hubDefaults.moduleListIntro'),
  },
]
