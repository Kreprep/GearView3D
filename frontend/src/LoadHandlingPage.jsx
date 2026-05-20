import './LoadHandlingPage.css'

function LoadHandlingPage({ moduleName, onBack }) {
  return (
    <div className="module-page-container">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Modules
        </button>
        <div className="module-title-section">
          <h1>Module 2: Load Handling</h1>
          <h2>Operational Controls</h2>
        </div>
      </header>

      <main className="module-content">
        <section className="syllabus-section">
          <h3>Syllabus Reference</h3>
          <div className="syllabus-info">
            <p><strong>Unit Code:</strong> 505833315 - Perform productive operation for forklift</p>
            <p><strong>Element:</strong> Element 4 - Perform load handling operation</p>
            <p><strong>Page References:</strong> pp. 55, 57–58</p>
          </div>
        </section>

        <section className="learning-objectives">
          <h3>Learning Objectives</h3>
          <p>Master the primary visual interactive bridge for spatial maneuvering and safety protocols in load handling operations.</p>
        </section>

        <section className="operation-section">
          <div className="operation-module maneuvering">
            <h3>🎯 Maneuvering and Positioning</h3>
            <p className="reference">Page 55, Element 4.1</p>
            
            <div className="operation-area">
              <h4>Positioning the Forklift</h4>
              <p>Practice positioning the forklift squarely and correctly toward a load based on proximity guidelines:</p>
              <ul>
                <li>Align forklift perpendicular to load</li>
                <li>Maintain proper distance based on load size</li>
                <li>Ensure stable approach angle</li>
                <li>Position forks at correct height before engagement</li>
              </ul>
              <div className="placeholder">
                <span>3D Interactive: Forklift Positioning Simulator</span>
              </div>
            </div>
          </div>

          <div className="operation-module stability">
            <h3>⚖️ Load Center of Gravity</h3>
            <p className="reference">Page 55, Element 4.2</p>
            
            <div className="operation-area">
              <h4>Stability Triangle Concept</h4>
              <p>Visually demonstrate and understand the forklift's Stability Triangle:</p>
              <ul>
                <li>Stability Triangle defined by contact points and load center</li>
                <li>Center of gravity shifts with load position</li>
                <li>Impact on maximum rated lifting capacity</li>
                <li>How palletized cargo affects balance</li>
                <li>How containerized cargo affects balance</li>
              </ul>
              <div className="placeholder">
                <span>3D Interactive: Stability Triangle Visualization</span>
              </div>
            </div>
          </div>

          <div className="operation-module controls">
            <h3>🎮 Lever and Control Mastery</h3>
            <p className="reference">Page 58, Critical Aspects 1.2</p>
            
            <div className="operation-area">
              <h4>Hydraulic Lever Operations</h4>
              <p>Virtual dashboard with interactive lever controls:</p>
              <ul>
                <li><strong>Lift Lever:</strong> Practice smooth vertical lifting movements</li>
                <li><strong>Tilt Lever:</strong> Control mast tilt angle with precision</li>
                <li><strong>Side-Shift Controls:</strong> Fine-tune lateral positioning</li>
              </ul>
              <div className="placeholder">
                <span>3D Interactive: Virtual Dashboard & Lever Controls</span>
              </div>
            </div>
          </div>

          <div className="operation-module safety">
            <h3>⚠️ Operational Area Safety</h3>
            <p className="reference">Page 55, Element 3</p>
            
            <div className="operation-area">
              <h4>Worksite Hazard Assessment</h4>
              <p>Survey the virtual worksite and identify safety considerations:</p>
              <ul>
                <li>Spot unsafe ground conditions</li>
                <li>Check overhead clearances</li>
                <li>Verify proximity clearances with other equipment</li>
                <li>Identify floor obstructions and hazards</li>
                <li>Verify proper safety barriers deployment</li>
                <li>Confirm hazard signage placement</li>
              </ul>
              <div className="placeholder">
                <span>3D Interactive: Worksite Safety Assessment</span>
              </div>
            </div>
          </div>
        </section>

        <section className="action-section">
          <button className="start-interactive-button">
            Start Load Handling Simulation
          </button>
        </section>
      </main>
    </div>
  )
}

export default LoadHandlingPage
