import './TrainingSelectionPage.css'

function TrainingSelectionPage({ moduleName, onSelectTraining, onBack }) {
  return (
    <div className="training-selection-container">
      <header className="training-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1>{moduleName} Training</h1>
      </header>

      <main className="training-options">
        <div className="option-card">
          <div className="option-icon">
            <span>Usage</span>
          </div>
          <h2>Equipment Usage</h2>
          <p>Learn safe forklift familiarization through walk-around checks, load handling, and post-operation steps.</p>
          <button className="option-button" onClick={() => onSelectTraining('equipment-usage')}>
            Start Equipment Training
          </button>
        </div>

        <div className="option-card">
          <div className="option-icon">
            <span>Parts</span>
          </div>
          <h2>Parts Identification</h2>
          <p>Identify the main forklift components, their functions, and their safety reminders.</p>
          <button className="option-button" onClick={() => onSelectTraining('parts-identification')}>
            Start Parts Training
          </button>
        </div>
      </main>
    </div>
  )
}

export default TrainingSelectionPage
