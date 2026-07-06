import { routes } from './lib/router'
import { useProgress } from './hooks/useProgress'
import './AssessmentPage.css'

function AssessmentPage({ moduleName, onBack, onNavigate }) {
  const { summary, saveQuizAttempt } = useProgress()
  const latestAttempts = Object.entries(summary.quizAttempts).flatMap(([moduleSlug, attempts]) =>
    attempts.map((attempt) => ({ ...attempt, moduleSlug })),
  )
  const requiredComplete = summary.equipment === 100 && summary.parts === 100

  const handleSaveDemoAttempt = () => {
    saveQuizAttempt('final-assessment', { score: 4, total: 5 })
  }

  return (
    <div className="assessment-page">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          Back
        </button>
        <h1>{moduleName} - Knowledge Check</h1>
      </header>

      <main className="assessment-content">
        <section className="assessment-card">
          <p className="assessment-kicker">Progress Review</p>
          <h2>{requiredComplete ? 'Prototype Module Completion' : 'Training still in progress'}</h2>
          <p>
            This summary uses saved local progress. The badge refers only to GearView3D prototype module
            completion and does not imply official TESDA certification.
          </p>

          <div className="assessment-status-grid">
            <div>
              <span>Overall</span>
              <strong>{summary.overall}%</strong>
            </div>
            <div>
              <span>Equipment Usage</span>
              <strong>{summary.equipment}%</strong>
            </div>
            <div>
              <span>Parts Identification</span>
              <strong>{summary.parts}%</strong>
            </div>
          </div>

          <div className="assessment-review-grid">
            <article>
              <h3>Checklist Completion</h3>
              <ul>
                <li>Walk-Around Check: {summary.modules['walk-around-check'] || 0}%</li>
                <li>Load Handling: {summary.modules['load-handling'] || 0}%</li>
                <li>Post-Operation: {summary.modules['post-operation'] || 0}%</li>
              </ul>
            </article>
            <article>
              <h3>Quiz Attempts</h3>
              {latestAttempts.length ? (
                <ul>
                  {latestAttempts.slice(0, 4).map((attempt) => (
                    <li key={attempt.id}>{attempt.moduleSlug}: {attempt.score}/{attempt.total} ({attempt.percentage}%)</li>
                  ))}
                </ul>
              ) : (
                <p>No quiz attempts saved yet.</p>
              )}
            </article>
          </div>

          {requiredComplete && (
            <p className="completion-badge">GearView3D Training Completion</p>
          )}

          <div className="assessment-actions">
            <button onClick={() => onNavigate(routes.equipment)}>Review equipment usage</button>
            <button onClick={() => onNavigate(routes.parts)}>Review parts identification</button>
            <button className="secondary-assessment-button" onClick={handleSaveDemoAttempt}>
              Save test quiz attempt
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AssessmentPage
