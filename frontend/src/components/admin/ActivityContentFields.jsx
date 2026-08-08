// Editors for the two built-in activity screens of Module 3. The screens are
// code keyed by `content.activityId`, but everything they display - the cards,
// the correct order, the prompts and both feedback lines - is row content, so
// these panels are what make them editable.
//
// Both write through CourseEditor's `setContent`, so the edits land in the
// step's draft and reach learners only on Publish.

function moveInList(list, index, delta) {
  const target = index + delta
  if (target < 0 || target >= list.length) return list

  const next = [...list]
  const [entry] = next.splice(index, 1)
  next.splice(target, 0, entry)
  return next
}

function slugId(prefix, label, taken) {
  const base = `${label || prefix}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || prefix
  let id = base
  let suffix = 2
  while (taken.includes(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  return id
}

export function ShutdownActivityFields({ content, onChange }) {
  const actions = content.actions || []
  const displayOrder = content.displayOrder || []

  // `order` is the sequence the learner must click, so it is always renumbered
  // from the list position rather than edited as a free number - two cards
  // sharing an order would make the step impossible to finish.
  const writeActions = (nextActions, nextDisplayOrder = displayOrder) => {
    const renumbered = nextActions.map((action, index) => ({ ...action, order: index + 1 }))
    const ids = renumbered.map((action) => action.id)
    onChange({
      actions: renumbered,
      displayOrder: [
        ...nextDisplayOrder.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !nextDisplayOrder.includes(id)),
      ],
    })
  }

  const updateAction = (index, patch) =>
    writeActions(actions.map((action, entry) => (entry === index ? { ...action, ...patch } : action)))

  return (
    <>
      <p className="admin-panel-note">
        Cards are listed in the order the learner must select them. Position 1 is picked first.
      </p>

      {actions.map((action, index) => (
        <div key={action.id} className="activity-item">
          <div className="activity-item-bar">
            <strong>{index + 1}.</strong>
            <span className="course-toolbar-spacer" />
            <button type="button" onClick={() => writeActions(moveInList(actions, index, -1))} disabled={index === 0}>Up</button>
            <button type="button" onClick={() => writeActions(moveInList(actions, index, 1))} disabled={index === actions.length - 1}>Down</button>
            <button
              type="button"
              className="course-danger"
              onClick={() => writeActions(actions.filter((entry, position) => position !== index))}
            >
              Remove
            </button>
          </div>
          <label>
            Label
            <input value={action.label || ''} onChange={(event) => updateAction(index, { label: event.target.value })} />
          </label>
          <label>
            Detail
            <input value={action.detail || ''} onChange={(event) => updateAction(index, { detail: event.target.value })} />
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          writeActions([
            ...actions,
            { id: slugId('action', 'New action', actions.map((action) => action.id)), label: 'New action', detail: '' },
          ])
        }
      >
        Add action
      </button>

      <h4>Card display order</h4>
      <p className="admin-panel-note">
        The scrambled order the cards are shown in before the learner sorts them. It is a fixed scramble, not a
        shuffle, so every retry looks the same.
      </p>
      <ol className="course-checkpoint-list">
        {displayOrder.map((id, index) => (
          <li key={id}>
            <span>{actions.find((action) => action.id === id)?.label || id}</span>
            <span>
              <button
                type="button"
                onClick={() => onChange({ displayOrder: moveInList(displayOrder, index, -1) })}
                disabled={index === 0}
              >
                Up
              </button>
              <button
                type="button"
                onClick={() => onChange({ displayOrder: moveInList(displayOrder, index, 1) })}
                disabled={index === displayOrder.length - 1}
              >
                Down
              </button>
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

export function ReportingActivityFields({ content, onChange }) {
  const prompts = content.prompts || []

  const updatePrompt = (index, patch) =>
    onChange({ prompts: prompts.map((prompt, entry) => (entry === index ? { ...prompt, ...patch } : prompt)) })

  return (
    <>
      <p className="admin-panel-note">
        Each condition is answered Report or No Action. The learner must get every one right to finish the step.
      </p>

      {prompts.map((prompt, index) => (
        <div key={prompt.id} className="activity-item">
          <div className="activity-item-bar">
            <strong>{index + 1}.</strong>
            <span className="course-toolbar-spacer" />
            <button type="button" onClick={() => onChange({ prompts: moveInList(prompts, index, -1) })} disabled={index === 0}>Up</button>
            <button type="button" onClick={() => onChange({ prompts: moveInList(prompts, index, 1) })} disabled={index === prompts.length - 1}>Down</button>
            <button
              type="button"
              className="course-danger"
              onClick={() => onChange({ prompts: prompts.filter((entry, position) => position !== index) })}
            >
              Remove
            </button>
          </div>

          <label>
            Condition shown to the learner
            <textarea rows={2} value={prompt.text || ''} onChange={(event) => updatePrompt(index, { text: event.target.value })} />
          </label>
          <label>
            Correct answer
            <select
              value={prompt.shouldReport ? 'report' : 'no-action'}
              onChange={(event) => updatePrompt(index, { shouldReport: event.target.value === 'report' })}
            >
              <option value="report">Report</option>
              <option value="no-action">No Action</option>
            </select>
          </label>
          <label>
            Feedback when correct
            <textarea rows={2} value={prompt.feedback || ''} onChange={(event) => updatePrompt(index, { feedback: event.target.value })} />
          </label>
          <label>
            Feedback when wrong
            <textarea rows={2} value={prompt.wrongFeedback || ''} onChange={(event) => updatePrompt(index, { wrongFeedback: event.target.value })} />
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange({
            prompts: [
              ...prompts,
              {
                id: slugId('prompt', 'New condition', prompts.map((prompt) => prompt.id)),
                text: '',
                shouldReport: true,
                feedback: '',
                wrongFeedback: '',
              },
            ],
          })
        }
      >
        Add condition
      </button>
    </>
  )
}
