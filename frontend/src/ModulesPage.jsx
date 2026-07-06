import { useEffect, useState } from 'react'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import { getEquipment } from './lib/api'
import { routes } from './lib/router'
import './ModulesPage.css'

const comingSoonEquipment = [
  { id: 'backhoe', title: 'Backhoe Loader', description: 'Heavy equipment training model. Coming soon.' },
  { id: 'crane', title: 'Mobile Crane', description: 'Heavy equipment training model. Coming soon.' },
]

function ModulesPage({ user, onLogout, onNavigate }) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEquipment().then(setModules).finally(() => setLoading(false))
  }, [])

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <section className="module-browser">
        <ScopeNotice />
        <div className="catalog-toolbar">
          <span>{modules.length} available model</span>
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
          {comingSoonEquipment.map((equipment) => (
            <article key={equipment.id} className="module-card module-card-disabled">
              <div className="catalog-module-image module-image-placeholder">
                <span className="catalog-placeholder-text">{equipment.title}</span>
              </div>
              <div className="catalog-card-content">
                <p className="module-type">Training model</p>
                <h2>{equipment.title}</h2>
                <p>{equipment.description}</p>
                <span className="catalog-coming-soon-badge">Coming Soon</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PageLayout>
  )
}

export default ModulesPage
