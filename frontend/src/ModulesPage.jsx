import { useEffect, useState } from 'react'
import AppHeader from './components/AppHeader'
import ScopeNotice from './components/ScopeNotice'
import { getEquipment } from './lib/api'
import { routes } from './lib/router'
import './ModulesPage.css'

function ModulesPage({ user, onLogout, onNavigate }) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEquipment().then(setModules).finally(() => setLoading(false))
  }, [])

  return (
    <div className="modules-container">
      <AppHeader user={user} onLogout={onLogout} onNavigate={onNavigate} />

      <main className="modules-layout">
        <aside className="browse-sidebar">
          <p className="sidebar-label">Training Catalog</p>
          <button className="sidebar-filter is-active" onClick={() => onNavigate(routes.forklift)}>Forklift</button>
          <button className="sidebar-filter" onClick={() => onNavigate(routes.parts)}>Parts Identification</button>
          <button className="sidebar-filter" onClick={() => onNavigate(routes.equipment)}>Equipment Usage</button>
          <div className="sidebar-note">
            <strong>Scope</strong>
            <span>Preparatory learning aid only. Not a certification simulator.</span>
          </div>
        </aside>

        <section className="module-browser">
          <ScopeNotice />
          <div className="catalog-hero">
            <div>
              <p className="catalog-kicker">Featured Training Model</p>
              <h2>Industrial Forklift Familiarization</h2>
              <p>
                Explore a 3D forklift, identify major components, and work through guided pre-operation,
                load-handling, and post-operation activities.
              </p>
            </div>
            <button className="hero-button" onClick={() => onNavigate(routes.forklift)}>
              Open Forklift
            </button>
          </div>

          <div className="catalog-toolbar">
            <span>{modules.length} available model</span>
            <span>Browser-based 3D training</span>
          </div>

          <div className="modules-grid">
            {loading && <div className="catalog-state">Loading training models...</div>}
            {!loading && modules.length === 0 && <div className="catalog-state">No training models are available yet.</div>}
            {!loading && modules.map((module) => (
              <article
                key={module.id}
                className="module-card"
                role="button"
                tabIndex={0}
                onClick={() => onNavigate(routes.forklift)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onNavigate(routes.forklift)
                  }
                }}
              >
                <div className="catalog-module-image module-image-forklift">
                  <span className="catalog-placeholder-text">{module.title}</span>
                </div>
                <div className="catalog-card-content">
                  <p className="module-type">Training model</p>
                  <h2>{module.title}</h2>
                  <p>{module.description}</p>
                  <button
                    className="catalog-start-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onNavigate(routes.forklift)
                    }}
                  >
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
