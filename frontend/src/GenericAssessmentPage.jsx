import { useEffect, useMemo, useState } from 'react'
import { useProgress } from './hooks/useProgress'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import { getEquipment, getEquipmentHotspots, getTrainingModules } from './lib/api'
import { getGenericHotspotProgress, getGenericModuleProgress, getGenericOverallProgress } from './lib/progressService'
import './AssessmentPage.css'

// The equivalent of AssessmentPage for any equipment other than Forklift:
// same status/review/recommendation layout, but reads modules + hotspots for
// `equipmentId` instead of the fixed forklift module slugs and Part table.
function GenericAssessmentPage({ equipmentId, user, onLogout, onBack, onNavigate }) {
  const { summary } = useProgress()
  const [equipment, setEquipment] = useState(null)
  const [modules, setModules] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([getEquipment(), getTrainingModules(equipmentId), getEquipmentHotspots(equipmentId)])
      .then(([equipmentRows, moduleRows, hotspotRows]) => {
        if (cancelled) return
        setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
        setModules(moduleRows)
        setHotspots(hotspotRows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  const moduleSlugs = useMemo(() => modules.map((module) => module.slug), [modules])
  const hotspotIds = useMemo(() => hotspots.map((hotspot) => hotspot.id), [hotspots])
  const hasHotspots = hotspotIds.length > 0

  const moduleProgress = getGenericModuleProgress(summary.raw, moduleSlugs)
  const hotspotProgress = getGenericHotspotProgress(summary.raw, hotspotIds)
  const overall = getGenericOverallProgress(summary.raw, moduleSlugs, hotspotIds)

  const moduleLabels = useMemo(
    () => Object.fromEntries(modules.map((module) => [module.slug, module.title])),
    [modules],
  )
  const latestAttempts = Object.entries(summary.quizAttempts)
    .filter(([moduleSlug]) => moduleSlugs.includes(moduleSlug))
    .flatMap(([moduleSlug, attempts]) => attempts.map((attempt) => ({ ...attempt, moduleSlug })))
  const viewedPartSet = new Set(summary.viewedParts)

  const requiredComplete = moduleProgress === 100 && (!hasHotspots || hotspotProgress === 100)
  const recommendedAction = requiredComplete
    ? 'Ready for instructor review or thesis demo presentation.'
    : hasHotspots && hotspotProgress < moduleProgress
      ? 'Review remaining hotspots on the 3D model.'
      : 'Continue training modules and checklists.'

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="page-back-row">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1 className="page-heading">{equipment?.title || 'Equipment'} - Final Assessment</h1>
      </div>

      <ScopeNotice />
      <section className="assessment-card">
        <p className="assessment-kicker">Progress Review</p>
        <h2>{requiredComplete ? 'Prototype Module Completion' : 'Training still in progress'}</h2>
        <p>
          This page summarizes GearView3D learner progress for thesis demonstration. The completion badge is
          only for prototype module completion and does not imply official TESDA certification.
        </p>

        <div className="assessment-status-grid">
          <div>
            <span>Overall</span>
            <strong>{overall}%</strong>
          </div>
          <div>
            <span>Modules</span>
            <strong>{moduleProgress}%</strong>
          </div>
          {hasHotspots && (
            <div>
              <span>Hotspot Identification</span>
              <strong>{hotspotProgress}%</strong>
            </div>
          )}
        </div>

        <div className="assessment-review-grid">
          <article>
            <h3>Module Review</h3>
            {loading ? (
              <p>Loading modules...</p>
            ) : (
              <ul>
                {modules.map((module) => {
                  const checklist = summary.checklist[module.slug]
                  const latestQuiz = summary.quizAttempts[module.slug]?.[0]
                  return (
                    <li key={module.slug}>
                      {module.title}: {checklist ? `${checklist.completedCount}/${checklist.totalCount}` : 'no'} checklist items,
                      {' '}quiz {latestQuiz ? `${latestQuiz.score}/${latestQuiz.total}` : 'not attempted'}
                    </li>
                  )
                })}
                {modules.length === 0 && <li>No modules yet.</li>}
              </ul>
            )}
          </article>

          {hasHotspots && (
            <article>
              <h3>Hotspot Review</h3>
              {loading ? (
                <p>Loading hotspots...</p>
              ) : (
                <>
                  <p>{hotspots.filter((hotspot) => viewedPartSet.has(hotspot.id)).length} of {hotspots.length} hotspots viewed.</p>
                  <ul>
                    {hotspots.map((hotspot) => (
                      <li key={hotspot.id}>{hotspot.label}: {viewedPartSet.has(hotspot.id) ? 'viewed' : 'not viewed'}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          )}

          <article>
            <h3>Quiz Scores</h3>
            {latestAttempts.length ? (
              <ul>
                {latestAttempts.slice(0, 8).map((attempt) => (
                  <li key={attempt.id}>
                    {moduleLabels[attempt.moduleSlug] || attempt.moduleSlug}: {attempt.score}/{attempt.total} ({attempt.percentage}%)
                  </li>
                ))}
              </ul>
            ) : (
              <p>No quiz attempts saved yet.</p>
            )}
          </article>

          <article>
            <h3>Recommended Next Action</h3>
            <p>{recommendedAction}</p>
          </article>
        </div>

        {requiredComplete && (
          <p className="completion-badge">GearView3D Training Completion</p>
        )}

        <div className="assessment-actions">
          <button onClick={() => onNavigate(`/training/${equipmentId}`)}>Review training modules</button>
          {hasHotspots && (
            <button onClick={() => onNavigate(`/training/${equipmentId}/parts`)}>Review hotspot identification</button>
          )}
        </div>
      </section>
    </PageLayout>
  )
}

export default GenericAssessmentPage
