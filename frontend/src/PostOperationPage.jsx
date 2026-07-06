import './PostOperationPage.css'
import Model3DViewer from './components/Model3DViewer'
import GuidedChecklist from './components/GuidedChecklist'
import ProgressSummary from './components/ProgressSummary'

function PostOperationPage({ moduleName, onBack }) {
  return (
    <div className="module-page-container">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <div className="module-title-section">
          <h1>Module 3: Post-Operation</h1>
          <h2>{moduleName} Secure Parking</h2>
        </div>
      </header>

      <main className="module-content">
        <ProgressSummary moduleSlug="post-operation" title="Post-Operation Progress" compact />

        <section className="syllabus-section">
          <h3>Training Reference</h3>
          <div className="syllabus-info">
            <p><strong>Focus:</strong> Safe parking, shutdown, and reporting of unsafe conditions</p>
            <p><strong>Scope:</strong> Basic familiarization for trainees before supervised practical operation</p>
          </div>
        </section>

        <section className="learning-objectives">
          <h3>Learning Objectives</h3>
          <p>Follow a safe shutdown sequence and understand why post-operation discipline matters after forklift use.</p>
        </section>

        <section className="post-operation-section">
          <div className="operation-step parking-sequence">
            <h3>Safe Parking Sequence</h3>
            <div className="step-content">
              <h4>Parking Protocol</h4>

              <div className="step-item">
                <div className="step-number">1</div>
                <div className="step-details">
                  <h5>Select a Level Surface</h5>
                  <p>Park away from traffic, slopes, exits, and unsafe obstructions.</p>
                  <Model3DViewer height="260px" />
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">2</div>
                <div className="step-details">
                  <h5>Lower Forks Completely</h5>
                  <p>Lower forks flat to the ground so they do not create a trip or impact hazard.</p>
                  <Model3DViewer height="260px" />
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">3</div>
                <div className="step-details">
                  <h5>Secure the Controls</h5>
                  <p>Set direction controls to neutral and engage the parking brake.</p>
                  <Model3DViewer height="260px" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="critical-reminder">
          <h3>Critical Reminder</h3>
          <p>Minor troubleshooting in this prototype is limited to reporting visible unsafe conditions. Maintenance and repair work should be handled by qualified personnel.</p>
        </section>

        <GuidedChecklist moduleSlug="post-operation" title="Interactive Post-Operation Checklist" />
      </main>
    </div>
  )
}

export default PostOperationPage
