import { useEffect, useMemo, useState } from 'react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import ProgressSummary from './components/ProgressSummary'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { getParts } from './lib/api'
import { partCategories, partsHotspots, partsPracticeQuestions } from './lib/trainingData'
import './PartsIdentificationPage.css'

function getPartById(partId, hotspots) {
  return hotspots.find((part) => part.id === partId) || hotspots[0]
}

function PartsIdentificationPage({ moduleName, onBack }) {
  const [hotspots, setHotspots] = useState(partsHotspots)
  const [activeMode, setActiveMode] = useState('learn')
  const [selectedPartId, setSelectedPartId] = useState(partsHotspots[0]?.id)
  const [walkthroughStarted, setWalkthroughStarted] = useState(false)
  const [walkthroughIndex, setWalkthroughIndex] = useState(0)
  const [practiceAnswers, setPracticeAnswers] = useState({})
  const [practiceSubmitted, setPracticeSubmitted] = useState(false)
  const { progress, summary, viewPart, savePartsPracticeAttempt } = useProgress()

  useEffect(() => {
    getParts().then((items) => {
      if (items.length > 0) {
        setHotspots(items)
        setSelectedPartId(items[0].id)
      }
    })
  }, [])

  const selectedPart = useMemo(() => getPartById(selectedPartId, hotspots), [hotspots, selectedPartId])
  const guidedPart = hotspots[walkthroughIndex] || hotspots[0]
  const latestPractice = progress.parts.practiceAttempts[0]
  const viewedIds = new Set(summary.viewedParts)
  const practiceScore = partsPracticeQuestions.reduce((score, question) => {
    return score + (practiceAnswers[question.id] === question.answer ? 1 : 0)
  }, 0)

  const selectPart = (partId) => {
    setSelectedPartId(partId)
    viewPart(partId)
  }

  const startWalkthrough = () => {
    setWalkthroughStarted(true)
    setWalkthroughIndex(0)
    selectPart(hotspots[0]?.id)
  }

  const moveWalkthrough = (direction) => {
    const nextIndex = Math.min(Math.max(walkthroughIndex + direction, 0), hotspots.length - 1)
    setWalkthroughIndex(nextIndex)
    selectPart(hotspots[nextIndex]?.id)
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
    <div className="training-page-container">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          Back
        </button>
        <h1>{moduleName} - Parts Identification</h1>
      </header>

      <main className="training-content">
        <div className="content-section">
          <ScopeNotice />
          <h2>Parts Identification Module</h2>
          <p>
            Learn major forklift parts through a guided walkthrough, free exploration, and short practice questions.
            This module supports familiarization only and does not replace supervised hands-on training.
          </p>

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

          <div className="mode-tabs" role="tablist" aria-label="Parts identification modes">
            {[
              ['learn', 'Learn Mode'],
              ['explore', 'Explore Mode'],
              ['practice', 'Practice Mode'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={activeMode === mode ? 'active' : ''}
                onClick={() => setActiveMode(mode)}
                role="tab"
                aria-selected={activeMode === mode}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="parts-learning-layout">
            <div className="parts-main-panel">
              {activeMode === 'learn' && (
                <div className="lesson-card mode-panel">
                  <div className="panel-heading-row">
                    <div>
                      <h3>Guided Walkthrough</h3>
                      <p>Move through one part at a time and review its role, inspection reminder, and safety note.</p>
                    </div>
                    <button type="button" className="primary-action" onClick={startWalkthrough}>
                      {walkthroughStarted ? 'Restart Walkthrough' : 'Start Walkthrough'}
                    </button>
                  </div>

                  {walkthroughStarted ? (
                    <div className="guided-part-card">
                      <p className="eyebrow">Step {walkthroughIndex + 1} of {hotspots.length}</p>
                      <h4>{guidedPart.label}</h4>
                      <p><strong>Category:</strong> {guidedPart.category}</p>
                      <p>{guidedPart.functionText}</p>
                      <p><strong>Inspection reminder:</strong> {guidedPart.inspectionReminder}</p>
                      <p><strong>Safety note:</strong> {guidedPart.safetyNote}</p>
                      <p className="todo-note">TODO: Connect guided steps to camera focus once the GLB mesh names and target coordinates are finalized.</p>
                      <div className="step-actions">
                        <button type="button" onClick={() => moveWalkthrough(-1)} disabled={walkthroughIndex === 0}>
                          Previous
                        </button>
                        <button type="button" onClick={() => moveWalkthrough(1)} disabled={walkthroughIndex === hotspots.length - 1}>
                          Next
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">Start the walkthrough to mark each forklift component as viewed.</div>
                  )}
                </div>
              )}

              {activeMode === 'explore' && (
                <div className="lesson-card mode-panel">
                  <h3>Explore by Category</h3>
                  <p>Select a part from the categorized list or from the 3D markers. Viewed parts are saved automatically.</p>
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
                </div>
              )}

              {activeMode === 'practice' && (
                <div className="lesson-card mode-panel">
                  <div className="panel-heading-row">
                    <div>
                      <h3>Practice Questions</h3>
                      <p>Answer each question to check part recognition. Results are saved to learner progress.</p>
                    </div>
                    {practiceSubmitted && (
                      <strong className="score-pill">{practiceScore}/{partsPracticeQuestions.length}</strong>
                    )}
                  </div>

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
                </div>
              )}
            </div>

            <aside className="parts-detail-panel lesson-card">
              <p className="eyebrow">Selected Part</p>
              <h3>{selectedPart?.label}</h3>
              <p><strong>Category:</strong> {selectedPart?.category}</p>
              <p>{selectedPart?.functionText}</p>
              <p><strong>Inspection reminder:</strong> {selectedPart?.inspectionReminder}</p>
              <p><strong>Safety note:</strong> {selectedPart?.safetyNote}</p>
              <p><strong>Related training:</strong> {selectedPart?.relatedModule}</p>
            </aside>
          </section>

          <section className="viewport-panel">
            <h3>Live Forklift Parts View</h3>
            <p>Use the controls below to inspect the forklift and select labeled parts.</p>
            {hotspots.length > 0 && (
              <ForkliftViewport
                hotspots={hotspots}
                selectedPartId={selectedPartId}
                onPartSelect={selectPart}
                onPartViewed={viewPart}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default PartsIdentificationPage
