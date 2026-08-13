import { useState } from 'react'
import {
  adminCreateQuizQuestion,
  adminDeleteQuizQuestion,
  adminUpdateQuizQuestion,
} from '../../lib/api'

// Every quiz of one equipment in one editor: the parts quiz (context 'parts',
// the questions on its Parts/Hotspot Identification page) and each module's
// quiz step (context 'module'). They are the same QuizQuestion rows and save
// immediately - there is no draft/publish step for a prompt plus four options.

const PARTS_GROUP = 'parts'

function QuizAdmin({ equipmentId, modules, questions, onQuestionsChanged, onMessage }) {
  const [group, setGroup] = useState(PARTS_GROUP)
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [newPrompt, setNewPrompt] = useState('')

  const isParts = group === PARTS_GROUP
  const activeModule = isParts ? null : modules.find((module) => String(module.id) === String(group)) || null

  const groupQuestions = questions.filter((question) =>
    isParts
      ? question.context === 'parts' && question.equipmentId === equipmentId
      : question.context !== 'parts' && String(question.moduleId) === String(group),
  )

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

  const openGroup = (nextGroup) => {
    setGroup(nextGroup)
    setSelectedId(null)
    setDraft(null)
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
      () => adminCreateQuizQuestion(
        isParts
          ? { context: 'parts', equipmentId, prompt: newPrompt.trim(), options: [], answer: '' }
          : { context: 'module', moduleId: activeModule?.id, prompt: newPrompt.trim(), options: [], answer: '' },
      ),
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
    <>
      <section className="admin-panel admin-parts-list">
        <h2>Quizzes</h2>
        <div className="admin-row-actions">
          <button type="button" className={isParts ? 'admin-save' : ''} onClick={() => openGroup(PARTS_GROUP)}>
            Parts quiz
          </button>
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={String(group) === String(module.id) ? 'admin-save' : ''}
              onClick={() => openGroup(module.id)}
            >
              {module.title}
            </button>
          ))}
        </div>
        <p className="admin-panel-note">
          {isParts
            ? 'The quiz step of this equipment\'s Parts Identification page. Scores feed its parts progress percentage.'
            : 'The quiz step of this module\'s guided simulation. Ungraded - it records attempts but never blocks Next.'}
        </p>

        {groupQuestions.map((question) => (
          <button
            key={question.id}
            type="button"
            className={`admin-part-button ${selectedId === question.id ? 'is-active' : ''}`}
            onClick={() => select(question)}
          >
            {question.prompt}
          </button>
        ))}
        {groupQuestions.length === 0 && <p className="admin-panel-note">No questions here yet.</p>}

        <label>
          New question prompt
          <input value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} placeholder="Which part ...?" />
        </label>
        <button className="admin-save" onClick={addQuestion} disabled={!newPrompt.trim() || (!isParts && !activeModule)}>
          Add question
        </button>
      </section>

      <section className="admin-panel admin-editor">
        <h2>Question Editor</h2>
        {draft ? (
          <>
            <label>Prompt<textarea rows={2} value={draft.prompt || ''} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} /></label>

            <h3>Options</h3>
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
    </>
  )
}

// Rows written before the practice/quiz merge stored options as
// { id, text, sortOrder } objects; the editor works in plain strings.
function normalize(options) {
  return (options || []).map((option) => (typeof option === 'string' ? option : option?.text || ''))
}

export default QuizAdmin
