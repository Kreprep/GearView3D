import { Check } from 'lucide-react'
import { useT } from '../i18n'
import { ProgressBar } from './ui/progress'
import './ModuleStepper.css'

// A module's steps as a stepper in the page's top bar (SimulationPageLayout's
// `headerContent`). Real buttons, one per step: done steps show a tick, steps
// past `maxSelectableStepIndex` are disabled, and only the current step shows
// its title. The others show their number, with the title as the accessible
// name and the tooltip, which is what lets ten steps sit beside a long module
// title at 1920 px.
//
// `isStepDone(index)` is the page's: it knows which steps are graded and
// finished. Without it a step counts as done once the learner is past it.
export function ModuleStepper({ steps, currentStepIndex, maxSelectableStepIndex = Infinity, isStepDone, onSelectStep }) {
  const t = useT()
  const done = isStepDone || ((index) => index < currentStepIndex)

  return (
    <nav className="module-stepper" aria-label={t('module.stepper.label')}>
      <ol>
        {steps.map((step, index) => {
          const current = index === currentStepIndex
          const locked = index > maxSelectableStepIndex
          const complete = !current && done(index)
          const number = index + 1
          const name = t(
            locked ? 'module.stepper.locked' : complete ? 'module.stepper.done' : 'module.stepper.step',
            { number, title: step.title },
          )
          return (
            <li key={step.id}>
              <button
                type="button"
                className={['module-stepper-step', current && 'is-current', complete && 'is-done'].filter(Boolean).join(' ')}
                aria-current={current ? 'step' : undefined}
                aria-label={current ? undefined : name}
                title={name}
                disabled={locked}
                onClick={() => onSelectStep?.(index)}
              >
                <span className="module-stepper-mark" aria-hidden={current ? undefined : 'true'}>
                  {complete ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : number}
                </span>
                {current && <span className="module-stepper-title">{step.title}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// What a module page puts in the top bar: the stepper and a compact progress
// meter. One composition, so the module page and Parts Identification match.
export function ModuleHeaderContent({ progress = 0, ...stepper }) {
  const t = useT()
  const percent = Math.round(Number.isFinite(Number(progress)) ? Math.min(100, Math.max(0, progress)) : 0)

  return (
    <>
      <ModuleStepper {...stepper} />
      <div className="module-header-progress">
        <ProgressBar value={percent} label={t('module.progressLabel', { percent })} size="sm" className="module-header-progress-bar" />
        <span aria-hidden="true">{percent}%</span>
      </div>
    </>
  )
}
