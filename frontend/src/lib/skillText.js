// Words for the Skills Checklist: an evidence rule as a sentence, and the i18n
// keys for a status and a category. `t` is passed in, so the learner pages
// hand over useT()'s function and the admin dashboard, whose chrome is
// English, hands over translate() bound to English. Pure: nothing here reads
// the language itself.
//
// A rule arrives with the titles it names beside it (`moduleTitle`,
// `stepTitle`, added by the API); a step or module deleted since falls back
// to its id, so the line still says what it was.

import { ALERT_RULE_IDS } from './courseAlerts.js'

export const SKILL_STATUS_KEYS = {
  'not-started': 'skills.status.notStarted',
  'in-progress': 'skills.status.inProgress',
  demonstrated: 'skills.status.demonstrated',
  'signed-off': 'skills.status.signedOff',
}

export function skillCategoryKey(category) {
  return `skills.category.${category}`
}

function ruleList(ids, t) {
  // In the rule table's order, like the attempt summary.
  return ALERT_RULE_IDS.filter((id) => ids.includes(id))
    .map((id) => t(`safety.rule.${id}`))
    .join(', ')
}

export function describeEvidence(rule, t) {
  const module = rule.moduleTitle || rule.module
  const step = rule.stepTitle || rule.stepId

  switch (rule.type) {
    case 'step-complete':
      return t('skills.evidence.step', { step, module })
    case 'clean-run': {
      const rules = rule.rules || []
      const danger = rule.severity === 'danger'
      if (!rules.length) return t(danger ? 'skills.evidence.cleanRun.dangerAll' : 'skills.evidence.cleanRun.anyAll', { step, module })
      return t(danger ? 'skills.evidence.cleanRun.danger' : 'skills.evidence.cleanRun.any', { step, module, list: ruleList(rules, t) })
    }
    case 'quiz-score':
      return rule.context === 'parts'
        ? t('skills.evidence.quiz.parts', { min: rule.min })
        : t('skills.evidence.quiz.module', { min: rule.min, module })
    case 'parts-viewed':
      return t('skills.evidence.partsViewed')
    case 'caution-recovered':
      return t('skills.evidence.cautionRecovered')
    default:
      return rule.type
  }
}

// A sign-off's date in the reader's language.
export function formatSkillDate(value, language = 'en') {
  return new Date(value).toLocaleDateString(language === 'fil' ? 'fil-PH' : 'en-PH', { dateStyle: 'medium' })
}
