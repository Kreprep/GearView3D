import { useProgress } from '../hooks/useProgress'
import './ProgressSummary.css'

function ProgressSummary({ moduleSlug, value, title = 'Training Progress', compact = false, showReset = false }) {
  const { summary, resetProgress } = useProgress()
  const moduleProgress = typeof value === 'number' ? value : moduleSlug ? summary.modules[moduleSlug] || 0 : summary.overall

  return (
    <section className={`progress-summary ${compact ? 'is-compact' : ''}`}>
      <div>
        <p className="progress-summary-kicker">{moduleSlug ? 'Module Status' : 'Overall Status'}</p>
        <h3>{title}</h3>
      </div>
      <div className="progress-summary-meter">
        <span>{moduleProgress}%</span>
        <div><i style={{ width: `${moduleProgress}%` }} /></div>
      </div>
      {showReset && (
        <button className="progress-reset" onClick={resetProgress}>
          Reset progress
        </button>
      )}
    </section>
  )
}

export default ProgressSummary
