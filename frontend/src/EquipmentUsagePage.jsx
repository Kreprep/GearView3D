import { useEffect, useState } from 'react'
import { getTrainingModules } from './lib/api'
import { useProgress } from './hooks/useProgress'
import { routes } from './lib/router'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import './EquipmentUsagePage.css'

const moduleRoutes = {
  1: routes.walkAround,
  2: routes.loadHandling,
  3: routes.postOperation,
  4: routes.palletTesting,
}

function EquipmentUsagePage({ moduleName, user, onLogout, onBack, onNavigate }) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const { summary } = useProgress()

  useEffect(() => {
    getTrainingModules().then(setModules).finally(() => setLoading(false))
  }, [])

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="page-back-row">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1 className="page-heading">{moduleName} - Equipment Usage Modules</h1>
      </div>

      <ScopeNotice />
      <p className="intro-text">Select a module to begin your forklift training:</p>

      <div className="modules-grid">
        {loading && <div className="catalog-state">Loading equipment modules...</div>}
        {!loading && modules.length === 0 && <div className="catalog-state">No equipment modules are available yet.</div>}
        {!loading && modules.map((module) => (
          <div
            key={module.id}
            className="module-card"
            role="button"
            tabIndex={0}
            onClick={() => onNavigate(moduleRoutes[module.id])}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onNavigate(moduleRoutes[module.id])
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
                onNavigate(moduleRoutes[module.id])
              }}
            >
              Start Module {module.id}
            </button>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}

export default EquipmentUsagePage
