import { useState } from 'react'
import {
  adminCreateQuizQuestion,
  adminDeleteQuizQuestion,
  adminUpdateQuizQuestion,
} from '../../lib/api'

// One quiz's questions. `scope` is the same shape the learner API takes:
//
//   { context: 'module', moduleId }         a module's quiz step
//   { context: 'parts', equipmentId }       an equipment's parts quiz
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
    ? question.context === 'parts' && question.equipmentId === scope.equipmentId
    : question.context !== 'parts' && String(question.moduleId) === String(scope.moduleId)
}

function QuizAdmin({ scope, questions, onQuestionsChanged, onMessage, note }) {
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [newPrompt, setNewPrompt] = useState('')

  const scopeQuestions = questions.filter((question) => inScope(question, scope))

  const run = async (action, message) => {
    try {
      const result = await action()
      onMessage(message)
      return result
    } catch (error) {
      onMessage(error.message)
      return null
    }
  }

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
    <div className="quiz-admin">
      <section className="admin-panel admin-parts-list">
        <h3>Questions</h3>
        {note && <p className="admin-panel-note">{note}</p>}

        {scopeQuestions.map((question) => (
          <button
            key={question.id}
            type="button"
            className={`admin-part-button ${selectedId === question.id ? 'is-active' : ''}`}
            onClick={() => select(question)}
          >
            {question.prompt}
          </button>
        ))}
        {scopeQuestions.length === 0 && <p className="admin-panel-note">No questions here yet.</p>}

        <label>
          New question prompt
          <input value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} placeholder="Which part ...?" />
        </label>
        <button className="admin-save" onClick={addQuestion} disabled={!newPrompt.trim()}>Add question</button>
      </section>

      <section className="admin-panel admin-editor">
        <h3>Question Editor</h3>
        {draft ? (
          <>
            <label>Prompt<textarea rows={2} value={draft.prompt || ''} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} /></label>

            <h4>Options</h4>
            <p className="admin-panel-note">Mark the correct one. Saving is refused if the answer is not one of the options.</p>
            {(draft.options || []).map((option, index) => (
              <div key={index} className="admin-row-actions">
                <input value={option} onChange={(event) => setOption(index, event.target.value)} />
                <button
                  onClick={() => setDraft({ ...draft, answer: option })}
                  className={draft.answer === option ? 'admin-save' : ''}
                >
                  {draft.answer === option ? 'Correct' : 'Mark correct'}
                </button>
                <button onClick={() => setDraft({ ...draft, options: draft.options.filter((entry, position) => position !== index) })}>
                  Remove
                </button>
              </div>
            ))}
            <button onClick={() => setDraft({ ...draft, options: [...(draft.options || []), 'New option'] })}>
              Add option
            </button>

            <div className="admin-row-actions">
              <button className="admin-save" onClick={save}>Save question</button>
              <button onClick={remove}>Delete</button>
            </div>
          </>
        ) : (
          <p>Select a question to edit it, or add a new one.</p>
        )}
      </section>
    </div>
  )
}

export default QuizAdmin
