import { useProgress } from '../hooks/useProgress'
import './ProgressSummary.css'

function ProgressSummary({ moduleSlug, value, title = 'Training Progress', compact = false, showReset = false, breakdown }) {
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
        {breakdown?.length ? (
          <div className="progress-summary-track has-breakdown">
            <div className="progress-summary-midline" />
            {breakdown.map((segment) => (
              <i
                key={segment.label}
                style={{ width: `${segment.share}%`, background: segment.color }}
                title={`${segment.label}: ${segment.rawValue}%`}
              />
            ))}
          </div>
        ) : (
          <div className="progress-summary-track"><i style={{ width: `${moduleProgress}%` }} /></div>
        )}
        {breakdown?.length ? (
          <ul className="progress-summary-legend">
            {breakdown.map((segment) => (
              <li key={segment.label}>
                <span className="legend-dot" style={{ background: segment.color }} />
                {segment.label} · {segment.rawValue}%
              </li>
            ))}
          </ul>
        ) : null}
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
