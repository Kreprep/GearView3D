import { routes } from './lib/router'
import { useProgress } from './hooks/useProgress'
import PageLayout from './components/PageLayout'
import ScopeNotice from './components/ScopeNotice'
import { partsHotspots, trainingModules } from './lib/trainingData'
import './AssessmentPage.css'

const moduleLabels = trainingModules.reduce((labels, module) => {
  labels[module.slug] = module.title
  return labels
}, {})

function AssessmentPage({ moduleName, user, onLogout, onBack, onNavigate }) {
  const { summary } = useProgress()
  const latestAttempts = Object.entries(summary.quizAttempts).flatMap(([moduleSlug, attempts]) =>
    attempts.map((attempt) => ({ ...attempt, moduleSlug })),
  )
  const viewedPartSet = new Set(summary.viewedParts)
  const latestPartsPractice = summary.partsPracticeAttempts[0]
  const requiredComplete = summary.equipment === 100 && summary.parts === 100
  const recommendedAction = requiredComplete
    ? 'Ready for instructor review or thesis demo presentation.'
    : summary.equipment < summary.parts
      ? 'Continue equipment usage checklists and module quizzes.'
      : 'Review remaining forklift parts and complete parts practice.'

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="page-back-row">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1 className="page-heading">{moduleName} - Final Assessment</h1>
      </div>

      <ScopeNotice />
      <section className="assessment-card">
        <p className="assessment-kicker">Progress Review</p>
        <h2>{requiredComplete ? 'Prototype Module Completion' : 'Training still in progress'}</h2>
        <p>
          This page summarizes GearView3D learner progress for thesis demonstration. The completion badge is
          only for prototype module completion and does not imply official TESDA certification.
        </p>

        <div className="assessment-status-grid">
          <div>
            <span>Overall</span>
            <strong>{summary.overall}%</strong>
          </div>
          <div>
            <span>Equipment Usage</span>
            <strong>{summary.equipment}%</strong>
          </div>
          <div>
            <span>Parts Identification</span>
            <strong>{summary.parts}%</strong>
          </div>
        </div>

        <div className="assessment-review-grid">
          <article>
            <h3>Equipment Usage Review</h3>
            <ul>
              {trainingModules.map((module) => {
                const checklist = summary.checklist[module.slug]
                const latestQuiz = summary.quizAttempts[module.slug]?.[0]
                return (
                  <li key={module.slug}>
                    {module.title}: {checklist.completedCount}/{checklist.totalCount} checklist items,
                    {' '}quiz {latestQuiz ? `${latestQuiz.score}/${latestQuiz.total}` : 'not attempted'}
                  </li>
                )
              })}
            </ul>
          </article>

          <article>
            <h3>Parts Review</h3>
            <p>{summary.viewedParts.length} of {partsHotspots.length} parts viewed.</p>
            <ul>
              {partsHotspots.map((part) => (
                <li key={part.id}>{part.label}: {viewedPartSet.has(part.id) ? 'viewed' : 'not viewed'}</li>
              ))}
            </ul>
          </article>

          <article>
            <h3>Quiz Scores</h3>
            {latestAttempts.length ? (
              <ul>
                {latestAttempts.slice(0, 8).map((attempt) => (
                  <li key={attempt.id}>
                    {moduleLabels[attempt.moduleSlug] || attempt.moduleSlug}: {attempt.score}/{attempt.total} ({attempt.percentage}%)
                  </li>
                ))}
              </ul>
            ) : (
              <p>No equipment quiz attempts saved yet.</p>
            )}
          </article>

          <article>
            <h3>Recommended Next Action</h3>
            <p>{recommendedAction}</p>
            <p>
              Parts practice: {latestPartsPractice ? `${latestPartsPractice.score}/${latestPartsPractice.total} (${latestPartsPractice.percentage}%)` : 'not attempted'}.
            </p>
          </article>
        </div>

        {requiredComplete && (
          <p className="completion-badge">GearView3D Training Completion</p>
        )}

        <div className="assessment-actions">
          <button onClick={() => onNavigate(routes.equipment)}>Review equipment usage</button>
          <button onClick={() => onNavigate(routes.parts)}>Review parts identification</button>
        </div>
      </section>
    </PageLayout>
  )
}

export default AssessmentPage
