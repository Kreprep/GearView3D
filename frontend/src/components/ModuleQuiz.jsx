import { useMemo, useState } from 'react'
import { useProgress } from '../hooks/useProgress'
import { moduleQuizQuestions } from '../lib/trainingData'
import './ModuleQuiz.css'

function ModuleQuiz({ moduleSlug, title = 'Short Quiz' }) {
  const questions = useMemo(() => moduleQuizQuestions[moduleSlug] || [], [moduleSlug])
  const { progress, saveQuizAttempt } = useProgress()
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const latestAttempt = progress.quizzes[moduleSlug]?.[0]
  const score = useMemo(
    () => questions.reduce((total, question) => total + (answers[question.id] === question.answer ? 1 : 0), 0),
    [answers, questions],
  )

  const submitQuiz = () => {
    setSubmitted(true)
    saveQuizAttempt(moduleSlug, { score, total: questions.length })
  }

  const retryQuiz = () => {
    setAnswers({})
    setSubmitted(false)
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
          const isCorrect = selected === question.answer

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
              {submitted && (
                <p className={isCorrect ? 'quiz-feedback correct' : 'quiz-feedback incorrect'}>
                  {isCorrect ? 'Correct.' : `Incorrect. Correct answer: ${question.answer}.`}
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
          disabled={submitted || Object.keys(answers).length < questions.length}
        >
          Submit Quiz
        </button>
        <button type="button" onClick={retryQuiz}>
          Retry
        </button>
      </div>

      {submitted && (
        <div className="quiz-result">
          Result: {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%)
        </div>
      )}
    </section>
  )
}

export default ModuleQuiz
