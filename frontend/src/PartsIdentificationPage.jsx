import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import PageLayout from './components/PageLayout'
import ProgressSummary from './components/ProgressSummary'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { getParts } from './lib/api'
import { partCategories, partsHotspots, partsPracticeQuestions } from './lib/trainingData'
import './PartsIdentificationPage.css'

function PartsIdentificationPage({ moduleName, user, onLogout, onBack, onNavigate }) {
  const [hotspots, setHotspots] = useState(partsHotspots)
  const [selectedPartId, setSelectedPartId] = useState(partsHotspots[0]?.id)
  const [practiceAnswers, setPracticeAnswers] = useState({})
  const [practiceSubmitted, setPracticeSubmitted] = useState(false)
  const [expandedSections, setExpandedSections] = useState({ explore: false, practice: true })
  const { progress, summary, viewPart, savePartsPracticeAttempt } = useProgress()

  const toggleSection = (section) => {
    setExpandedSections((sections) => ({ ...sections, [section]: !sections[section] }))
  }

  useEffect(() => {
    getParts().then((items) => {
      if (items.length > 0) {
        setHotspots(items)
        setSelectedPartId(items[0].id)
      }
    })
  }, [])

  const latestPractice = progress.parts.practiceAttempts[0]
  const viewedIds = new Set(summary.viewedParts)
  const practiceScore = partsPracticeQuestions.reduce((score, question) => {
    return score + (practiceAnswers[question.id] === question.answer ? 1 : 0)
  }, 0)

  const selectPart = (partId) => {
    setSelectedPartId(partId)
    viewPart(partId)
  }

  const submitPractice = () => {
    setPracticeSubmitted(true)
    savePartsPracticeAttempt({ score: practiceScore, total: partsPracticeQuestions.length })
  }

  const retryPractice = () => {
    setPracticeAnswers({})
    setPracticeSubmitted(false)
  }

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate} wide>
      <div className="page-back-row">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <h1 className="page-heading">{moduleName} - Parts Identification</h1>
      </div>

      <ScopeNotice />
      <div className="parts-intro">
        <h2>Parts Identification Module</h2>
        <p>
          Learn major forklift parts through free exploration and short practice questions. This module supports
          familiarization only and does not replace supervised hands-on training.
        </p>
      </div>

      <div className="parts-progress-row">
        <ProgressSummary title="Parts Identification Progress" value={summary.parts} compact />
        <div className="lesson-card">
          <h3>Viewed Parts</h3>
          <p>{summary.viewedParts.length} of {partsHotspots.length} parts viewed.</p>
          <p className="muted-line">
            Latest practice: {latestPractice ? `${latestPractice.score}/${latestPractice.total} (${latestPractice.percentage}%)` : 'No attempt yet'}
          </p>
        </div>
      </div>

      <section className="parts-learning-layout">
        <div className="lesson-card mode-panel">
          <button
            type="button"
            className="accordion-header"
            onClick={() => toggleSection('explore')}
            aria-expanded={expandedSections.explore}
          >
            <div>
              <h3>Explore by Category</h3>
              <p>Select a part from the categorized list or from the 3D markers. Viewed parts are saved automatically.</p>
            </div>
            <ChevronDown size={18} className={expandedSections.explore ? 'accordion-chevron open' : 'accordion-chevron'} />
          </button>

          {expandedSections.explore && (
            <>
              <div className="category-grid">
                {partCategories.map((category) => (
                  <div key={category} className="category-group">
                    <h4>{category}</h4>
                    {hotspots
                      .filter((part) => part.category === category)
                      .map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          className={selectedPartId === part.id ? 'part-list-button active' : 'part-list-button'}
                          onClick={() => selectPart(part.id)}
                        >
                          <span>{part.label}</span>
                          <small>{viewedIds.has(part.id) ? 'Viewed' : 'Not viewed'}</small>
                        </button>
                      ))}
                  </div>
                ))}
              </div>
              <p className="todo-note">TODO: Add mesh highlighting after model part names are verified against the GLB hierarchy.</p>
            </>
          )}
        </div>
      </section>

      <section className="viewport-panel">
        {hotspots.length > 0 && (
          <ForkliftViewport
            hotspots={hotspots}
            selectedPartId={selectedPartId}
            onPartSelect={selectPart}
            onPartViewed={viewPart}
          />
        )}
      </section>

      <section className="parts-learning-layout">
        <div className="lesson-card mode-panel">
          <button
            type="button"
            className="accordion-header"
            onClick={() => toggleSection('practice')}
            aria-expanded={expandedSections.practice}
          >
            <div>
              <h3>Practice Questions</h3>
              <p>Answer each question to check part recognition. Results are saved to learner progress.</p>
            </div>
            <div className="accordion-header-right">
              {practiceSubmitted && (
                <strong className="score-pill">{practiceScore}/{partsPracticeQuestions.length}</strong>
              )}
              <ChevronDown size={18} className={expandedSections.practice ? 'accordion-chevron open' : 'accordion-chevron'} />
            </div>
          </button>

          {expandedSections.practice && (
            <>
              <div className="practice-list">
                {partsPracticeQuestions.map((question) => {
                  const selected = practiceAnswers[question.id]
                  const isCorrect = selected === question.answer

                  return (
                    <fieldset key={question.id} className="practice-question">
                      <legend>{question.prompt}</legend>
                      <div className="practice-options">
                        {question.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={selected === option ? 'answer-option selected' : 'answer-option'}
                            onClick={() => !practiceSubmitted && setPracticeAnswers((answers) => ({ ...answers, [question.id]: option }))}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {practiceSubmitted && (
                        <p className={isCorrect ? 'feedback correct' : 'feedback incorrect'}>
                          {isCorrect ? 'Correct.' : `Incorrect. Correct answer: ${question.answer}.`}
                        </p>
                      )}
                    </fieldset>
                  )
                })}
              </div>

              <div className="step-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={submitPractice}
                  disabled={Object.keys(practiceAnswers).length < partsPracticeQuestions.length || practiceSubmitted}
                >
                  Submit Practice
                </button>
                <button type="button" onClick={retryPractice}>
                  Retry
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </PageLayout>
  )
}

export default PartsIdentificationPage
