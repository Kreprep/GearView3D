import { useEffect, useState } from 'react'
import { getTrainingModules } from './lib/api'
import './EquipmentUsagePage.css'

function EquipmentUsagePage({ moduleName, onBack, onSelectModule }) {
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
              <div key={module.id} className="module-card">
                <div className="module-image-placeholder module-image-forklift">
                  <span className="placeholder-text">{module.subtitle}</span>
                </div>
                <h3>{module.title}</h3>
                <h4>{module.subtitle}</h4>
                <p>{module.description}</p>
                <button className="start-module-button" onClick={() => onSelectModule(module.id)}>
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
