import { useState } from 'react'
import PartDetailCard from './PartDetailCard'
import './ModuleSimulationShell.css'

function ModuleSimulationShell({
  module,
  steps,
  currentStepIndex,
  objectives = [],
  progress = 0,
  score,
  canProceed = true,
  requiredNote = "Complete this step's required items to continue.",
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
        </div>
        <div className="simulation-score-card">
          <span>Progress</span>
          <strong>{progress}%</strong>
          {typeof score === 'number' && <small>Score: {score}</small>}
        </div>
      </header>

      <div className="simulation-workspace">
        <div className="simulation-scene">
          {renderScene ? renderScene({ currentStep, currentStepIndex }) : (
            <div className="simulation-placeholder-scene">
              <strong>Interactive task area</strong>
              <p>3D viewer, diagram, or activity scene will appear here.</p>
            </div>
          )}
        </div>

        <aside className="simulation-overlay simulation-overlay-left">
          <section className="simulation-panel">
            <div className="simulation-panel-header">
              <p className="simulation-panel-label">Objectives</p>
              <button className="simulation-hint-button" onClick={() => setShowHint((value) => !value)}>
                {showHint ? 'Hide Hint' : 'Show Hint'}
              </button>
            </div>
            <ul className="simulation-objectives">
              {objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
            {showHint && <p className="simulation-hint-text">{currentStep?.hint || 'No hint is available for this step.'}</p>}
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
        </aside>

        <aside className="simulation-overlay simulation-overlay-right">
          <section className="simulation-panel current-task-panel">
            {selectedDetail ? (
              <>
                <div className="hotspot-detail-header">
                  <p className="simulation-panel-label">Part Details</p>
                </div>
                <PartDetailCard
                  title={selectedDetail.title}
                  subtitle={selectedDetail.subtitle}
                  image={selectedDetail.image}
                  description={selectedDetail.description}
                  status={selectedDetail.status}
                  statusType={selectedDetail.statusType}
                />
                <button type="button" className="hotspot-detail-back" onClick={onClearDetail}>
                    Back to Task
                </button>
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
        </aside>

      </div>

      <div className="simulation-control-bar">
        <div className="simulation-progress-bar" aria-label={`Simulation progress ${progress}%`}>
          <i style={{ width: `${progress}%` }} />
        </div>
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
          <p className="simulation-required-note">{requiredNote}</p>
        )}
      </div>
    </section>
  )
}

export default ModuleSimulationShell
