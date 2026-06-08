import './WalkAroundCheckPage.css'
import Model3DViewer from './components/Model3DViewer'

function WalkAroundCheckPage({ moduleName, onBack }) {
  return (
    <div className="module-page-container">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Modules
        </button>
        <div className="module-title-section">
          <h1>Module 1: Walk-Around Check</h1>
          <h2>Visual Inspection</h2>
        </div>
      </header>

      <main className="module-content">
        <section className="syllabus-section">
          <h3>Syllabus Reference</h3>
          <div className="syllabus-info">
            <p><strong>Unit Code:</strong> CON833309 - Perform pre- and post-operation procedures for lifting equipment</p>
            <p><strong>Element:</strong> Element 1 - Perform visual check of equipment</p>
            <p><strong>Page References:</strong> pp. 38, 41–42</p>
          </div>
        </section>

        <section className="learning-objectives">
          <h3>Learning Objectives</h3>
          <p>Trainees must perform a comprehensive inspection split into two distinct virtual states:</p>
        </section>

        <section className="inspection-section">
          <div className="inspection-state engine-off">
            <h3>🔧 Engine-Off Controls</h3>
            <p className="reference">Page 41, Variable 4.1</p>
            
            <div className="inspection-area">
              <h4>Fluid Leaks</h4>
              <p>Inspect underneath and inside the engine bay for fluid leaks:</p>
              <ul>
                <li>Engine oil leaks</li>
                <li>Hydraulic oil leaks</li>
                <li>Battery electrolyte leaks</li>
                <li>Cooling system/coolant leaks</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>

            <div className="inspection-area">
              <h4>Worn-out/Damaged Components</h4>
              <p>Interactively inspect structural parts for visible damage:</p>
              <ul>
                <li>Structural cracks on mast assembly</li>
                <li>Extreme wear or inflation issues on tires</li>
                <li>Loose or missing structural bolts</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>
          </div>

          <div className="inspection-state engine-on">
            <h3>⚡ Engine-On Controls</h3>
            <p className="reference">Page 42, Variable 4.2</p>
            
            <div className="inspection-area">
              <h4>Instrument Panel Gauges</h4>
              <p>Check all functional gauges in the interactive cockpit viewpoint:</p>
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
              <p>Functional test of safety equipment:</p>
              <ul>
                <li>Horn operation</li>
                <li>Headlights functionality</li>
                <li>Turn signals operation</li>
                <li>Flashing warning beacon/strobe light</li>
                <li>Automatic backup alarm</li>
              </ul>
              <Model3DViewer height="280px" />
            </div>
          </div>
        </section>

        <section className="action-section">
          <button className="start-interactive-button">
            Start Interactive Inspection
          </button>
        </section>
      </main>
    </div>
  )
}

export default WalkAroundCheckPage
