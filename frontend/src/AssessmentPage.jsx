import { routes } from './lib/router'
import './AssessmentPage.css'

function AssessmentPage({ moduleName, onBack, onNavigate }) {
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
          <p className="assessment-kicker">Coming Next</p>
          <h2>Assessment module</h2>
          <p>
            This page is reserved for GearView3D quizzes and knowledge checks. It keeps the route active
            while the quiz feature is implemented in the next phase.
          </p>
          <div className="assessment-actions">
            <button onClick={() => onNavigate(routes.equipment)}>Review equipment usage</button>
            <button onClick={() => onNavigate(routes.parts)}>Review parts identification</button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AssessmentPage
