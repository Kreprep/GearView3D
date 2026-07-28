import { useState } from 'react'
import './ModuleSimulationShell.css'

function ModuleSimulationShell({
  module,
  steps,
  currentStepIndex,
  objectives = [],
  progress = 0,
  score,
  canProceed = true,
  onBackStep,
  onNextStep,
  onComplete,
  renderScene,
  renderTask,
  completionSummary,
  selectedDetail,
  onClearDetail,
}) {
  const [showHint, setShowHint] = useState(false)
  const currentStep = steps[currentStepIndex] || steps[0]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1

  return (
    <section className="simulation-shell">
      <header className="simulation-briefing">
        <div>
          <p className="simulation-kicker">Guided Simulation</p>
          <h2>{module.fullTitle || module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="simulation-score-card">
          <span>Progress</span>
          <strong>{progress}%</strong>
          {typeof score === 'number' && <small>Score: {score}</small>}
        </div>
      </header>

      <div className="simulation-workspace">
        <aside className="simulation-left-panel">
          <section className="simulation-panel">
            <p className="simulation-panel-label">Objectives</p>
            <ul className="simulation-objectives">
              {objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </section>

          <section className="simulation-panel">
            <p className="simulation-panel-label">Steps</p>
            <ol className="simulation-step-list">
              {steps.map((step, index) => (
                <li
                  key={step.id}
                  className={[
                    index === currentStepIndex ? 'active' : '',
                    index < currentStepIndex ? 'done' : '',
                  ].join(' ')}
                >
                  <span>{index + 1}</span>
                  <p>{step.title}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="simulation-panel">
            <p className="simulation-panel-label">Hint</p>
            <button className="simulation-hint-button" onClick={() => setShowHint((value) => !value)}>
              {showHint ? 'Hide Hint' : 'Show Hint'}
            </button>
            {showHint && <p className="simulation-hint-text">{currentStep?.hint || 'No hint is available for this step.'}</p>}
          </section>
        </aside>

        <main className="simulation-center-panel">
          <div className="simulation-progress-bar" aria-label={`Simulation progress ${progress}%`}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="simulation-scene">
            {renderScene ? renderScene({ currentStep, currentStepIndex }) : (
              <div className="simulation-placeholder-scene">
                <strong>Interactive task area</strong>
                <p>3D viewer, diagram, or activity scene will appear here.</p>
              </div>
            )}
          </div>
        </main>

        <aside className="simulation-right-panel">
          <section className="simulation-panel current-task-panel">
            {selectedDetail ? (
              <>
                <div className="hotspot-detail-header">
                  <p className="simulation-panel-label">Part Details</p>
                  <button type="button" className="hotspot-detail-back" onClick={onClearDetail}>
                    Back to Task
                  </button>
                </div>
                <div className="hotspot-detail">
                  {selectedDetail.image ? (
                    <img className="hotspot-detail-image" src={selectedDetail.image} alt={selectedDetail.title} />
                  ) : (
                    <div className="hotspot-detail-image hotspot-detail-image-placeholder">No reference image yet</div>
                  )}
                  <h3>{selectedDetail.title}</h3>
                  {selectedDetail.subtitle && <p className="hotspot-detail-subtitle">{selectedDetail.subtitle}</p>}
                  {selectedDetail.description && <p>{selectedDetail.description}</p>}
                  {selectedDetail.status && (
                    <p className={`hotspot-detail-status ${selectedDetail.statusType || 'neutral'}`}>{selectedDetail.status}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="simulation-panel-label">Current Task</p>
                <h3>{currentStep?.title}</h3>
                <p>{currentStep?.instructions}</p>
                {renderTask?.({ currentStep, currentStepIndex })}
              </>
            )}
          </section>

          {isLastStep && completionSummary && (
            <section className="simulation-panel completion-panel">
              <p className="simulation-panel-label">Completion Summary</p>
              {completionSummary}
            </section>
          )}

          <div className="simulation-navigation">
            <button type="button" onClick={onBackStep} disabled={isFirstStep}>
              Back
            </button>
            {isLastStep ? (
              <button type="button" className="primary" onClick={onComplete}>
                Complete Module
              </button>
            ) : (
              <button type="button" className="primary" onClick={onNextStep} disabled={!canProceed}>
                Next
              </button>
            )}
          </div>
          {!isLastStep && !canProceed && (
            <p className="simulation-required-note">Complete this step's required items to continue.</p>
          )}
        </aside>
      </div>
    </section>
  )
}

export default ModuleSimulationShell
