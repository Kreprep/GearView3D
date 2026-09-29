import { useEffect, useMemo, useState } from 'react'
import { useProgress } from './hooks/useProgress'
import { usePageTitle } from './hooks/usePageTitle'
import { useT } from './i18n'
import { Button } from './components/ui/button'
import PageLayout from './components/PageLayout'
import { getEquipment, getHotspots, getQuizQuestions, getTrainingModules } from './lib/api'
import {
  getChecklistCompletion,
  getModulesProgress,
  getOverallProgress,
  getPartsProgress,
  getPartsQuizAttempts,
} from './lib/progressService'
import { routes } from './lib/router'
import './AssessmentPage.css'

// The final-assessment review: module progress, the parts markers and the
// parts quiz, all read from the database rows.
function GenericAssessmentPage({ user, onLogout, onBack, onNavigate }) {
  const t = useT()
  const { summary } = useProgress()
  const [equipment, setEquipment] = useState(null)
  const [modules, setModules] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [hasPartsQuiz, setHasPartsQuiz] = useState(false)
  const [loading, setLoading] = useState(true)
  const equipmentTitle = equipment?.title || 'Equipment'
  usePageTitle(t('assessment.pageTitle', { equipment: equipmentTitle }))

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getEquipment(),
      getTrainingModules(),
      getHotspots('parts'),
      getQuizQuestions({ context: 'parts' }).catch(() => []),
    ])
      .then(([equipmentRow, moduleRows, hotspotRows, partsQuestions]) => {
        if (cancelled) return
        setEquipment(equipmentRow)
        setModules(moduleRows)
        setHotspots(hotspotRows)
        setHasPartsQuiz(partsQuestions.length > 0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const moduleSlugs = useMemo(() => modules.map((module) => module.slug), [modules])
  const hotspotIds = useMemo(() => hotspots.map((hotspot) => hotspot.id), [hotspots])
  const hasPartsSection = hotspotIds.length > 0

  const moduleProgress = getModulesProgress(summary.raw, moduleSlugs)
  const partsProgress = getPartsProgress(summary.raw, hotspotIds, hasPartsQuiz)
  const overall = getOverallProgress(summary.raw, moduleSlugs, hasPartsSection ? partsProgress : null)

  const moduleLabels = useMemo(
    () => Object.fromEntries(modules.map((module) => [module.slug, module.title])),
    [modules],
  )
  const latestAttempts = Object.entries(summary.quizAttempts)
    .filter(([moduleSlug]) => moduleSlugs.includes(moduleSlug))
    .flatMap(([moduleSlug, attempts]) => attempts.map((attempt) => ({ ...attempt, moduleSlug })))
  const viewedPartSet = new Set(summary.viewedParts)
  const latestPartsQuiz = getPartsQuizAttempts(summary.raw)[0]

  const requiredComplete = moduleProgress === 100 && (!hasPartsSection || partsProgress === 100)
  const recommendedAction = requiredComplete
    ? t('assessment.next.ready')
    : hasPartsSection && partsProgress < moduleProgress
      ? t('assessment.next.parts')
      : t('assessment.next.modules')

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="page-back-row">
        <button className="back-button" onClick={onBack}>
          {t('assessment.back')}
        </button>
        <h1 className="page-heading">{t('assessment.heading', { equipment: equipmentTitle })}</h1>
      </div>

      <section className="assessment-card">
        <p className="assessment-kicker">{t('assessment.kicker')}</p>
        <h2>{t(requiredComplete ? 'assessment.status.complete' : 'assessment.status.inProgress')}</h2>
        <p>{t('assessment.intro')}</p>

        <p className="assessment-learner-identity">
          <strong>{user?.fullName || t('assessment.learnerFallback')}</strong>
          <span>{user?.email || t('assessment.noEmail')}</span>
        </p>

        <div className="assessment-status-grid">
          <div>
            <span>{t('assessment.stat.overall')}</span>
            <strong>{overall}%</strong>
          </div>
          <div>
            <span>{t('assessment.stat.modules')}</span>
            <strong>{moduleProgress}%</strong>
          </div>
          {hasPartsSection && (
            <div>
              <span>{t('assessment.stat.parts')}</span>
              <strong>{partsProgress}%</strong>
            </div>
          )}
        </div>

        <div className="assessment-review-grid">
          <article>
            <h3>{t('assessment.modules.heading')}</h3>
            {loading ? (
              <p>{t('assessment.modules.loading')}</p>
            ) : (
              <ul>
                {modules.map((module) => {
                  // Read per module rather than out of a prebuilt map: the map
                  // was keyed by a fixed list of Forklift slugs, so any module
                  // an admin added reported "no checklist items" whatever it had.
                  const checklist = getChecklistCompletion(summary.raw, module.slug)
                  const latestQuiz = summary.quizAttempts[module.slug]?.[0]
                  const quiz = latestQuiz
                    ? t('assessment.quiz.scored', { score: latestQuiz.score, total: latestQuiz.total })
                    : t('assessment.quiz.notAttempted')

                  return (
                    <li key={module.slug}>
                      {checklist.totalCount
                        ? t('assessment.modules.row', {
                            module: module.title,
                            completed: checklist.completedCount,
                            total: checklist.totalCount,
                            quiz,
                          })
                        : t('assessment.modules.rowNoChecklist', { module: module.title, quiz })}
                    </li>
                  )
                })}
                {modules.length === 0 && <li>{t('assessment.modules.empty')}</li>}
              </ul>
            )}
          </article>

          {hasPartsSection && (
            <article>
              <h3>{t('assessment.parts.heading')}</h3>
              {loading ? (
                <p>{t('assessment.parts.loading')}</p>
              ) : (
                <>
                  <p>
                    {t('assessment.parts.viewedCount', {
                      viewed: hotspots.filter((hotspot) => viewedPartSet.has(hotspot.id)).length,
                      total: hotspots.length,
                    })}
                  </p>
                  <ul>
                    {hotspots.map((hotspot) => (
                      <li key={hotspot.id}>
                        {t('assessment.parts.row', {
                          part: hotspot.label,
                          state: t(
                            viewedPartSet.has(hotspot.id)
                              ? 'assessment.parts.viewed'
                              : 'assessment.parts.notViewed',
                          ),
                        })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          )}

          <article>
            <h3>{t('assessment.scores.heading')}</h3>
            {latestAttempts.length ? (
              <ul>
                {latestAttempts.slice(0, 8).map((attempt) => (
                  <li key={attempt.id}>
                    {t('assessment.scores.row', {
                      module: moduleLabels[attempt.moduleSlug] || attempt.moduleSlug,
                      score: attempt.score,
                      total: attempt.total,
                      percentage: attempt.percentage,
                    })}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('assessment.scores.empty')}</p>
            )}
          </article>

          <article>
            <h3>{t('assessment.next.heading')}</h3>
            <p>{recommendedAction}</p>
            {hasPartsQuiz && (
              <p>
                {t('assessment.next.partsQuiz', {
                  result: latestPartsQuiz
                    ? t('assessment.next.partsQuizScored', {
                        score: latestPartsQuiz.score,
                        total: latestPartsQuiz.total,
                        percentage: latestPartsQuiz.percentage,
                      })
                    : t('assessment.quiz.notAttempted'),
                })}
              </p>
            )}
          </article>
        </div>

        {requiredComplete && (
          <p className="completion-badge">{t('assessment.badge')}</p>
        )}

        <div className="assessment-actions">
          <Button variant="deep" onClick={() => onNavigate(routes.modules)}>
            {t('assessment.action.modules')}
          </Button>
          {hasPartsSection && (
            <Button variant="deep" onClick={() => onNavigate(routes.parts)}>
              {t('assessment.action.parts')}
            </Button>
          )}
        </div>
      </section>
    </PageLayout>
  )
}

export default GenericAssessmentPage
