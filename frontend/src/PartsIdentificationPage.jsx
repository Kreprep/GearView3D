import './PartsIdentificationPage.css'

function PartsIdentificationPage({ moduleName, onBack }) {
  return (
    <div className="training-page-container">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>{moduleName} - Parts Identification</h1>
      </header>

      <main className="training-content">
        <div className="content-section">
          <h2>Parts Identification Module</h2>
          <p>This is a placeholder for the {moduleName} parts identification training module.</p>
          
          <div className="lesson-card">
            <h3>Part 1: Main Components</h3>
            <p>Identify the major components of the equipment.</p>
          </div>

          <div className="lesson-card">
            <h3>Part 2: Secondary Components</h3>
            <p>Learn about supporting components and their locations.</p>
          </div>

          <div className="lesson-card">
            <h3>Part 3: Wear Items & Maintenance</h3>
            <p>Understand which parts require regular maintenance and replacement.</p>
          </div>

          <button className="start-lesson-button">Start Part 1</button>
        </div>
      </main>
    </div>
  )
}

export default PartsIdentificationPage
