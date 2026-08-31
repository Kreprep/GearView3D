// Editors for the two built-in activity screens of Module 3. The screens are
// code keyed by `content.activityId`, but everything they display - the cards,
// the correct order, the prompts and both feedback lines - is row content, so
// these panels are what make them editable.
//
// Both write through CourseEditor's `setContent`, so the edits land in the
// step's draft and reach learners only on Publish.
import { slugify } from '../../lib/slug'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea, Select } from '../ui/input'

const ITEM_CLASSES = 'grid gap-2.5 rounded-xl border border-border bg-slate-50 p-3.5'

function moveInList(list, index, delta) {
  const target = index + delta
  if (target < 0 || target >= list.length) return list

  const next = [...list]
  const [entry] = next.splice(index, 1)
  next.splice(target, 0, entry)
  return next
}

function slugId(prefix, label, taken) {
  const base = slugify(label || prefix) || prefix
  let id = base
  let suffix = 2
  while (taken.includes(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  return id
}

function ItemToolbar({ index, count, onMoveUp, onMoveDown, onRemove }) {
  return (
    <div className="flex items-center gap-1.5">
      <strong className="text-sm text-ink">{index + 1}.</strong>
      <span className="ml-auto flex gap-1.5">
        <Button type="button" size="sm" variant="secondary" onClick={onMoveUp} disabled={index === 0}>Up</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onMoveDown} disabled={index === count - 1}>Down</Button>
        <Button type="button" size="sm" variant="danger" onClick={onRemove}>Remove</Button>
      </span>
    </div>
  )
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
      <PanelNote>Cards are listed in the order the learner must select them. Position 1 is picked first.</PanelNote>

      <div className="mt-3 grid gap-2.5">
        {actions.map((action, index) => (
          <div key={action.id} className={ITEM_CLASSES}>
            <ItemToolbar
              index={index}
              count={actions.length}
              onMoveUp={() => writeActions(moveInList(actions, index, -1))}
              onMoveDown={() => writeActions(moveInList(actions, index, 1))}
              onRemove={() => writeActions(actions.filter((entry, position) => position !== index))}
            />
            <Field label="Label">
              <Input value={action.label || ''} onChange={(event) => updateAction(index, { label: event.target.value })} />
            </Field>
            <Field label="Detail">
              <Input value={action.detail || ''} onChange={(event) => updateAction(index, { detail: event.target.value })} />
            </Field>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mt-2.5"
        onClick={() =>
          writeActions([
            ...actions,
            { id: slugId('action', 'New action', actions.map((action) => action.id)), label: 'New action', detail: '' },
          ])
        }
      >
        Add action
      </Button>

      <h4 className="mb-1 mt-4 text-sm font-extrabold text-ink">Card display order</h4>
      <PanelNote>
        The scrambled order the cards are shown in before the learner sorts them. It is a fixed scramble, not a
        shuffle, so every retry looks the same.
      </PanelNote>
      <ol className="m-0 mt-2 grid list-none gap-1.5 p-0">
        {displayOrder.map((id, index) => (
          <li key={id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="text-body">{actions.find((action) => action.id === id)?.label || id}</span>
            <span className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onChange({ displayOrder: moveInList(displayOrder, index, -1) })}
                disabled={index === 0}
              >
                Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onChange({ displayOrder: moveInList(displayOrder, index, 1) })}
                disabled={index === displayOrder.length - 1}
              >
                Down
              </Button>
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
      <PanelNote>Each condition is answered Report or No Action. The learner must get every one right to finish the step.</PanelNote>

      <div className="mt-3 grid gap-2.5">
        {prompts.map((prompt, index) => (
          <div key={prompt.id} className={ITEM_CLASSES}>
            <ItemToolbar
              index={index}
              count={prompts.length}
              onMoveUp={() => onChange({ prompts: moveInList(prompts, index, -1) })}
              onMoveDown={() => onChange({ prompts: moveInList(prompts, index, 1) })}
              onRemove={() => onChange({ prompts: prompts.filter((entry, position) => position !== index) })}
            />

            <Field label="Condition shown to the learner">
              <Textarea rows={2} value={prompt.text || ''} onChange={(event) => updatePrompt(index, { text: event.target.value })} />
            </Field>
            <Field label="Correct answer">
              <Select
                value={prompt.shouldReport ? 'report' : 'no-action'}
                onChange={(event) => updatePrompt(index, { shouldReport: event.target.value === 'report' })}
              >
                <option value="report">Report</option>
                <option value="no-action">No Action</option>
              </Select>
            </Field>
            <Field label="Feedback when correct">
              <Textarea rows={2} value={prompt.feedback || ''} onChange={(event) => updatePrompt(index, { feedback: event.target.value })} />
            </Field>
            <Field label="Feedback when wrong">
              <Textarea rows={2} value={prompt.wrongFeedback || ''} onChange={(event) => updatePrompt(index, { wrongFeedback: event.target.value })} />
            </Field>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mt-2.5"
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
      </Button>
    </>
  )
}
