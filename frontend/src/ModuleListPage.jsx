import { useEffect, useState } from 'react'
import { getEquipment, getTrainingModules } from './lib/api'
import { getModuleProgress } from './lib/progressService'
import { useProgress } from './hooks/useProgress'
import { hubContentContext, resolveHubContent } from './lib/hubContent'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import './ModuleListPage.css'

// /training/:equipmentId/modules - the module picker sitting between the hub
// and a module's guided simulation, for every equipment. Cards come straight
// from the Module rows, so an admin adding a module adds a card here with no
// code change.
function ModuleListPage({ equipmentId, user, onLogout, onBack, onNavigate }) {
  const [equipment, setEquipment] = useState(null)
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const { summary } = useProgress()

  useEffect(() => {
    let cancelled = false

    Promise.all([getEquipment(), getTrainingModules(equipmentId)]).then(([equipmentRows, moduleRows]) => {
      if (cancelled) return
      setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
      setModules(moduleRows)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  const equipmentTitle = equipment?.title || 'Equipment'
  const openModule = (module) => onNavigate(`/training/${equipmentId}/modules/${module.slug}`)

  const copy = resolveHubContent(equipment, hubContentContext({
    equipmentTitle,
    learnerName: user?.fullName || 'learner',
    moduleTitles: modules.map((module) => module.subtitle || module.title),
  }))

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="page-back-row">
        <button className="back-button" onClick={onBack}>
          Back to Training Hub
        </button>
        <h1 className="page-heading">{copy.moduleListHeading}</h1>
      </div>

      <ScopeNotice equipmentId={equipmentId} />
      <p className="module-list-intro">{copy.moduleListIntro}</p>

      <div className="module-list-grid">
        {loading && <div className="module-list-state">Loading training modules...</div>}
        {!loading && modules.length === 0 && (
          <div className="module-list-state">No training modules are available yet.</div>
        )}
        {!loading && modules.map((module, index) => {
          const percentage = getModuleProgress(summary.raw, module.slug)

          return (
            <div
              key={module.id}
              className="module-list-card"
              role="button"
              tabIndex={0}
              onClick={() => openModule(module)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openModule(module)
                }
              }}
            >
              <div
                className="module-list-image"
                style={module.imageUrl ? {
                  backgroundImage: `linear-gradient(180deg, rgba(8, 15, 28, 0.55), rgba(8, 15, 28, 0.78)), url('${module.imageUrl}')`,
                } : undefined}
              >
                <span className="module-list-image-text">{module.title}</span>
              </div>
              <h4>{module.subtitle || module.title}</h4>
              <p>{module.description}</p>
              <div className="module-list-progress">
                <span>{percentage}% complete</span>
                <div><i style={{ width: `${percentage}%` }} /></div>
              </div>
              <button
                className="module-list-start-button"
                onClick={(event) => {
                  event.stopPropagation()
                  openModule(module)
                }}
              >
                Start Module {index + 1}
              </button>
            </div>
          )
        })}
      </div>
    </PageLayout>
  )
}

export default ModuleListPage
