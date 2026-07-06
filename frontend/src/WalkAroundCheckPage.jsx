import './WalkAroundCheckPage.css'
import Model3DViewer from './components/Model3DViewer'
import GuidedChecklist from './components/GuidedChecklist'
import ProgressSummary from './components/ProgressSummary'
import ModuleQuiz from './components/ModuleQuiz'
import ModuleCompletionSummary from './components/ModuleCompletionSummary'
import { routes } from './lib/router'

function WalkAroundCheckPage({ moduleName, onBack, onNavigate }) {
  return (
    <div className="module-page-container">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <div className="module-title-section">
          <h1>Module 1: Walk-Around Check</h1>
          <h2>{moduleName} Visual Inspection</h2>
        </div>
      </header>

      <main className="module-content">
        <ProgressSummary moduleSlug="walk-around-check" title="Walk-Around Progress" compact />

        <section className="syllabus-section">
          <h3>Training Reference</h3>
          <div className="syllabus-info">
            <p><strong>Focus:</strong> Pre-operation visual inspection and safety device check</p>
            <p><strong>Scope:</strong> Preparatory familiarization only; not a certification assessment</p>
          </div>
        </section>

        <section className="learning-objectives">
          <h3>Learning Objectives</h3>
          <p>Trainees should learn what to visually check before operating a forklift and why each check matters for safe operation.</p>
        </section>

        <section className="inspection-section">
          <div className="inspection-state engine-off">
            <h3>Engine-Off Visual Checks</h3>

            <div className="inspection-area">
              <h4>Fluid Leaks</h4>
              <p>Inspect under the forklift and around the engine area for signs of fluid leaks.</p>
              <ul>
                <li>Engine oil leaks</li>
                <li>Hydraulic oil leaks</li>
                <li>Battery electrolyte leaks</li>
                <li>Cooling system or coolant leaks</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>

            <div className="inspection-area">
              <h4>Visible Damage</h4>
              <p>Check structural and operating parts for visible damage before use.</p>
              <ul>
                <li>Cracks or damage on the mast assembly</li>
                <li>Excessive tire wear or unsafe tire condition</li>
                <li>Loose, missing, or damaged visible parts</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>
          </div>

          <div className="inspection-state engine-on">
            <h3>Engine-On Functional Checks</h3>

            <div className="inspection-area">
              <h4>Instrument Panel</h4>
              <p>Check important gauges and indicators before entering the work area.</p>
              <ul>
                <li>Battery charging indicator</li>
                <li>Engine oil pressure gauge</li>
                <li>Water temperature gauge</li>
                <li>Fuel level gauge</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>

            <div className="inspection-area">
              <h4>Safety Devices</h4>
              <p>Confirm that warning and safety devices are working.</p>
              <ul>
                <li>Horn operation</li>
                <li>Headlights and signal lights</li>
                <li>Warning beacon or strobe light</li>
                <li>Automatic backup alarm</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>
          </div>
        </section>

        <GuidedChecklist moduleSlug="walk-around-check" title="Interactive Walk-Around Checklist" />
        <ModuleQuiz moduleSlug="walk-around-check" title="Walk-Around Knowledge Check" />
        <ModuleCompletionSummary
          moduleSlug="walk-around-check"
          moduleTitle="Walk-Around Check"
          nextLabel="Next: Load Handling"
          onNext={() => onNavigate(routes.loadHandling)}
        />
      </main>
    </div>
  )
}

export default WalkAroundCheckPage
