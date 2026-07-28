import { ArrowRight, CircleGauge, ClipboardList, PackageSearch, RotateCcw, Truck } from 'lucide-react'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { routes } from './lib/router'
import './ForkliftTrainingPage.css'

function ForkliftTrainingPage({ moduleName = 'Forklift', user, onLogout, onNavigate }) {
  const { summary, resetProgress } = useProgress()

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <ScopeNotice />
      <section className="forklift-training-hero">
        <div>
          <p className="forklift-training-kicker">{moduleName} Training</p>
          <h1>Welcome back, {user?.fullName || 'learner'}.</h1>
          <p>
            Continue your {moduleName.toLowerCase()} familiarization training through equipment usage, parts
            identification, and guided practice activities.
          </p>
        </div>
        <button className="continue-button" onClick={() => onNavigate(routes.equipment)}>
          Continue Training <ArrowRight size={16} />
        </button>
      </section>

      <article className="overall-progress-card">
        <div className="overall-progress-top">
          <div className="overall-progress-icon">
            <CircleGauge size={26} />
          </div>
          <div className="overall-progress-text">
            <p className="forklift-training-kicker">Overall Progress</p>
            <p>Combined progress from equipment usage and parts identification activities.</p>
          </div>
          <div className="overall-progress-stat">
            <strong>{summary.overall}%</strong>
            <span>complete</span>
          </div>
        </div>
        <div className="progress-meter overall-progress-meter">
          <div><i style={{ width: `${summary.overall}%` }} /></div>
        </div>
        <button onClick={() => onNavigate(routes.assessment)}>
          View final assessment <ArrowRight size={16} />
        </button>
      </article>

      <section className="progress-grid" aria-label="Training progress">
        <article className="progress-card">
          <div className="progress-card-icon">
            <Truck size={22} />
          </div>
          <div className="progress-card-body">
            <h2>Equipment Usage</h2>
            <p>Walk-around, load handling, and post-operation familiarization.</p>
          </div>
          <div className="progress-meter">
            <span>{summary.equipment}%</span>
            <div><i style={{ width: `${summary.equipment}%` }} /></div>
          </div>
          <button onClick={() => onNavigate(routes.equipment)}>
            Open equipment modules <ArrowRight size={16} />
          </button>
        </article>

        <article className="progress-card">
          <div className="progress-card-icon">
            <PackageSearch size={22} />
          </div>
          <div className="progress-card-body">
            <h2>Parts Identification</h2>
            <p>Review major forklift components, functions, and safety reminders.</p>
          </div>
          <div className="progress-meter">
            <span>{summary.parts}%</span>
            <div><i style={{ width: `${summary.parts}%` }} /></div>
          </div>
          <button onClick={() => onNavigate(routes.parts)}>
            Open parts identification <ArrowRight size={16} />
          </button>
        </article>
      </section>

      <section className="recent-activity">
        <div className="recent-activity-icon">
          <ClipboardList size={22} />
        </div>
        <div className="recent-activity-body">
          <h2>Training activity will appear here</h2>
          <p>
            This placeholder will later show recently completed checklists, quiz attempts, and module updates.
          </p>
        </div>
        <div className="recent-actions">
          <button onClick={() => onNavigate(routes.catalog)}>Equipment selection</button>
          <button className="reset-progress-button" onClick={resetProgress}>
            <RotateCcw size={15} /> Reset progress
          </button>
        </div>
      </section>
    </PageLayout>
  )
}

export default ForkliftTrainingPage
