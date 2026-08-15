import MarkdownContent from './MarkdownContent'
import { SUMMARY_COUNTER_LABELS } from '../data/courseDefaults'
import { isStepComplete } from '../lib/simulationProgress'

// A summary step is data, not code. The per-step grid is built from the
// module's current graded steps, so a step an admin adds shows up here without
// a code change; `content` supplies the editable copy
// ({ body, completeMessage, incompleteMessage, counters }).

function ModuleSummary({ content, steps, gradedStepIds, simulation }) {
  const counters = (content?.counters || []).filter((key) => SUMMARY_COUNTER_LABELS[key])

  return (
    <div className="load-task-stack">
      <MarkdownContent>{content?.body}</MarkdownContent>

      <div className="summary-grid">
        {gradedStepIds.map((stepId) => {
          const done = isStepComplete(simulation, stepId)
          return (
            <div key={stepId} className={done ? 'done' : ''}>
              <span>{steps.find((step) => step.id === stepId)?.title || stepId}</span>
              <strong>{done ? 'Complete' : 'Open'}</strong>
            </div>
          )
        })}
        {counters.map((key) => (
          <div key={key}>
            <span>{SUMMARY_COUNTER_LABELS[key]}</span>
            <strong>{simulation[key] ?? 0}</strong>
          </div>
        ))}
      </div>

      <p className={simulation.complete ? 'completion-ready' : 'completion-warning'}>
        {simulation.complete
          ? content?.completeMessage || 'All requirements are complete.'
          : content?.incompleteMessage || 'Complete every graded step to finish this module.'}
      </p>
    </div>
  )
}

export default ModuleSummary
