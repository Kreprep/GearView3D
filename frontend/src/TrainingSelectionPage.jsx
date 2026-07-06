import './TrainingSelectionPage.css'
import ProgressSummary from './components/ProgressSummary'
import { useProgress } from './hooks/useProgress'
import { routes } from './lib/router'

function TrainingSelectionPage({ moduleName, onNavigate, onBack }) {
  const { summary } = useProgress()

  return (
    <div className="training-selection-container">
      <header className="training-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1>{moduleName} Training</h1>
      </header>

      <section className="forklift-overview-progress">
        <ProgressSummary title="Overall Forklift Progress" compact />
        <div className="overview-stat-card">
          <p>Equipment Usage</p>
          <strong>{summary.equipment}%</strong>
        </div>
        <div className="overview-stat-card">
          <p>Parts Identification</p>
          <strong>{summary.parts}%</strong>
        </div>
      </section>

      <main className="training-options">
        <div
          className="option-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate(routes.equipment)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onNavigate(routes.equipment)
            }
          }}
        >
          <div className="option-icon">
            <span>Usage</span>
          </div>
          <h2>Equipment Usage</h2>
          <p>Learn safe forklift familiarization through walk-around checks, load handling, and post-operation steps.</p>
          <button
            className="option-button"
            onClick={(event) => {
              event.stopPropagation()
              onNavigate(routes.equipment)
            }}
          >
            Start Equipment Training
          </button>
        </div>

        <div
          className="option-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate(routes.parts)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onNavigate(routes.parts)
            }
          }}
        >
          <div className="option-icon">
            <span>Parts</span>
          </div>
          <h2>Parts Identification</h2>
          <p>Identify the main forklift components, their functions, and their safety reminders.</p>
          <button
            className="option-button"
            onClick={(event) => {
              event.stopPropagation()
              onNavigate(routes.parts)
            }}
          >
            Start Parts Training
          </button>
        </div>

        <div
          className="option-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate(routes.assessment)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onNavigate(routes.assessment)
            }
          }}
        >
          <div className="option-icon">
            <span>Check</span>
          </div>
          <h2>Knowledge Check</h2>
          <p>Open the assessment route reserved for forklift quiz and knowledge-check activities.</p>
          <button
            className="option-button"
            onClick={(event) => {
              event.stopPropagation()
              onNavigate(routes.assessment)
            }}
          >
            Open Assessment
          </button>
        </div>
      </main>
    </div>
  )
}

export default TrainingSelectionPage
