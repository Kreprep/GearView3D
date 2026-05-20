import './PostOperationPage.css'

function PostOperationPage({ moduleName, onBack }) {
  return (
    <div className="module-page-container">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Modules
        </button>
        <div className="module-title-section">
          <h1>Module 3: Post-Operation</h1>
          <h2>Secure Parking</h2>
        </div>
      </header>

      <main className="module-content">
        <section className="syllabus-section">
          <h3>Syllabus Reference</h3>
          <div className="syllabus-info">
            <p><strong>Unit Code:</strong> 505833315 - Perform productive operation for forklift</p>
            <p><strong>Element:</strong> Element 5 - Perform post-operation procedures</p>
            <p><strong>Also:</strong> CON833309, Element 3 - Perform post-operation procedures</p>
            <p><strong>Page References:</strong> pp. 38, 58</p>
          </div>
        </section>

        <section className="learning-objectives">
          <h3>Learning Objectives</h3>
          <p>Master the critical post-operation procedures that trainees frequently fail assessments on. Execute a complete step-by-step shutdown and parking protocol.</p>
        </section>

        <section className="post-operation-section">
          <div className="operation-step parking-sequence">
            <h3>🅿️ Safe Parking Sequence</h3>
            <p className="reference">Page 58, Critical Aspects 1.4</p>
            
            <div className="step-content">
              <h4>Parking Protocol Checklist</h4>
              <p>Trainees must visually verify each step of the parking sequence:</p>
              
              <div className="step-item">
                <div className="step-number">1</div>
                <div className="step-details">
                  <h5>Select Level Surface</h5>
                  <p>Park on an appropriate level surface free from slopes and obstructions</p>
                  <div className="placeholder">
                    <span>3D Interactive: Surface Level Assessment</span>
                  </div>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">2</div>
                <div className="step-details">
                  <h5>Tilt Mast Slightly Forward</h5>
                  <p>Adjust the mast tilt lever to position mast forward slightly for stability</p>
                  <div className="placeholder">
                    <span>3D Interactive: Mast Tilt Control</span>
                  </div>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">3</div>
                <div className="step-details">
                  <h5>Lower Forks Completely Flat</h5>
                  <p>Use lift lever to lower forks completely to ground level</p>
                  <div className="placeholder">
                    <span>3D Interactive: Fork Lowering Verification</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="operation-step shutdown-sequence">
            <h3>⛔ Engine Cooldown and Shut-Down</h3>
            <p className="reference">Page 58, Critical Aspects 1.5</p>
            
            <div className="step-content">
              <h4>Shutdown Protocol Checklist</h4>
              <p>Follow the complete shutdown procedure to cool the engine and secure the equipment:</p>
              
              <div className="step-item">
                <div className="step-number">1</div>
                <div className="step-details">
                  <h5>Put Directional Controls in Neutral</h5>
                  <p>Ensure all control levers are in neutral position to prevent unintended movement</p>
                  <div className="placeholder">
                    <span>3D Interactive: Control Lever Positioning</span>
                  </div>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">2</div>
                <div className="step-details">
                  <h5>Engage Parking Brake</h5>
                  <p>Activate the parking brake to secure the forklift in place</p>
                  <div className="placeholder">
                    <span>3D Interactive: Parking Brake Engagement</span>
                  </div>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">3</div>
                <div className="step-details">
                  <h5>Allow Engine to Idle</h5>
                  <p>Let the engine run at idle speed briefly for structural and thermal stabilization (cooling)</p>
                  <div className="placeholder">
                    <span>3D Interactive: Idle Monitoring & Cooldown</span>
                  </div>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">4</div>
                <div className="step-details">
                  <h5>Turn Off Ignition Switch</h5>
                  <p>Shut off the engine using the ignition switch to complete the shutdown procedure</p>
                  <div className="placeholder">
                    <span>3D Interactive: Ignition Switch Operation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="critical-reminder">
          <h3>⚡ Critical Reminder</h3>
          <p>This module emphasizes procedures that trainees frequently neglect during assessments. Proper post-operation procedures ensure equipment longevity, workplace safety, and operator competence. Master these steps completely.</p>
        </section>

        <section className="action-section">
          <button className="start-interactive-button">
            Start Post-Operation Simulation
          </button>
        </section>
      </main>
    </div>
  )
}

export default PostOperationPage
