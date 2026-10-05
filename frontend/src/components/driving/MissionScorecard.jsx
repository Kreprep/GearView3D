import { useId } from 'react'
import { useLanguage, useT } from '../../i18n'
import { formatSkillDate } from '../../lib/skillText'
import './MissionScorecard.css'

// The Final Driving Test's pass rules and scorecard (docs/modules/
// module-improvements-plan.md, 3.6). The run is scored by lib/missionScore.js
// when the mission is finished, and kept with the step's progress as
// `attemptStats[stepId].mission` (lib/simulationProgress.js); this only
// shows it. The pass rules come from the course, so an admin's change to
// them is what the learner reads.

// What it takes to pass: `rules` is resolvePassRules()'s.
export function MissionPassRules({ rules }) {
  const t = useT()
  const clean = rules.cleanRules.map((id) => t(`safety.rule.${id}`)).join(', ')

  return (
    <div className="mission-rules">
      <p className="mission-heading">{t('mission.rules.heading')}</p>
      <ul>
        <li>{t('mission.rules.noDanger')}</li>
        <li>{rules.maxCautions ? t('mission.rules.maxCautions', { count: rules.maxCautions }) : t('mission.rules.noCautions')}</li>
        {clean && <li>{t('mission.rules.clean', { list: clean })}</li>}
      </ul>
    </div>
  )
}

function reasonText(reason, t) {
  switch (reason.type) {
    case 'dangers':
      return t('mission.reason.dangers', { count: reason.count })
    case 'cautions':
      return t('mission.reason.cautions', { count: reason.count, max: reason.max })
    case 'clean-rule':
      return t('mission.reason.cleanRule', { rule: t(`safety.rule.${reason.ruleId}`) })
    default:
      return null
  }
}

// `stats` is the step's attemptStats entry. Shows the last finished run: the
// result and why, each sign that came up with what it cost, the time, and
// the pass the learner already has if this run was not one.
export function MissionScorecard({ stats }) {
  const t = useT()
  const language = useLanguage()
  const resultId = useId()
  const record = stats?.mission
  const run = record?.lastRun
  if (!run) return null

  const elapsed = Math.round(run.elapsedS || 0)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <section className={`mission-scorecard ${run.passed ? 'passed' : 'failed'}`} aria-labelledby={resultId}>
      <p className="mission-heading">{t('mission.result.heading')}</p>
      <p id={resultId} className="mission-result">
        <strong>{t(run.passed ? 'mission.result.passed' : 'mission.result.failed')}</strong>
        <span>{t('mission.result.score', { score: run.score })}</span>
      </p>

      {run.reasons.length > 0 && (
        <ul className="mission-reasons">
          {run.reasons.map((reason) => (
            <li key={`${reason.type}-${reason.ruleId || ''}`}>{reasonText(reason, t)}</li>
          ))}
        </ul>
      )}

      <p className="mission-heading">{t('mission.signs.heading')}</p>
      {run.rules.length ? (
        <ul className="mission-signs">
          {run.rules.map((row) => (
            <li key={row.id}>
              <span>{t(`safety.rule.${row.id}`)}</span>
              <span className="mission-counts">
                {[
                  row.cautions ? t('mission.signs.cautions', { count: row.cautions }) : null,
                  row.dangers ? t('mission.signs.dangers', { count: row.dangers }) : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
              <span className="mission-penalty" aria-label={t('mission.signs.penaltyLabel', { points: row.penalty })}>
                {t('mission.signs.penalty', { points: row.penalty })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mission-note">{t('mission.signs.none')}</p>
      )}

      <p className="mission-note">{t('mission.result.time', { minutes, seconds })}</p>
      {run.passed && stats.fails > 0 && <p className="mission-note">{t('mission.result.fails', { count: stats.fails })}</p>}
      {!run.passed && record.passedAt && (
        <p className="mission-note">
          {t('mission.result.passedEarlier', { date: formatSkillDate(record.passedAt, language) })}{' '}
          {t('mission.result.best', { score: record.bestScore })}
        </p>
      )}
      {run.passed && record.bestScore !== run.score && <p className="mission-note">{t('mission.result.best', { score: record.bestScore })}</p>}
      {!run.passed && <p className="mission-note">{t('mission.result.retry')}</p>}
    </section>
  )
}
