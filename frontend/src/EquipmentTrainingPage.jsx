import { useEffect, useState } from 'react'
import { getEquipment, getTrainingModules } from './lib/api'
import { useProgress } from './hooks/useProgress'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import './EquipmentUsagePage.css'

// The equivalent of EquipmentUsagePage for any equipment other than Forklift.
// Forklift keeps its own hardcoded hub + moduleRoutes map (4 known modules,
// each with its own bespoke page); every other equipment's modules are
// data-driven, so this page and GenericModulePage work off whatever Module
// rows exist for `equipmentId` rather than a fixed list.
function EquipmentTrainingPage({ equipmentId, user, onLogout, onNavigate }) {
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

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="page-back-row">
        <button className="back-button" onClick={() => onNavigate('/catalog')}>
          Back to Modules
        </button>
        <h1 className="page-heading">{equipment?.title || 'Equipment'} - Training Modules</h1>
      </div>

      <ScopeNotice />
      <p className="intro-text">Select a module to begin your training:</p>

      <div className="modules-grid">
        {loading && <div className="catalog-state">Loading modules...</div>}
        {!loading && modules.length === 0 && <div className="catalog-state">No modules are available yet.</div>}
        {!loading && modules.map((module) => (
          <div
            key={module.id}
            className="module-card"
            role="button"
            tabIndex={0}
            onClick={() => onNavigate(`/training/${equipmentId}/modules/${module.slug}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onNavigate(`/training/${equipmentId}/modules/${module.slug}`)
              }
            }}
          >
            <div
              className="module-image-placeholder"
              style={module.imageUrl ? {
                backgroundImage: `linear-gradient(180deg, rgba(8, 15, 28, 0.55), rgba(8, 15, 28, 0.78)), url('${module.imageUrl}')`,
              } : undefined}
            >
              <span className="placeholder-text">{module.title}</span>
            </div>
            <h4>{module.subtitle}</h4>
            <p>{module.description}</p>
            <div className="module-progress-inline">
              <span>{summary.modules[module.slug] || 0}% complete</span>
              <div><i style={{ width: `${summary.modules[module.slug] || 0}%` }} /></div>
            </div>
            <button
              className="start-module-button"
              onClick={(event) => {
                event.stopPropagation()
                onNavigate(`/training/${equipmentId}/modules/${module.slug}`)
              }}
            >
              Start Module
            </button>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}

export default EquipmentTrainingPage
