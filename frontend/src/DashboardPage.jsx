import AppHeader from './components/AppHeader'
import { useProgress } from './hooks/useProgress'
import { routes } from './lib/router'
import './DashboardPage.css'

function DashboardPage({ user, onLogout, onNavigate }) {
  const { summary, resetProgress } = useProgress()

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
              <p className="dashboard-kicker">Overall Progress</p>
              <h2>Forklift Training</h2>
              <p>Combined progress from equipment usage and parts identification activities.</p>
            </div>
            <div className="progress-meter">
              <span>{summary.overall}%</span>
              <div><i style={{ width: `${summary.overall}%` }} /></div>
            </div>
            <button onClick={() => onNavigate(routes.assessment)}>View final assessment</button>
          </article>

          <article className="progress-card">
            <div>
              <p className="dashboard-kicker">Module Progress</p>
              <h2>Equipment Usage</h2>
              <p>Walk-around, load handling, and post-operation familiarization.</p>
            </div>
            <div className="progress-meter">
              <span>{summary.equipment}%</span>
              <div><i style={{ width: `${summary.equipment}%` }} /></div>
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
              <span>{summary.parts}%</span>
              <div><i style={{ width: `${summary.parts}%` }} /></div>
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
          <div className="recent-actions">
            <button onClick={() => onNavigate(routes.catalog)}>Browse catalog</button>
            <button className="reset-progress-button" onClick={resetProgress}>Reset progress</button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DashboardPage
