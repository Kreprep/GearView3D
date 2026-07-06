import './LoadHandlingPage.css'
import Model3DViewer from './components/Model3DViewer'
import GuidedChecklist from './components/GuidedChecklist'
import ProgressSummary from './components/ProgressSummary'
import ModuleQuiz from './components/ModuleQuiz'
import ModuleCompletionSummary from './components/ModuleCompletionSummary'
import { routes } from './lib/router'

function LoadHandlingPage({ moduleName, onBack, onNavigate }) {
  return (
    <div className="module-page-container">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <div className="module-title-section">
          <h1>Module 2: Load Handling</h1>
          <h2>{moduleName} Operational Controls</h2>
        </div>
      </header>

      <main className="module-content">
        <ProgressSummary moduleSlug="load-handling" title="Load Handling Progress" compact />

        <section className="syllabus-section">
          <h3>Training Reference</h3>
          <div className="syllabus-info">
            <p><strong>Reference:</strong> OSHA Powered Industrial Trucks eTool - Operating a Forklift: Load Handling</p>
            <p><strong>URL:</strong> https://www.osha.gov/etools/powered-industrial-trucks/operating-forklift/load-handling</p>
          </div>
        </section>

        <section className="learning-objectives">
          <h3>Learning Objectives</h3>
          <p>Practice the basic thinking sequence for approaching, lifting, stabilizing, and traveling with a load.</p>
        </section>

        <section className="operation-section">
          <div className="operation-module maneuvering">
            <h3>Maneuvering and Positioning</h3>
            <div className="operation-area">
              <h4>Positioning the Forklift</h4>
              <p>Approach the load slowly and squarely before inserting the forks.</p>
              <ul>
                <li>Align the forklift perpendicular to the load</li>
                <li>Maintain safe approach speed</li>
                <li>Position forks at the correct height</li>
                <li>Confirm the path is clear before moving</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>
          </div>

          <div className="operation-module stability">
            <h3>Load Stability</h3>
            <div className="operation-area">
              <h4>Stability Triangle Concept</h4>
              <p>Understand that the load changes the forklift center of gravity and affects stability.</p>
              <ul>
                <li>Keep the load centered</li>
                <li>Respect the rated capacity plate</li>
                <li>Keep the load low when traveling</li>
                <li>Avoid sudden turns or stops with a raised load</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>
          </div>

          <div className="operation-module controls">
            <h3>Basic Control Familiarization</h3>
            <div className="operation-area">
              <h4>Fork and Mast Controls</h4>
              <p>Review the purpose of the lift, tilt, and travel controls before hands-on training.</p>
              <ul>
                <li><strong>Lift:</strong> Raises or lowers the forks</li>
                <li><strong>Tilt:</strong> Adjusts mast angle for load stability</li>
                <li><strong>Travel:</strong> Moves the forklift while maintaining visibility and control</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>
          </div>
        </section>

        <GuidedChecklist moduleSlug="load-handling" title="Interactive Load Handling Checklist" />
        <ModuleQuiz moduleSlug="load-handling" title="Load Handling Knowledge Check" />
        <ModuleCompletionSummary
          moduleSlug="load-handling"
          moduleTitle="Load Handling"
          nextLabel="Next: Post-Operation"
          onNext={() => onNavigate(routes.postOperation)}
        />
      </main>
    </div>
  )
}

export default LoadHandlingPage
