import './EquipmentUsagePage.css'

function EquipmentUsagePage({ moduleName, onBack }) {
  return (
    <div className="training-page-container">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>{moduleName} - Equipment Usage</h1>
      </header>

      <main className="training-content">
        <div className="content-section">
          <h2>Equipment Operation Module</h2>
          <p>This is a placeholder for the {moduleName} equipment usage training module.</p>
          
          <div className="lesson-card">
            <h3>Lesson 1: Safety Basics</h3>
            <p>Learn essential safety procedures before operating the equipment.</p>
          </div>

          <div className="lesson-card">
            <h3>Lesson 2: Basic Controls</h3>
            <p>Understand the primary controls and how to operate them.</p>
          </div>

          <div className="lesson-card">
            <h3>Lesson 3: Advanced Techniques</h3>
            <p>Master advanced operation techniques for optimal performance.</p>
          </div>

          <button className="start-lesson-button">Start Lesson 1</button>
        </div>
      </main>
    </div>
  )
}

export default EquipmentUsagePage
