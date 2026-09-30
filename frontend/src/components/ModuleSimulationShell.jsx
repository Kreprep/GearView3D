import { useEffect, useRef, useState } from 'react'
import PartDetailCard from './PartDetailCard'
import { ModuleSkills } from './ModuleSkills'
import { useT } from '../i18n'
import { ProgressBar } from './ui/progress'
import './ModuleSimulationShell.css'

function ModuleSimulationShell({
  module,
  steps,
  currentStepIndex,
  objectives = [],
  moduleSkills,
  progress = 0,
  score,
  canProceed = true,
  requiredNote = "Complete this step's required items to continue.",
  maxSelectableStepIndex = Infinity,
  onSelectStep,
  onBackStep,
  onNextStep,
  onComplete,
  renderScene,
  renderTask,
  completionSummary,
  selectedDetail,
  onClearDetail,
  onNextDetail,
}) {
  const t = useT()
  const [showHint, setShowHint] = useState(false)
  const currentTaskRef = useRef(null)
  const currentStep = steps[currentStepIndex] || steps[0]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1

  // Opening or closing a part's detail card swaps the whole panel's content;
  // without this, whatever scroll position the previous content left behind
  // carries over, which can strand the panel showing blank space until the
  // learner scrolls to find the next inspection card.
  useEffect(() => {
    currentTaskRef.current?.scrollTo({ top: 0 })
  }, [selectedDetail])

  return (
    <section className="simulation-shell">
      <header className="simulation-briefing">
        <div>
          <p className="simulation-kicker">{t('module.kicker')}</p>
          {/* The page heading: SimulationPageLayout runs in compact mode on
              every page that renders this shell, so it prints no <h1> of its own. */}
          <h1>{module.fullTitle || module.title}</h1>
        </div>
        <div className="simulation-score-card">
          <span>{t('module.progress')}</span>
          <strong>{progress}%</strong>
          {typeof score === 'number' && <small>{t('module.score', { score })}</small>}
        </div>
      </header>

      <div className="simulation-workspace">
        <div className="simulation-scene">
          {renderScene ? renderScene({ currentStep, currentStepIndex }) : (
            <div className="simulation-placeholder-scene">
              <strong>{t('module.scene.placeholderTitle')}</strong>
              <p>{t('module.scene.placeholderBody')}</p>
            </div>
          )}
        </div>

        <aside className="simulation-overlay simulation-overlay-left">
          <section className="simulation-panel">
            <div className="simulation-panel-header">
              <p className="simulation-panel-label">{t('module.panel.objectives')}</p>
              <button className="simulation-hint-button" onClick={() => setShowHint((value) => !value)}>
                {t(showHint ? 'module.hint.hide' : 'module.hint.show')}
              </button>
            </div>
            <ul className="simulation-objectives">
              {objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
            {showHint && <p className="simulation-hint-text">{currentStep?.hint || t('module.hint.none')}</p>}
          </section>

          {(moduleSkills?.practise.length > 0 || moduleSkills?.need.length > 0) && (
            <section className="simulation-panel">
              <ModuleSkills practise={moduleSkills.practise} need={moduleSkills.need} compact />
            </section>
          )}

          <section className="simulation-panel">
            <p className="simulation-panel-label">{t('module.panel.steps')}</p>
            <ol className="simulation-step-list">
              {steps.map((step, index) => {
                const locked = index > maxSelectableStepIndex
                return (
                  <li
                    key={step.id}
                    className={[
                      index === currentStepIndex ? 'active' : '',
                      index < currentStepIndex ? 'done' : '',
                      locked ? 'locked' : '',
                    ].join(' ')}
                    role="button"
                    tabIndex={locked ? -1 : 0}
                    aria-disabled={locked}
                    aria-current={index === currentStepIndex ? 'step' : undefined}
                    onClick={() => !locked && onSelectStep?.(index)}
                    onKeyDown={(event) => {
                      if (locked || (event.key !== 'Enter' && event.key !== ' ')) return
                      event.preventDefault()
                      onSelectStep?.(index)
                    }}
                  >
                    <span>{index + 1}</span>
                    <p>{step.title}</p>
                  </li>
                )
              })}
            </ol>
          </section>
        </aside>

        <aside className="simulation-overlay simulation-overlay-right" ref={currentTaskRef}>
          <section className="simulation-panel current-task-panel">
            {selectedDetail ? (
              <>
                <div className="hotspot-detail-header">
                  <p className="simulation-panel-label">{t('module.panel.partDetails')}</p>
                </div>
                <PartDetailCard
                  title={selectedDetail.title}
                  subtitle={selectedDetail.subtitle}
                  image={selectedDetail.image}
                  description={selectedDetail.description}
                  status={selectedDetail.status}
                  statusType={selectedDetail.statusType}
                />
                <div className="hotspot-detail-actions">
                  {onNextDetail && (
                    <button type="button" className="hotspot-detail-next" onClick={onNextDetail}>
                      Next Part
                    </button>
                  )}
                  <button type="button" className="hotspot-detail-back" onClick={onClearDetail}>
                    Back to Task
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="simulation-panel-label">{t('module.panel.currentTask')}</p>
                <h3>{currentStep?.title}</h3>
                <p>{currentStep?.instructions}</p>
                {renderTask?.({ currentStep, currentStepIndex })}
              </>
            )}
          </section>

          {isLastStep && completionSummary && (
            <section className="simulation-panel completion-panel">
              <p className="simulation-panel-label">{t('module.panel.summary')}</p>
              {completionSummary}
            </section>
          )}
        </aside>

      </div>

      <div className="simulation-control-bar">
        <ProgressBar
          value={progress}
          label={t('module.progressLabel', { percent: progress })}
          size="h-[clamp(6px,0.5vw,9px)]"
        />
        <div className="simulation-navigation">
          {!isLastStep && !canProceed && (
            <p className="simulation-required-note">{requiredNote}</p>
          )}
          <div className="simulation-navigation-buttons">
            <button type="button" onClick={onBackStep} disabled={isFirstStep}>
              {t('module.nav.back')}
            </button>
            {isLastStep ? (
              <button type="button" className="primary" onClick={onComplete}>
                {t('module.nav.complete')}
              </button>
            ) : (
              <button type="button" className="primary" onClick={onNextStep} disabled={!canProceed}>
                {t('module.nav.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ModuleSimulationShell
