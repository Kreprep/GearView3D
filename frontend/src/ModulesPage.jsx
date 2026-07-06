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
        <div className="brand-block">
          <span className="brand-mark">GV</span>
          <div>
            <h1>GearView3D</h1>
            <p>Forklift training workspace</p>
          </div>
        </div>
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

      <main className="modules-layout">
        <aside className="browse-sidebar">
          <p className="sidebar-label">Training Catalog</p>
          <button className="sidebar-filter is-active">Forklift</button>
          <button className="sidebar-filter">Parts Identification</button>
          <button className="sidebar-filter">Equipment Usage</button>
          <div className="sidebar-note">
            <strong>Scope</strong>
            <span>Preparatory learning aid only. Not a certification simulator.</span>
          </div>
        </aside>

        <section className="module-browser">
          <div className="catalog-hero">
            <div>
              <p className="catalog-kicker">Featured Training Model</p>
              <h2>Industrial Forklift Familiarization</h2>
              <p>
                Explore a 3D forklift, identify major components, and work through guided pre-operation,
                load-handling, and post-operation activities.
              </p>
            </div>
            <button className="hero-button" onClick={() => onStartTraining('Forklift')}>
              Open Forklift
            </button>
          </div>

          <div className="catalog-toolbar">
            <span>{modules.length} available model</span>
            <span>Browser-based 3D training</span>
          </div>

          <div className="modules-grid">
            {modules.map((module) => (
              <article key={module.id} className="module-card">
                <div className="module-image-placeholder module-image-forklift">
                  <span className="placeholder-text">{module.title}</span>
                </div>
                <div className="module-content">
                  <p className="module-type">Training model</p>
                  <h2>{module.title}</h2>
                  <p>{module.description}</p>
                  <button className="start-button" onClick={() => onStartTraining(module.title)}>
                    Start Training
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default ModulesPage
