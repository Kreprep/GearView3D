import { useState } from 'react'
import {
  adminCreateQuizQuestion,
  adminDeleteQuizQuestion,
  adminUpdateQuizQuestion,
} from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

// One quiz's questions. `scope` is the same shape the learner API takes:
//
//   { context: 'module', moduleId }         a module's quiz step
//   { context: 'parts' }                    the Parts Identification quiz
//
// Both are QuizQuestion rows and save immediately - there is no draft/publish
// step for a prompt plus four options.

// Rows written before the practice/quiz merge stored options as
// { id, text, sortOrder } objects; the editor works in plain strings.
function normalize(options) {
  return (options || []).map((option) => (typeof option === 'string' ? option : option?.text || ''))
}

function inScope(question, scope) {
  return scope.context === 'parts'
    ? question.context === 'parts'
    : question.context !== 'parts' && String(question.moduleId) === String(scope.moduleId)
}

function QuizAdmin({ scope, questions, onQuestionsChanged, onMessage, note }) {
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [newPrompt, setNewPrompt] = useState('')

  const scopeQuestions = questions.filter((question) => inScope(question, scope))
  const { run } = useAdminAction(onMessage)

  const select = (question) => {
    setSelectedId(question.id)
    setDraft({ ...question, options: normalize(question.options) })
  }

  const save = async () => {
    if (!(draft.options || []).includes(draft.answer)) {
      onMessage('The correct answer must be one of the options.')
      return
    }

    const result = await run(
      () => adminUpdateQuizQuestion(draft.id, {
        prompt: draft.prompt,
        options: draft.options,
        answer: draft.answer,
      }),
      'Question saved.',
    )
    if (!result) return
    onQuestionsChanged(questions.map((entry) => (entry.id === result.question.id ? result.question : entry)))
    setDraft({ ...result.question, options: normalize(result.question.options) })
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${draft.prompt}"? Learners will no longer be asked it.`)) return
    const result = await run(() => adminDeleteQuizQuestion(draft.id), 'Question deleted.')
    if (!result) return
    onQuestionsChanged(questions.filter((entry) => entry.id !== draft.id))
    setSelectedId(null)
    setDraft(null)
  }

  const addQuestion = async () => {
    if (!newPrompt.trim()) return
    const result = await run(
      () => adminCreateQuizQuestion({ ...scope, prompt: newPrompt.trim(), options: [], answer: '' }),
      'Question created. Add its options and mark the correct one.',
    )
    if (!result) return
    onQuestionsChanged([...questions, result.question])
    select(result.question)
    setNewPrompt('')
  }

  // The answer is stored as the option's text, so renaming the chosen option
  // has to carry the answer with it or the question becomes unanswerable.
  const setOption = (index, value) => {
    const options = [...(draft.options || [])]
    const previous = options[index]
    options[index] = value
    setDraft({ ...draft, options, answer: draft.answer === previous ? value : draft.answer })
  }

  return (
    <div className="grid gap-3.5">
      <Panel>
        <PanelHeader>Questions</PanelHeader>
        {note && <PanelNote>{note}</PanelNote>}

        <div className="mt-2.5 grid gap-1.5">
          {scopeQuestions.map((question) => (
            <button
              key={question.id}
              type="button"
              className={`rounded-lg border px-3 py-2.5 text-left text-[13.5px] font-bold leading-snug transition ${
                selectedId === question.id ? 'border-accent bg-accent-soft text-ink' : 'border-border bg-slate-50 text-ink hover:border-slate-400 hover:bg-white'
              }`}
              onClick={() => select(question)}
            >
              {question.prompt}
            </button>
          ))}
        </div>
        {scopeQuestions.length === 0 && <PanelNote className="mt-2">No questions here yet.</PanelNote>}

        <Field label="New question prompt" className="mt-3">
          <Input value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} placeholder="Which part ...?" />
        </Field>
        <Toolbar>
          <Button type="button" onClick={addQuestion} disabled={!newPrompt.trim()}>Add question</Button>
        </Toolbar>
      </Panel>

      <Panel>
        <PanelHeader>Question Editor</PanelHeader>
        {draft ? (
          <div className="mt-3 grid gap-3">
            <Field label="Prompt">
              <Textarea rows={2} value={draft.prompt || ''} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} />
            </Field>

            <div>
              <h4 className="m-0 text-sm font-extrabold text-ink">Options</h4>
              <PanelNote className="mt-1">Mark the correct one. Saving is refused if the answer is not one of the options.</PanelNote>
            </div>

            <div className="grid gap-2">
              {(draft.options || []).map((option, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input className="flex-1" value={option} onChange={(event) => setOption(index, event.target.value)} />
                  <Button
                    type="button"
                    size="sm"
                    variant={draft.answer === option ? 'default' : 'secondary'}
                    onClick={() => setDraft({ ...draft, answer: option })}
                  >
                    {draft.answer === option ? 'Correct' : 'Mark correct'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => setDraft({ ...draft, options: draft.options.filter((entry, position) => position !== index) })}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" className="justify-self-start" onClick={() => setDraft({ ...draft, options: [...(draft.options || []), 'New option'] })}>
              Add option
            </Button>

            <Toolbar>
              <Button type="button" onClick={save}>Save question</Button>
              <Button type="button" variant="danger" onClick={remove}>Delete</Button>
            </Toolbar>
          </div>
        ) : (
          <PanelNote>Select a question to edit it, or add a new one.</PanelNote>
        )}
      </Panel>
    </div>
  )
}

export default QuizAdmin
