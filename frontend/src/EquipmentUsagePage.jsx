import { useEffect, useState } from 'react'
import { getTrainingModules } from './lib/api'
import { useProgress } from './hooks/useProgress'
import { routes } from './lib/router'
import ScopeNotice from './components/ScopeNotice'
import './EquipmentUsagePage.css'

const moduleRoutes = {
  1: routes.walkAround,
  2: routes.loadHandling,
  3: routes.postOperation,
}

function EquipmentUsagePage({ moduleName, onBack, onNavigate }) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const { summary } = useProgress()

  useEffect(() => {
    getTrainingModules().then(setModules).finally(() => setLoading(false))
  }, [])

  return (
    <div className="training-page-container">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1>{moduleName} - Equipment Usage Modules</h1>
      </header>

      <main className="training-content">
        <div className="content-section">
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
                <div className="module-image-placeholder module-image-forklift">
                  <span className="placeholder-text">{module.subtitle}</span>
                </div>
                <h3>{module.title}</h3>
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
        </div>
      </main>
    </div>
  )
}

export default EquipmentUsagePage
