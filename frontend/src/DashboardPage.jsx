import { useEffect, useMemo, useState } from 'react'
import AppHeader from './components/AppHeader'
import { getProgress } from './lib/api'
import { routes } from './lib/router'
import './DashboardPage.css'

const equipmentSlugs = ['walk-around-check', 'load-handling', 'post-operation']

function DashboardPage({ user, onLogout, onNavigate }) {
  const [progress, setProgress] = useState([])

  useEffect(() => {
    getProgress().then(setProgress)
  }, [])

  const equipmentProgress = useMemo(() => {
    const rows = progress.filter((item) => equipmentSlugs.includes(item.moduleSlug))
    if (!rows.length) return 0
    return Math.round(rows.reduce((sum, item) => sum + item.progress, 0) / equipmentSlugs.length)
  }, [progress])

  const partsProgress = useMemo(() => {
    const row = progress.find((item) => item.moduleSlug === 'parts-identification')
    return row?.progress || 0
  }, [progress])

  return (
    <div className="dashboard-page">
      <AppHeader user={user} onLogout={onLogout} onNavigate={onNavigate} />

      <main className="dashboard-layout">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-kicker">Learner Dashboard</p>
            <h1>Welcome back, {user?.fullName || 'learner'}.</h1>
            <p>
              Continue your forklift familiarization training through equipment usage, parts identification,
              and guided practice activities.
            </p>
          </div>
          <button className="continue-button" onClick={() => onNavigate(routes.forklift)}>
            Continue Training
          </button>
        </section>

        <section className="progress-grid" aria-label="Training progress">
          <article className="progress-card">
            <div>
              <p className="dashboard-kicker">Module Progress</p>
              <h2>Equipment Usage</h2>
              <p>Walk-around, load handling, and post-operation familiarization.</p>
            </div>
            <div className="progress-meter">
              <span>{equipmentProgress}%</span>
              <div><i style={{ width: `${equipmentProgress}%` }} /></div>
            </div>
            <button onClick={() => onNavigate(routes.equipment)}>Open equipment modules</button>
          </article>

          <article className="progress-card">
            <div>
              <p className="dashboard-kicker">Module Progress</p>
              <h2>Parts Identification</h2>
              <p>Review major forklift components, functions, and safety reminders.</p>
            </div>
            <div className="progress-meter">
              <span>{partsProgress}%</span>
              <div><i style={{ width: `${partsProgress}%` }} /></div>
            </div>
            <button onClick={() => onNavigate(routes.parts)}>Open parts identification</button>
          </article>
        </section>

        <section className="recent-activity">
          <div>
            <p className="dashboard-kicker">Recent Activity</p>
            <h2>Training activity will appear here</h2>
            <p>
              This placeholder will later show recently completed checklists, quiz attempts, and module updates.
            </p>
          </div>
          <button onClick={() => onNavigate(routes.catalog)}>Browse catalog</button>
        </section>
      </main>
    </div>
  )
}

export default DashboardPage
