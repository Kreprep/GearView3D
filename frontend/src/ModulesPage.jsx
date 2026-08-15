import { useEffect, useState } from 'react'
import { ArrowRight, Clock } from 'lucide-react'
import PageLayout from './components/PageLayout'
import { getEquipment } from './lib/api'
import './ModulesPage.css'

// Every equipment's training lives at the same data-driven route, so which
// cards are clickable is derived rather than listed: an equipment has training
// once an admin marks it available AND it actually has something behind the
// card - at least one module, or a 3D model for its identification page.
// That keeps a card from linking into an empty hub while letting a new
// equipment go live with no code change.
function trainingRouteFor(equipment) {
  if (equipment.available === false) return null
  if (!equipment.moduleCount && !equipment.modelUrl) return null
  return `/training/${equipment.id}`
}

// The card artwork is whatever the admin set as this equipment's Catalog image.
// There is deliberately no default picture: the card used to fall back to
// forklift-card.png, so every equipment without an image of its own showed a
// forklift. An equipment with no image gets a plain tinted panel instead.
function cardImageStyle(equipment) {
  if (!equipment.imageUrl) return undefined

  return {
    backgroundImage: `linear-gradient(180deg, rgba(8, 15, 28, 0.55), rgba(8, 15, 28, 0.78)), url('${equipment.imageUrl}')`,
  }
}

function ModulesPage({ user, onLogout, onNavigate }) {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEquipment().then(setEquipment).finally(() => setLoading(false))
  }, [])

  // Anything without a route - unavailable, or available but still empty -
  // falls back to a "Coming Soon" card.
  const modules = equipment.filter((item) => trainingRouteFor(item))
  const comingSoonEquipment = equipment.filter((item) => !trainingRouteFor(item))

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <section className="module-browser">
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
              onClick={() => onNavigate(trainingRouteFor(module))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onNavigate(trainingRouteFor(module))
                }
              }}
            >
              <div
                className={`catalog-module-image${module.imageUrl ? '' : ' module-image-placeholder'}`}
                style={cardImageStyle(module)}
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
                    onNavigate(trainingRouteFor(module))
                  }}
                >
                  Start Training <ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))}
          {comingSoonEquipment.map((equipment) => (
            <article key={equipment.id} className="module-card module-card-disabled">
              <div
                className={`catalog-module-image${equipment.imageUrl ? '' : ' module-image-placeholder'}`}
                style={cardImageStyle(equipment)}
              />
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
