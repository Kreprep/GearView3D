import './ModuleActivities.css'

// The two built-in `activity` step screens, extracted from the old
// PostOperationPage so any module page can render them. An `activity` row is
// data like any other step - admins reorder/remove/reword it - but its UI is
// React keyed by `content.activityId`, so lib/activitySteps.js's ACTIVITY_IDS
// are the only ids that render anything (the admin create endpoint refuses
// the kind for the same reason). The cards, answers and feedback all come
// from the row's content.

// The shutdown cards are shown in `displayOrder` - a fixed scramble, not a
// runtime shuffle, so a retry always looks the same. Anything the admin left
// out of that list is appended rather than hidden.
function orderedShutdownActions(actions, displayOrder = []) {
  const listed = displayOrder.map((id) => actions.find((action) => action.id === id)).filter(Boolean)
  const missing = actions.filter((action) => !displayOrder.includes(action.id))
  return [...listed, ...missing]
}

export function ShutdownSequenceActivity({ actions, displayOrder, pickedIds, completed, wrongPickId, onPick }) {
  const cards = completed
    ? [...actions].sort((a, b) => a.order - b.order)
    : orderedShutdownActions(actions, displayOrder)

  return (
    <div className="shutdown-activity">
      <div className="shutdown-grid">
        {cards.map((action) => {
          const pickedIndex = pickedIds.indexOf(action.id)
          const isPicked = completed || pickedIndex >= 0
          return (
            <button
              key={action.id}
              type="button"
              className={`shutdown-card ${isPicked ? 'picked' : ''} ${wrongPickId === action.id ? 'wrong' : ''}`}
              disabled={isPicked}
              onClick={() => onPick(action)}
            >
              <span className="shutdown-order-chip">
                {completed ? action.order : pickedIndex >= 0 ? pickedIndex + 1 : '?'}
              </span>
              <span className="shutdown-card-text">
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ReportingActivity({ prompts, answers, completed, onAnswer }) {
  return (
    <div className="reporting-activity">
      {prompts.map((prompt) => {
        const answer = answers[prompt.id]
        const resolved = completed || (answer && answer.correct)
        return (
          <div key={prompt.id} className={`reporting-card ${resolved ? 'correct' : answer ? 'wrong' : ''}`}>
            <p className="reporting-text">{prompt.text}</p>
            <div className="reporting-actions">
              <button
                type="button"
                className={`reporting-button report ${(resolved && prompt.shouldReport) || answer?.choice === true ? 'chosen' : ''}`}
                disabled={resolved}
                onClick={() => onAnswer(prompt, true)}
              >
                Report
              </button>
              <button
                type="button"
                className={`reporting-button ok ${(resolved && !prompt.shouldReport) || answer?.choice === false ? 'chosen' : ''}`}
                disabled={resolved}
                onClick={() => onAnswer(prompt, false)}
              >
                No Action
              </button>
            </div>
            {resolved && <p className="reporting-feedback correct">{prompt.feedback}</p>}
            {!resolved && answer && !answer.correct && (
              <p className="reporting-feedback wrong">{prompt.wrongFeedback} Try again.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
