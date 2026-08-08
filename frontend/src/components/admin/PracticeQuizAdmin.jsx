import { useState } from 'react'
import {
  adminCreatePartCategory,
  adminCreatePracticeQuestion,
  adminDeletePartCategory,
  adminDeletePracticeQuestion,
  adminPublishPracticeQuestion,
  adminRevertPracticeQuestion,
  adminUpdatePartCategory,
  adminUpdatePracticeQuestion,
} from '../../lib/api'

// The Parts Identification practice quiz and the category filter chips.
//
// Questions follow the same draft/publish rule as parts: editing writes a
// draft and learners keep the published question until Publish. Categories are
// a short list of labels with no learner-visible body text, so they save
// immediately.

function editable(question) {
  return question.draft ? { ...question, ...question.draft } : question
}

function PracticeQuizAdmin({ questions, categories, onQuestionsChanged, onCategoriesChanged, onMessage }) {
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [newPrompt, setNewPrompt] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const selected = questions.find((question) => question.id === selectedId) || null

  const select = (question) => {
    setSelectedId(question.id)
    setDraft(editable(question))
  }

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

  const replaceQuestion = (question) => {
    onQuestionsChanged(questions.map((entry) => (entry.id === question.id ? question : entry)))
    setDraft(editable(question))
  }

  const saveDraft = async () => {
    const result = await run(
      () => adminUpdatePracticeQuestion(draft.id, draft),
      'Draft saved. Publish to show it to learners.',
    )
    if (result) replaceQuestion(result.question)
    return result
  }

  const publish = async () => {
    if (!(await saveDraft())) return
    const result = await run(() => adminPublishPracticeQuestion(draft.id), 'Question published.')
    if (result) replaceQuestion(result.question)
  }

  const revert = async () => {
    const result = await run(() => adminRevertPracticeQuestion(draft.id), 'Draft discarded.')
    if (result) replaceQuestion(result.question)
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${draft.prompt}"? Learners will no longer be asked it.`)) return
    const result = await run(() => adminDeletePracticeQuestion(draft.id), 'Question deleted.')
    if (!result) return
    onQuestionsChanged(questions.filter((entry) => entry.id !== draft.id))
    setSelectedId(null)
    setDraft(null)
  }

  const addQuestion = async () => {
    if (!newPrompt.trim()) return
    const result = await run(
      () => adminCreatePracticeQuestion({ prompt: newPrompt.trim(), options: [], answer: '' }),
      'Question created. Add its options, then Publish.',
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

  const addCategory = async () => {
    if (!newCategory.trim()) return
    const result = await run(
      () => adminCreatePartCategory({ label: newCategory.trim() }),
      'Category added.',
    )
    if (!result) return
    onCategoriesChanged([...categories, result.category])
    setNewCategory('')
  }

  const renameCategory = async (category, label) => {
    const result = await run(() => adminUpdatePartCategory(category.id, { label }), 'Category renamed.')
    if (!result) return
    onCategoriesChanged(categories.map((entry) => (entry.id === category.id ? result.category : entry)))
  }

  const removeCategory = async (category) => {
    const result = await run(() => adminDeletePartCategory(category.id), 'Category deleted.')
    if (!result) return
    onCategoriesChanged(categories.filter((entry) => entry.id !== category.id))
  }

  return (
    <>
      <section className="admin-panel admin-parts-list">
        <h2>Practice Questions</h2>
        <p className="admin-panel-note">
          The multiple-choice practice step of Parts Identification. Scores are saved per learner and feed the parts
          progress percentage.
        </p>
        {questions.map((question) => (
          <button
            key={question.id}
            type="button"
            className={`admin-part-button ${selectedId === question.id ? 'is-active' : ''}`}
            onClick={() => select(question)}
          >
            {editable(question).prompt}
            {question.draft && ' (draft)'}
          </button>
        ))}

        <label>
          New question prompt
          <input value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} placeholder="Which part ...?" />
        </label>
        <button className="admin-save" onClick={addQuestion} disabled={!newPrompt.trim()}>Add question</button>

        <h2>Part Categories</h2>
        <p className="admin-panel-note">The filter chips above the parts list. A category still used by a part cannot be deleted.</p>
        {categories.map((category) => (
          <div key={category.id} className="admin-row-actions">
            <input value={category.label} onChange={(event) => renameCategory(category, event.target.value)} />
            <button onClick={() => removeCategory(category)}>Delete</button>
          </div>
        ))}
        <label>
          New category
          <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
        </label>
        <button className="admin-save" onClick={addCategory} disabled={!newCategory.trim()}>Add category</button>
      </section>

      <section className="admin-panel admin-editor">
        <h2>Question Editor</h2>
        {draft && selected ? (
          <>
            <label>Prompt<textarea rows={2} value={draft.prompt || ''} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} /></label>

            <h3>Options</h3>
            <p className="admin-panel-note">Pick the correct one below. Publishing is refused if the answer is not one of the options.</p>
            {(draft.options || []).map((option, index) => (
              <div key={index} className="admin-row-actions">
                <input value={option} onChange={(event) => setOption(index, event.target.value)} />
                <button
                  onClick={() => setDraft({ ...draft, answer: option })}
                  className={draft.answer === option ? 'admin-save' : ''}
                >
                  {draft.answer === option ? 'Correct' : 'Mark correct'}
                </button>
                <button
                  onClick={() => setDraft({ ...draft, options: draft.options.filter((entry, position) => position !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button onClick={() => setDraft({ ...draft, options: [...(draft.options || []), 'New option'] })}>
              Add option
            </button>

            {selected.draft && (
              <p className="admin-panel-note admin-draft-note">
                Unpublished draft - learners still see the published question.
              </p>
            )}

            <div className="admin-row-actions">
              <button onClick={saveDraft}>Save draft</button>
              <button className="admin-save" onClick={publish}>Publish</button>
              {selected.draft && <button onClick={revert}>Discard draft</button>}
              <button onClick={remove}>Delete</button>
            </div>
          </>
        ) : (
          <p>Select a practice question to edit it, or add a new one.</p>
        )}
      </section>
    </>
  )
}

export default PracticeQuizAdmin
