import { useEffect, useState } from 'react'
import { ArrowRight, CircleGauge, ClipboardList, Layers, PackageSearch, RotateCcw, Truck } from 'lucide-react'
import { getEquipment, getEquipmentHotspots, getTrainingModules } from './lib/api'
import { getGenericHotspotProgress, getGenericOverallProgress, getModuleProgress } from './lib/progressService'
import { useProgress } from './hooks/useProgress'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import { routes } from './lib/router'
import './TrainingHubPage.css'

// Single hub shell (PageLayout Pattern A: hero + overall-progress +
// progress-grid) for every equipment's /training/:equipmentId, forklift
// included, so this layout can only drift once instead of twice.
//
// Forklift keeps two hardcoded cards - Equipment Usage (its own sub-page
// grouping 4 modules behind a shared shell) and Parts Identification (the
// richer part-practice page with categories/quiz) - because those are real
// distinct destinations, not Module rows, and stay zero-fetch/instant like
// before. Every other equipment's cards come straight from its Module and
// EquipmentHotspot rows, so an admin can add/edit/remove them with no code
// change.
function TrainingHubPage({ equipmentId, user, onLogout, onNavigate }) {
  const isForklift = equipmentId === 'forklift'
  const [equipment, setEquipment] = useState(null)
  const [modules, setModules] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [loading, setLoading] = useState(!isForklift)
  const { summary, resetProgress } = useProgress()

  useEffect(() => {
    if (isForklift) return

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
  }, [equipmentId, isForklift])

  const equipmentTitle = isForklift ? 'Forklift' : equipment?.title || 'Equipment'
  const hasHotspots = !isForklift && Boolean(equipment?.modelUrl)
  const moduleSlugs = modules.map((module) => module.slug)
  const hotspotIds = hotspots.map((hotspot) => hotspot.id)
  const moduleProgress = moduleSlugs.map((slug) => getModuleProgress(summary.raw, slug))
  const hotspotProgress = getGenericHotspotProgress(summary.raw, hotspotIds)

  const overall = isForklift ? summary.overall : getGenericOverallProgress(summary.raw, moduleSlugs, hotspotIds)
  const assessmentRoute = isForklift ? routes.assessment : `/training/${equipmentId}/assessment`

  const continueTarget = isForklift
    ? routes.equipment
    : modules[0]
      ? `/training/${equipmentId}/modules/${modules[0].slug}`
      : hasHotspots
        ? `/training/${equipmentId}/parts`
        : null

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <ScopeNotice />

      {loading ? (
        <p className="progress-grid-empty">Loading modules...</p>
      ) : (
        <>
          <section className="training-hub-hero">
            <div>
              <p className="training-hub-kicker">{equipmentTitle} Training</p>
              <h1>Welcome back, {user?.fullName || 'learner'}.</h1>
              <p>
                Continue your {equipmentTitle.toLowerCase()} familiarization training through{' '}
                {isForklift
                  ? 'equipment usage, parts identification, and guided practice activities.'
                  : 'the modules below.'}
              </p>
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
                  {isForklift
                    ? 'Combined progress from equipment usage and parts identification activities.'
                    : `Combined progress across all training modules${hasHotspots ? ' and hotspot identification' : ''}.`}
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
            {isForklift ? (
              <>
                <article className="progress-card">
                  <div className="progress-card-icon">
                    <Truck size={22} />
                  </div>
                  <div className="progress-card-body">
                    <h2>Equipment Usage</h2>
                    <p>Walk-around, load handling, and post-operation familiarization.</p>
                  </div>
                  <div className="progress-meter">
                    <span>{summary.equipment}%</span>
                    <div><i style={{ width: `${summary.equipment}%` }} /></div>
                  </div>
                  <button onClick={() => onNavigate(routes.equipment)}>
                    Open equipment modules <ArrowRight size={16} />
                  </button>
                </article>

                <article className="progress-card">
                  <div className="progress-card-icon">
                    <PackageSearch size={22} />
                  </div>
                  <div className="progress-card-body">
                    <h2>Parts Identification</h2>
                    <p>Review major forklift components, functions, and safety reminders.</p>
                  </div>
                  <div className="progress-meter">
                    <span>{summary.parts}%</span>
                    <div><i style={{ width: `${summary.parts}%` }} /></div>
                  </div>
                  <button onClick={() => onNavigate(routes.parts)}>
                    Open parts identification <ArrowRight size={16} />
                  </button>
                </article>
              </>
            ) : (
              <>
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

                {hasHotspots && (
                  <article className="progress-card">
                    <div className="progress-card-icon">
                      <PackageSearch size={22} />
                    </div>
                    <div className="progress-card-body">
                      <h2>Hotspot Identification</h2>
                      <p>Tap hotspots on the 3D model to learn what each part is.</p>
                    </div>
                    <div className="progress-meter">
                      <span>{hotspotProgress}%</span>
                      <div><i style={{ width: `${hotspotProgress}%` }} /></div>
                    </div>
                    <button onClick={() => onNavigate(`/training/${equipmentId}/parts`)}>
                      Open hotspot identification <ArrowRight size={16} />
                    </button>
                  </article>
                )}

                {modules.length === 0 && !hasHotspots && (
                  <p className="progress-grid-empty">No modules are available yet.</p>
                )}
              </>
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
