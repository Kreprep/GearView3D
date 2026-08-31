import { useEffect, useState } from 'react'
import { useProgress } from '../hooks/useProgress'
import { getQuizQuestions, submitQuiz } from '../lib/api'
import { useT } from '../i18n'
import { getLatestQuizAttempt, hydrateProgressFromServer } from '../lib/progressService'
import './Quiz.css'

// Every quiz in the app renders through here - a module's quiz step and an
// equipment's parts quiz alike. `scope` says which:
//
//   { module: 'load-handling' }              the module's quiz questions
//   { equipment: 'forklift', context: 'parts' }  that equipment's parts quiz
//
// Questions come from the QuizQuestion rows the dashboard edits (never from
// data/, which carries the answers), and grading happens on the server - the
// GET payload has no answers, so there is nothing to score locally.
function Quiz({ scope, title, emptyMessage, onScored }) {
  const t = useT()
  const heading = title || t('quiz.defaultTitle')
  const [questions, setQuestions] = useState([])
  const { progress } = useProgress()
  const scopeKey = scope.context === 'parts' ? `parts:${scope.equipment}` : `module:${scope.module}`

  useEffect(() => {
    let cancelled = false

    getQuizQuestions(scope)
      .then((rows) => {
        if (!cancelled) setQuestions(rows)
      })
      .catch(() => {
        if (!cancelled) setQuestions([])
      })

    return () => {
      cancelled = true
    }
    // Re-fetching is keyed on the scope's identity, not the object literal a
    // parent re-creates on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey])

  const [answers, setAnswers] = useState({})
  // `result` is the server's verdict: it holds the score and, per question,
  // whether the choice was right and what the right answer was.
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const submitted = result !== null
  const latestAttempt = getLatestQuizAttempt(progress, scope)

  const submit = async () => {
    setBusy(true)
    try {
      const scored = await submitQuiz(scope, answers)
      setResult(scored)
      onScored?.(scored)
      // The server wrote the attempt into the stored progress document, so the
      // local copy is refreshed before its next debounced push overwrites it.
      await hydrateProgressFromServer().catch(() => {})
    } catch {
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const retry = () => {
    setAnswers({})
    setResult(null)
  }

  if (questions.length === 0) {
    return (
      <section className="module-quiz">
        <h3>{heading}</h3>
        <p>{emptyMessage || t('quiz.empty')}</p>
      </section>
    )
  }

  return (
    <section className="module-quiz">
      <div className="module-quiz-header">
        <div>
          <h3>{heading}</h3>
          <p>{t('quiz.intro')}</p>
        </div>
        <div className="quiz-status-pill">
          {latestAttempt
            ? t('quiz.latest', { score: latestAttempt.score, total: latestAttempt.total })
            : t('quiz.noAttempt')}
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
                  {verdict.correct
                    ? t('quiz.correct')
                    : t('quiz.incorrect', { answer: verdict.correctAnswer })}
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
          onClick={submit}
          disabled={busy || submitted || Object.keys(answers).length < questions.length}
        >
          {t(busy ? 'quiz.submitting' : 'quiz.submit')}
        </button>
        <button type="button" onClick={retry}>
          {t('quiz.retry')}
        </button>
      </div>

      {result && (
        <div className="quiz-result">
          {t('quiz.result', { score: result.score, total: result.total, percentage: result.percentage })}
        </div>
      )}
    </section>
  )
}

export default Quiz
