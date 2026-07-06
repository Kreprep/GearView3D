import { useEffect, useState } from 'react'
import { getEquipment } from './lib/api'
import './ModulesPage.css'

function ModulesPage({ user, onLogout, onStartTraining, onOpenAdmin }) {
  const [modules, setModules] = useState([])

  useEffect(() => {
    getEquipment().then(setModules)
  }, [])

  return (
    <div className="modules-container">
      <header className="modules-header">
        <h1>GearView3D Training Modules</h1>
        <div className="header-right">
          <span className="user-info">Welcome, {user?.fullName || user?.email}</span>
          {user?.role === 'ADMIN' && (
            <button className="logout-button" onClick={onOpenAdmin}>
              Admin
            </button>
          )}
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="modules-grid">
        {modules.map((module) => (
          <div key={module.id} className="module-card">
            <div className="module-image-placeholder module-image-forklift">
              <span className="placeholder-text">{module.title}</span>
            </div>
            <div className="module-content">
              <h2>{module.title}</h2>
              <p>{module.description}</p>
              <button className="start-button" onClick={() => onStartTraining(module.title)}>
                Start Training
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default ModulesPage
