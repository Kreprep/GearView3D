import { useProgress } from '../hooks/useProgress'
import './ModuleCompletionSummary.css'

function ModuleCompletionSummary({ moduleSlug, moduleTitle, nextLabel, onNext }) {
  const { summary, progress } = useProgress()
  const checklist = summary.checklist[moduleSlug]
  const latestQuiz = progress.quizzes[moduleSlug]?.[0]
  const moduleProgress = summary.modules[moduleSlug] || 0
  const complete = moduleProgress === 100

  return (
    <section className="module-completion-summary">
      <div>
        <p className="completion-kicker">Completion Summary</p>
        <h3>{moduleTitle}</h3>
        <p>
          Checklist: {checklist.completedCount}/{checklist.totalCount} complete.
          {' '}Quiz: {latestQuiz ? `${latestQuiz.score}/${latestQuiz.total}` : 'not attempted'}.
        </p>
      </div>
      <div className={complete ? 'completion-badge complete' : 'completion-badge'}>
        {complete ? 'Complete' : `${moduleProgress}% complete`}
      </div>
      {nextLabel && onNext && (
        <button type="button" className="next-module-button" onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </section>
  )
}

export default ModuleCompletionSummary
