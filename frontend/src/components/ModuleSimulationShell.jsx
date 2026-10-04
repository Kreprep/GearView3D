import { useEffect, useRef, useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import PartDetailCard from './PartDetailCard'
import { useT } from '../i18n'
import './ModuleSimulationShell.css'

// Whether the task column is folded to its tab: a per-viewer convenience,
// so it may be missing or unwritable (private window, blocked storage).
const COLLAPSED_KEY = 'gearview_task_panel_collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // Not remembered; the column still folds for this visit.
  }
}

// The scene and the task column of a module page. The page's top bar (the
// stepper and progress, SimulationPageLayout + ModuleHeaderContent) is the
// page's own; this is everything under it.
//
// The task column is a grid column, not an overlay, so the canvas never sits
// under it and the scene's HUD centres on the scene. It holds the step title,
// the instructions once, the task body (the only part that scrolls), the hint
// as a disclosure, and Back / Next / Complete in its footer. It folds to a
// narrow tab showing the step number, so a driver can have the whole width.
function ModuleSimulationShell({
  steps,
  currentStepIndex,
  canProceed = true,
  requiredNote,
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
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const bodyRef = useRef(null)
  const currentStep = steps[currentStepIndex] || steps[0]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1

  // Opening or closing a part's detail card, or moving to another step, swaps
  // the body's content; without this, whatever scroll position the previous
  // content left behind carries over, which can strand the panel showing blank
  // space until the learner scrolls to find the next inspection card.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [selectedDetail, currentStepIndex])

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      writeCollapsed(!value)
      return !value
    })
  }

  return (
    <section className={`simulation-shell ${collapsed ? 'is-collapsed' : ''}`.trim()}>
      <div className="simulation-scene">
        {renderScene ? renderScene({ currentStep, currentStepIndex }) : (
          <div className="simulation-placeholder-scene">
            <strong>{t('module.scene.placeholderTitle')}</strong>
            <p>{t('module.scene.placeholderBody')}</p>
          </div>
        )}
      </div>

      <aside className="simulation-task" aria-label={t('module.task.label')}>
        {collapsed ? (
          <button
            type="button"
            className="simulation-task-tab"
            aria-expanded="false"
            aria-label={t('module.task.expand', { number: currentStepIndex + 1, title: currentStep?.title })}
            title={t('module.task.expand', { number: currentStepIndex + 1, title: currentStep?.title })}
            onClick={toggleCollapsed}
          >
            <PanelRightOpen size={18} aria-hidden="true" />
            <span>{currentStepIndex + 1}</span>
          </button>
        ) : (
          <>
            <header className="simulation-task-header">
              <h2>{selectedDetail ? t('module.panel.partDetails') : currentStep?.title}</h2>
              <button
                type="button"
                className="simulation-task-collapse"
                aria-expanded="true"
                aria-label={t('module.task.collapse')}
                title={t('module.task.collapse')}
                onClick={toggleCollapsed}
              >
                <PanelRightClose size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="simulation-task-body" ref={bodyRef}>
              {selectedDetail ? (
                <>
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
                        {t('module.detail.nextPart')}
                      </button>
                    )}
                    <button type="button" className="hotspot-detail-back" onClick={onClearDetail}>
                      {t('module.detail.backToTask')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {currentStep?.instructions && <p className="simulation-task-instructions">{currentStep.instructions}</p>}
                  {renderTask?.({ currentStep, currentStepIndex })}
                  {isLastStep && completionSummary && (
                    <section className="simulation-task-summary">
                      <h3>{t('module.panel.summary')}</h3>
                      {completionSummary}
                    </section>
                  )}
                </>
              )}
            </div>

            {!selectedDetail && currentStep?.hint && (
              // Keyed on the step, so a hint opened on one step is closed on the next.
              <details key={currentStep.id} className="simulation-hint">
                <summary>{t('module.hint.label')}</summary>
                <p>{currentStep.hint}</p>
              </details>
            )}

            <footer className="simulation-task-footer">
              {!isLastStep && !canProceed && (
                <p className="simulation-required-note">{requiredNote || t('module.task.required')}</p>
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
            </footer>
          </>
        )}
      </aside>
    </section>
  )
}

export default ModuleSimulationShell
