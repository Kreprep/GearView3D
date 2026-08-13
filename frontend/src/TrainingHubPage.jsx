import { useEffect, useState } from 'react'
import { ArrowRight, CircleGauge, ClipboardList, Layers, PackageSearch, RotateCcw } from 'lucide-react'
import { getEquipment, getEquipmentHotspots, getQuizQuestions, getTrainingModules } from './lib/api'
import { getGenericModuleProgress, getGenericOverallProgress, getGenericPartsProgress } from './lib/progressService'
import { useProgress } from './hooks/useProgress'
import { hubContentContext, resolveHubContent } from './lib/hubContent'
import PageLayout from './components/PageLayout'
import ScopeNotice, { FORKLIFT_SCOPE_NOTE } from './components/ScopeNotice'
import { routes } from './lib/router'
import './TrainingHubPage.css'

// Single hub shell (PageLayout Pattern A: hero + overall-progress +
// progress-grid) for every equipment's /training/:equipmentId. It lists
// sections, not modules: the Training Modules card opens
// /training/:equipmentId/modules (ModuleListPage), which is where the
// per-module cards live for every equipment.
//
// What still tells Forklift apart: its Parts Identification card points at
// the richer part-practice page (categories + practice quiz, backed by the
// Part table) instead of the generic hotspot page, its overall percentage is
// the Part-table-aware summary.overall, and its scope notice carries the
// forklift-specific sentence. All three converge once parts practice becomes
// per-equipment.
function TrainingHubPage({ equipmentId, user, onLogout, onNavigate }) {
  const isForklift = equipmentId === 'forklift'
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
      getEquipmentHotspots(equipmentId),
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
  // Forklift's parts page is the richer Part-table one and always exists; any
  // other equipment gets the hotspot page once it has a model configured.
  const hasPartsPage = isForklift || Boolean(equipment?.modelUrl)
  const partsRoute = isForklift ? routes.parts : `/training/${equipmentId}/parts`
  const partsProgress = isForklift
    ? summary.parts
    : getGenericPartsProgress(summary.raw, hotspots.map((hotspot) => hotspot.id), equipmentId, hasPartsQuiz)
  const moduleSlugs = modules.map((module) => module.slug)
  const moduleProgress = isForklift ? summary.equipment : getGenericModuleProgress(summary.raw, moduleSlugs)

  const overall = isForklift
    ? summary.overall
    : getGenericOverallProgress(summary.raw, moduleSlugs, hasPartsPage ? partsProgress : null)
  const modulesRoute = `/training/${equipmentId}/modules`
  const assessmentRoute = `/training/${equipmentId}/assessment`

  const continueTarget = modules.length ? modulesRoute : hasPartsPage ? partsRoute : null

  const copy = resolveHubContent(equipment, hubContentContext({
    equipmentTitle,
    learnerName: user?.fullName || 'learner',
    isForklift,
    hasPartsPage,
    moduleTitles: modules.map((module) => module.subtitle || module.title),
  }))

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <ScopeNotice note={isForklift ? FORKLIFT_SCOPE_NOTE : undefined} />

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
