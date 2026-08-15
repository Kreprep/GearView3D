import { useEffect, useState } from 'react'
import { ArrowRight, CircleGauge, ClipboardList, Layers, PackageSearch, RotateCcw } from 'lucide-react'
import { getEquipment, getHotspots, getQuizQuestions, getTrainingModules } from './lib/api'
import { getModulesProgress, getOverallProgress, getPartsProgress } from './lib/progressService'
import { useProgress } from './hooks/useProgress'
import { hubContentContext, resolveHubContent } from './lib/hubContent'
import PageLayout from './components/PageLayout'
import './TrainingHubPage.css'

// Single hub shell (PageLayout Pattern A: hero + overall-progress +
// progress-grid) for every equipment's /training/:equipmentId. It lists
// sections, not modules: the Training Modules card opens
// /training/:equipmentId/modules (ModuleListPage), which is where the
// per-module cards live for every equipment.
//
// Nothing here forks on the equipment any more except the scope notice, which
// carries a forklift-specific sentence: every equipment's modules, hotspots
// and percentages come from its own rows.
function TrainingHubPage({ equipmentId, user, onLogout, onNavigate }) {
  const [equipment, setEquipment] = useState(null)
  const [modules, setModules] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [hasPartsQuiz, setHasPartsQuiz] = useState(false)
  const [loading, setLoading] = useState(true)
  const { summary, resetProgress } = useProgress()

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getEquipment(),
      getTrainingModules(equipmentId),
      getHotspots(equipmentId, 'parts'),
      getQuizQuestions({ equipment: equipmentId, context: 'parts' }).catch(() => []),
    ]).then(([equipmentRows, moduleRows, hotspotRows, partsQuestions]) => {
      if (cancelled) return
      setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
      setModules(moduleRows)
      setHotspots(hotspotRows)
      setHasPartsQuiz(partsQuestions.length > 0)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  const equipmentTitle = equipment?.title || 'Equipment'
  // The parts page exists once the equipment has a model to show markers on.
  const hasPartsPage = Boolean(equipment?.modelUrl)
  const partsRoute = `/training/${equipmentId}/parts`
  const partsProgress = getPartsProgress(
    summary.raw,
    hotspots.map((hotspot) => hotspot.id),
    equipmentId,
    hasPartsQuiz,
  )
  const moduleSlugs = modules.map((module) => module.slug)
  const moduleProgress = getModulesProgress(summary.raw, moduleSlugs)

  const overall = getOverallProgress(summary.raw, moduleSlugs, hasPartsPage ? partsProgress : null)
  const modulesRoute = `/training/${equipmentId}/modules`
  const assessmentRoute = `/training/${equipmentId}/assessment`

  const continueTarget = modules.length ? modulesRoute : hasPartsPage ? partsRoute : null

  const copy = resolveHubContent(equipment, hubContentContext({
    equipmentTitle,
    learnerName: user?.fullName || 'learner',
    hasPartsPage,
    moduleTitles: modules.map((module) => module.subtitle || module.title),
  }))

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      {loading ? (
        <p className="progress-grid-empty">Loading modules...</p>
      ) : (
        <>
          <section className="training-hub-hero">
            <div>
              <p className="training-hub-kicker">{copy.kicker}</p>
              <h1>{copy.heading}</h1>
              <p>{copy.intro}</p>
            </div>
            {continueTarget && (
              <button className="continue-button" onClick={() => onNavigate(continueTarget)}>
                {copy.continueLabel} <ArrowRight size={16} />
              </button>
            )}
          </section>

          <article className="overall-progress-card">
            <div className="overall-progress-top">
              <div className="overall-progress-icon">
                <CircleGauge size={26} />
              </div>
              <div className="overall-progress-text">
                <p className="training-hub-kicker">{copy.overallTitle}</p>
                <p>{copy.overallDescription}</p>
              </div>
              <div className="overall-progress-stat">
                <strong>{overall}%</strong>
                <span>complete</span>
              </div>
            </div>
            <div className="progress-meter overall-progress-meter">
              <div><i style={{ width: `${overall}%` }} /></div>
            </div>
            <button onClick={() => onNavigate(assessmentRoute)}>
              {copy.assessmentCta} <ArrowRight size={16} />
            </button>
          </article>

          <section className="progress-grid" aria-label="Training progress">
            {modules.length > 0 && (
              <article className="progress-card">
                <div className="progress-card-icon">
                  <Layers size={22} />
                </div>
                <div className="progress-card-body">
                  <h2>{copy.modulesTitle}</h2>
                  <p>{copy.modulesDescription}</p>
                </div>
                <div className="progress-meter">
                  <span>{moduleProgress}%</span>
                  <div><i style={{ width: `${moduleProgress}%` }} /></div>
                </div>
                <button onClick={() => onNavigate(modulesRoute)}>
                  {copy.modulesCta} <ArrowRight size={16} />
                </button>
              </article>
            )}

            {hasPartsPage && (
              <article className="progress-card">
                <div className="progress-card-icon">
                  <PackageSearch size={22} />
                </div>
                <div className="progress-card-body">
                  <h2>{copy.partsTitle}</h2>
                  <p>{copy.partsDescription}</p>
                </div>
                <div className="progress-meter">
                  <span>{partsProgress}%</span>
                  <div><i style={{ width: `${partsProgress}%` }} /></div>
                </div>
                <button onClick={() => onNavigate(partsRoute)}>
                  {copy.partsCta} <ArrowRight size={16} />
                </button>
              </article>
            )}

            {modules.length === 0 && !hasPartsPage && !loading && (
              <p className="progress-grid-empty">No modules are available yet.</p>
            )}
          </section>

          <section className="recent-activity">
            <div className="recent-activity-icon">
              <ClipboardList size={22} />
            </div>
            <div className="recent-activity-body">
              <h2>{copy.activityTitle}</h2>
              <p>{copy.activityBody}</p>
            </div>
            <div className="recent-actions">
              <button onClick={() => onNavigate('/catalog')}>Equipment selection</button>
              <button className="reset-progress-button" onClick={resetProgress}>
                <RotateCcw size={15} /> Reset progress
              </button>
            </div>
          </section>
        </>
      )}
    </PageLayout>
  )
}

export default TrainingHubPage
