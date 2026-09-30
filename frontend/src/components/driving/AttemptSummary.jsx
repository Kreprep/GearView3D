import { useT } from '../../i18n'
import { ALERT_RULE_IDS } from '../../lib/courseAlerts'

// The end-of-attempt summary under a completed driving step: what the safety
// signs logged on the learner's latest completion (`stats` is that step's
// attemptStats entry, lib/simulationProgress.js). "3 safety signs on this
// attempt: travelled with the forks raised, went over the speed limit (x2)."
export function AttemptSummary({ stats }) {
  const t = useT()
  if (!stats?.completedAt) return null

  // In the rule table's order; a rule since removed from it is left out.
  const logged = ALERT_RULE_IDS.map((id) => ({ id, times: stats.violations?.[id] || 0 })).filter((entry) => entry.times > 0)
  const total = logged.reduce((sum, entry) => sum + entry.times, 0)
  const list = logged
    .map(({ id, times }) => {
      const rule = t(`safety.rule.${id}`)
      return times > 1 ? t('safety.summary.repeated', { rule, times }) : rule
    })
    .join(', ')

  return (
    <p className="task-note" data-attempt-violations={total}>
      {total ? t('safety.summary.signs', { count: total, list }) : t('safety.summary.clean')}
      {stats.fails > 0 && ` ${t('safety.summary.fails', { count: stats.fails })}`}
    </p>
  )
}
