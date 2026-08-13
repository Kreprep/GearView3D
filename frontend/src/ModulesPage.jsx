import { useEffect, useState } from 'react'
import { ArrowRight, Clock } from 'lucide-react'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import { getEquipment } from './lib/api'
import { routes } from './lib/router'
import './ModulesPage.css'

// Which equipment ids have an actual training page to send learners to.
// `available` alone isn't enough to gate navigation on - it's an admin-
// editable DB flag with no guarantee a page exists behind it yet (Backhoe and
// Mobile Crane are catalogue rows with no model/scenario content at all), so
// an admin flipping it on shouldn't be able to send learners into a redirect
// to the wrong equipment's page. Add an entry here when a new equipment's
// training page is actually built.
const EQUIPMENT_TRAINING_ROUTES = {
  forklift: routes.forklift,
}

function ModulesPage({ user, onLogout, onNavigate }) {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEquipment().then(setEquipment).finally(() => setLoading(false))
  }, [])

  // A card only renders as a clickable link into training when it's both
  // marked available AND has an implemented route; everything else - including
  // an "available" equipment with no page yet - falls back to "Coming Soon".
  const modules = equipment.filter((item) => item.available !== false && EQUIPMENT_TRAINING_ROUTES[item.id])
  const comingSoonEquipment = equipment.filter((item) => item.available === false || !EQUIPMENT_TRAINING_ROUTES[item.id])

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <section className="module-browser">
        <ScopeNotice />
        <div className="catalog-toolbar">
          <span>{modules.length} available model{modules.length === 1 ? '' : 's'}</span>
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
              onClick={() => onNavigate(EQUIPMENT_TRAINING_ROUTES[module.id])}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onNavigate(EQUIPMENT_TRAINING_ROUTES[module.id])
                }
              }}
            >
              <div
                className="catalog-module-image catalog-module-image-forklift"
                style={module.imageUrl ? {
                  backgroundImage: `linear-gradient(180deg, rgba(8, 15, 28, 0.55), rgba(8, 15, 28, 0.78)), url('${module.imageUrl}')`,
                } : undefined}
              />
              <div className="catalog-card-body">
                <div className="catalog-card-heading">
                  <h2>{module.title}</h2>
                  <span className="status-pill status-pill-available">Available</span>
                </div>
                <p>{module.description}</p>
                <button
                  className="catalog-start-button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onNavigate(EQUIPMENT_TRAINING_ROUTES[module.id])
                  }}
                >
                  Start Training <ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))}
          {comingSoonEquipment.map((equipment) => (
            <article key={equipment.id} className="module-card module-card-disabled">
              <div className="catalog-module-image module-image-placeholder" />
              <div className="catalog-card-body">
                <div className="catalog-card-heading">
                  <h2>{equipment.title}</h2>
                  <span className="status-pill status-pill-soon">
                    <Clock size={11} /> Coming Soon
                  </span>
                </div>
                <p>{equipment.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PageLayout>
  )
}

export default ModulesPage
