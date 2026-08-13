import { useEffect, useState } from 'react'
import { ArrowRight, CircleGauge, ClipboardList, Layers, PackageSearch, RotateCcw } from 'lucide-react'
import { getEquipment, getEquipmentHotspots, getTrainingModules } from './lib/api'
import { getGenericHotspotProgress, getGenericOverallProgress, getModuleProgress } from './lib/progressService'
import { useProgress } from './hooks/useProgress'
import PageLayout from './components/PageLayout'
import ScopeNotice, { FORKLIFT_SCOPE_NOTE } from './components/ScopeNotice'
import { routes } from './lib/router'
import './TrainingHubPage.css'

// Single hub shell (PageLayout Pattern A: hero + overall-progress +
// progress-grid) for every equipment's /training/:equipmentId. Every
// equipment's module cards - Forklift's included - come straight from its
// Module rows, so an admin can add/edit/remove them with no code change.
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
  const [loading, setLoading] = useState(true)
  const { summary, resetProgress } = useProgress()

  useEffect(() => {
    let cancelled = false

    Promise.all([getEquipment(), getTrainingModules(equipmentId), getEquipmentHotspots(equipmentId)]).then(
      ([equipmentRows, moduleRows, hotspotRows]) => {
        if (cancelled) return
        setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
        setModules(moduleRows)
        setHotspots(hotspotRows)
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  const equipmentTitle = equipment?.title || 'Equipment'
  // Forklift's parts page is the richer Part-table one and always exists; any
  // other equipment gets the hotspot page once it has a model configured.
  const hasPartsPage = isForklift || Boolean(equipment?.modelUrl)
  const partsRoute = isForklift ? routes.parts : `/training/${equipmentId}/parts`
  const partsProgress = isForklift ? summary.parts : getGenericHotspotProgress(summary.raw, hotspots.map((hotspot) => hotspot.id))
  const moduleSlugs = modules.map((module) => module.slug)
  const moduleProgress = moduleSlugs.map((slug) => getModuleProgress(summary.raw, slug))

  const overall = isForklift
    ? summary.overall
    : getGenericOverallProgress(summary.raw, moduleSlugs, hotspots.map((hotspot) => hotspot.id))
  const assessmentRoute = `/training/${equipmentId}/assessment`

  const continueTarget = modules[0]
    ? `/training/${equipmentId}/modules/${modules[0].slug}`
    : hasPartsPage
      ? partsRoute
      : null

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <ScopeNotice note={isForklift ? FORKLIFT_SCOPE_NOTE : undefined} />

      {loading ? (
        <p className="progress-grid-empty">Loading modules...</p>
      ) : (
        <>
          <section className="training-hub-hero">
            <div>
              <p className="training-hub-kicker">{equipmentTitle} Training</p>
              <h1>Welcome back, {user?.fullName || 'learner'}.</h1>
              <p>Continue your {equipmentTitle.toLowerCase()} familiarization training through the modules below.</p>
            </div>
            {continueTarget && (
              <button className="continue-button" onClick={() => onNavigate(continueTarget)}>
                Continue Training <ArrowRight size={16} />
              </button>
            )}
          </section>

          <article className="overall-progress-card">
            <div className="overall-progress-top">
              <div className="overall-progress-icon">
                <CircleGauge size={26} />
              </div>
              <div className="overall-progress-text">
                <p className="training-hub-kicker">Overall Progress</p>
                <p>
                  Combined progress across all training modules
                  {hasPartsPage ? ' and parts identification' : ''}.
                </p>
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
              View final assessment <ArrowRight size={16} />
            </button>
          </article>

          <section className="progress-grid" aria-label="Training progress">
            {modules.map((module, index) => (
              <article className="progress-card" key={module.id}>
                <div className="progress-card-icon">
                  <Layers size={22} />
                </div>
                <div className="progress-card-body">
                  <h2>{module.subtitle || module.title}</h2>
                  <p>{module.description}</p>
                </div>
                <div className="progress-meter">
                  <span>{moduleProgress[index]}%</span>
                  <div><i style={{ width: `${moduleProgress[index]}%` }} /></div>
                </div>
                <button onClick={() => onNavigate(`/training/${equipmentId}/modules/${module.slug}`)}>
                  Start module <ArrowRight size={16} />
                </button>
              </article>
            ))}

            {hasPartsPage && (
              <article className="progress-card">
                <div className="progress-card-icon">
                  <PackageSearch size={22} />
                </div>
                <div className="progress-card-body">
                  <h2>Parts Identification</h2>
                  <p>
                    {isForklift
                      ? 'Review major forklift components, functions, and safety reminders.'
                      : 'Tap hotspots on the 3D model to learn what each part is.'}
                  </p>
                </div>
                <div className="progress-meter">
                  <span>{partsProgress}%</span>
                  <div><i style={{ width: `${partsProgress}%` }} /></div>
                </div>
                <button onClick={() => onNavigate(partsRoute)}>
                  Open parts identification <ArrowRight size={16} />
                </button>
              </article>
            )}

            {modules.length === 0 && !hasPartsPage && (
              <p className="progress-grid-empty">No modules are available yet.</p>
            )}
          </section>

          <section className="recent-activity">
            <div className="recent-activity-icon">
              <ClipboardList size={22} />
            </div>
            <div className="recent-activity-body">
              <h2>Training activity will appear here</h2>
              <p>
                This placeholder will later show recently completed checklists, quiz attempts, and module updates.
              </p>
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
