import { useEffect, useState } from 'react'
import { getTrainingModules } from './lib/api'
import { routes } from './lib/router'
import './EquipmentUsagePage.css'

const moduleRoutes = {
  1: routes.walkAround,
  2: routes.loadHandling,
  3: routes.postOperation,
}

function EquipmentUsagePage({ moduleName, onBack, onNavigate }) {
  const [modules, setModules] = useState([])

  useEffect(() => {
    getTrainingModules().then(setModules)
  }, [])

  return (
    <div className="training-page-container">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          Back
        </button>
        <h1>{moduleName} - Equipment Usage Modules</h1>
      </header>

      <main className="training-content">
        <div className="content-section">
          <p className="intro-text">Select a module to begin your forklift training:</p>

          <div className="modules-grid">
            {modules.map((module) => (
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
