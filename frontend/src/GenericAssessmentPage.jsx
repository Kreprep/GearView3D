import { useEffect, useMemo, useState } from 'react'
import { useProgress } from './hooks/useProgress'
import PageLayout from './components/PageLayout'
import ScopeNotice, { FORKLIFT_SCOPE_NOTE } from './components/ScopeNotice'
import { getEquipment, getEquipmentHotspots, getParts, getQuizQuestions, getTrainingModules } from './lib/api'
import {
  getGenericModuleProgress,
  getGenericOverallProgress,
  getGenericPartsProgress,
  getPartsQuizAttempts,
} from './lib/progressService'
import { routes } from './lib/router'
import './AssessmentPage.css'

// The final-assessment page for every equipment. The layout is shared; what
// varies per equipment is where the "parts" numbers come from: Forklift's
// parts progress is the Part-table-based summary.parts, while other equipment
// reads its EquipmentHotspot rows. Both average in that equipment's parts quiz
// when it has one.
function GenericAssessmentPage({ equipmentId, user, onLogout, onBack, onNavigate }) {
  const isForklift = equipmentId === 'forklift'
  const { summary } = useProgress()
  const [equipment, setEquipment] = useState(null)
  const [modules, setModules] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [parts, setParts] = useState([])
  const [hasPartsQuiz, setHasPartsQuiz] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getEquipment(),
      getTrainingModules(equipmentId),
      isForklift ? getParts() : getEquipmentHotspots(equipmentId),
      getQuizQuestions({ equipment: equipmentId, context: 'parts' }).catch(() => []),
    ])
      .then(([equipmentRows, moduleRows, partOrHotspotRows, partsQuestions]) => {
        if (cancelled) return
        setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
        setModules(moduleRows)
        setHasPartsQuiz(partsQuestions.length > 0)
        if (isForklift) {
          setParts(partOrHotspotRows)
        } else {
          setHotspots(partOrHotspotRows)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [equipmentId, isForklift])

  const moduleSlugs = useMemo(() => modules.map((module) => module.slug), [modules])
  const hotspotIds = useMemo(() => hotspots.map((hotspot) => hotspot.id), [hotspots])
  const hasPartsSection = isForklift || hotspotIds.length > 0

  const moduleProgress = isForklift ? summary.equipment : getGenericModuleProgress(summary.raw, moduleSlugs)
  const partsProgress = isForklift
    ? summary.parts
    : getGenericPartsProgress(summary.raw, hotspotIds, equipmentId, hasPartsQuiz)
  const overall = isForklift
    ? summary.overall
    : getGenericOverallProgress(summary.raw, moduleSlugs, hasPartsSection ? partsProgress : null)

  const moduleLabels = useMemo(
    () => Object.fromEntries(modules.map((module) => [module.slug, module.title])),
    [modules],
  )
  const latestAttempts = Object.entries(summary.quizAttempts)
    .filter(([moduleSlug]) => moduleSlugs.includes(moduleSlug))
    .flatMap(([moduleSlug, attempts]) => attempts.map((attempt) => ({ ...attempt, moduleSlug })))
  const viewedPartSet = new Set(summary.viewedParts)
  const latestPartsQuiz = getPartsQuizAttempts(summary.raw, equipmentId)[0]

  const requiredComplete = moduleProgress === 100 && (!hasPartsSection || partsProgress === 100)
  const recommendedAction = requiredComplete
    ? 'Ready for instructor review or thesis demo presentation.'
    : hasPartsSection && partsProgress < moduleProgress
      ? 'Review remaining parts on the 3D model.'
      : 'Continue training modules and checklists.'

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="page-back-row">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1 className="page-heading">{equipment?.title || 'Equipment'} - Final Assessment</h1>
      </div>

      <ScopeNotice note={isForklift ? FORKLIFT_SCOPE_NOTE : undefined} />
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
          {hasPartsSection && (
            <div>
              <span>Parts Identification</span>
              <strong>{partsProgress}%</strong>
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

          {hasPartsSection && (
            <article>
              <h3>Parts Review</h3>
              {loading ? (
                <p>Loading parts...</p>
              ) : isForklift ? (
                <>
                  <p>{summary.viewedParts.length} of {parts.length} parts viewed.</p>
                  <ul>
                    {parts.map((part) => (
                      <li key={part.id}>{part.label}: {viewedPartSet.has(part.id) ? 'viewed' : 'not viewed'}</li>
                    ))}
                  </ul>
                </>
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
            {(isForklift || hasPartsQuiz) && (
              <p>
                Parts quiz: {latestPartsQuiz ? `${latestPartsQuiz.score}/${latestPartsQuiz.total} (${latestPartsQuiz.percentage}%)` : 'not attempted'}.
              </p>
            )}
          </article>
        </div>

        {requiredComplete && (
          <p className="completion-badge">GearView3D Training Completion</p>
        )}

        <div className="assessment-actions">
          <button onClick={() => onNavigate(`/training/${equipmentId}/modules`)}>Review training modules</button>
          {hasPartsSection && (
            <button onClick={() => onNavigate(isForklift ? routes.parts : `/training/${equipmentId}/parts`)}>
              Review parts identification
            </button>
          )}
        </div>
      </section>
    </PageLayout>
  )
}

export default GenericAssessmentPage
