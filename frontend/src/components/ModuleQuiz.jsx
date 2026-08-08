import { useEffect, useState } from 'react'
import { useProgress } from '../hooks/useProgress'
import { getModuleQuiz, submitModuleQuiz } from '../lib/api'
import { hydrateProgressFromServer } from '../lib/progressService'
import './ModuleQuiz.css'

function ModuleQuiz({ moduleSlug, title = 'Short Quiz' }) {
  // Questions come from the QuizQuestion rows the Quizzes tab edits, not from
  // data/, so an admin's edit reaches learners without a rebuild.
  const [questions, setQuestions] = useState([])
  const { progress } = useProgress()

  useEffect(() => {
    let cancelled = false

    getModuleQuiz(moduleSlug)
      .then((rows) => {
        if (!cancelled) setQuestions(rows)
      })
      .catch(() => {
        if (!cancelled) setQuestions([])
      })

    return () => {
      cancelled = true
    }
  }, [moduleSlug])

  const [answers, setAnswers] = useState({})
  // `result` is the server's verdict: it holds the score and, per question,
  // whether the choice was right and what the right answer was. There is no
  // local score, because the questions arrive without their answers.
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const submitted = result !== null
  const latestAttempt = progress.quizzes[moduleSlug]?.[0]

  const submitQuiz = async () => {
    setBusy(true)
    try {
      const scored = await submitModuleQuiz(moduleSlug, answers)
      setResult(scored)
      // The server wrote the attempt into the stored progress document, so the
      // local copy is refreshed before its next debounced push overwrites it.
      await hydrateProgressFromServer().catch(() => {})
    } catch {
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const retryQuiz = () => {
    setAnswers({})
    setResult(null)
  }

  if (questions.length === 0) {
    return (
      <section className="module-quiz">
        <h3>{title}</h3>
        <p>No quiz questions are available for this module yet.</p>
      </section>
    )
  }

  return (
    <section className="module-quiz">
      <div className="module-quiz-header">
        <div>
          <h3>{title}</h3>
          <p>Answer the questions below. Your latest attempt is saved automatically after submission.</p>
        </div>
        <div className="quiz-status-pill">
          {latestAttempt ? `Latest: ${latestAttempt.score}/${latestAttempt.total}` : 'No attempt yet'}
        </div>
      </div>

      <div className="quiz-question-list">
        {questions.map((question) => {
          const selected = answers[question.id]
          const verdict = result?.results?.[question.id]

          return (
            <fieldset key={question.id} className="quiz-question">
              <legend>{question.prompt}</legend>
              <div className="quiz-options">
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={selected === option ? 'quiz-option selected' : 'quiz-option'}
                    onClick={() => !submitted && setAnswers((current) => ({ ...current, [question.id]: option }))}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {verdict && (
                <p className={verdict.correct ? 'quiz-feedback correct' : 'quiz-feedback incorrect'}>
                  {verdict.correct ? 'Correct.' : `Incorrect. Correct answer: ${verdict.correctAnswer}.`}
                </p>
              )}
            </fieldset>
          )
        })}
      </div>

      <div className="quiz-actions">
        <button
          type="button"
          className="quiz-submit"
          onClick={submitQuiz}
          disabled={busy || submitted || Object.keys(answers).length < questions.length}
        >
          {busy ? 'Submitting...' : 'Submit Quiz'}
        </button>
        <button type="button" onClick={retryQuiz}>
          Retry
        </button>
      </div>

      {result && (
        <div className="quiz-result">
          Result: {result.score}/{result.total} ({result.percentage}%)
        </div>
      )}
    </section>
  )
}

export default ModuleQuiz
