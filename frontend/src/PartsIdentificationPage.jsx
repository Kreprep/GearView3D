import { useEffect, useState } from 'react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { getPartDetails, getParts } from './lib/api'
import { partCategories, partsHotspots, partsPracticeQuestions } from './lib/trainingData'
import './PartsIdentificationPage.css'

const partsModule = {
  fullTitle: 'Parts Identification',
  title: 'Parts Identification',
  learningObjectives: [
    'Explore major forklift parts using the 3D model and the category list.',
    'View every part at least once to track exploration progress.',
    'Answer the practice questions to check part recognition.',
  ],
}

const steps = [
  {
    id: 'explore',
    title: 'Explore by Category',
    instructions: 'Select a part from the categorized list or tap a marker on the model. Viewed parts are saved automatically.',
    hint: 'Not sure where to start? Try tapping a marker directly on the 3D model, or pick a part from a category below.',
  },
  {
    id: 'practice',
    title: 'Practice Questions',
    instructions: 'Answer each question to check part recognition. Results are saved to learner progress.',
    hint: 'Revisit any part you are unsure about in the Explore step before answering.',
  },
]

function buildDetail(hotspot, partDetails) {
  if (!hotspot) return null
  const detail = partDetails[hotspot.id] || {}
  return {
    title: detail.title || hotspot.label,
    subtitle: detail.subtitle || hotspot.category,
    image: detail.image,
    description: detail.description || hotspot.functionText,
  }
}

function PartsIdentificationPage({ moduleName, onBack }) {
  const [hotspots, setHotspots] = useState(partsHotspots)
  const [partDetails, setPartDetails] = useState({})
  const [selectedPartId, setSelectedPartId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [practiceAnswers, setPracticeAnswers] = useState({})
  const [practiceSubmitted, setPracticeSubmitted] = useState(false)
  const { progress, summary, viewPart, savePartsPracticeAttempt } = useProgress()

  useEffect(() => {
    getParts().then((items) => {
      if (items.length > 0) {
        setHotspots(items)
      }
    })
    getPartDetails().then(setPartDetails)
  }, [])

  const latestPractice = progress.parts.practiceAttempts[0]
  const viewedIds = new Set(summary.viewedParts)
  const practiceScore = partsPracticeQuestions.reduce((score, question) => {
    return score + (practiceAnswers[question.id] === question.answer ? 1 : 0)
  }, 0)

  const selectPart = (hotspot) => {
    setSelectedPartId(hotspot.id)
    setSelectedDetail(buildDetail(hotspot, partDetails))
    viewPart(hotspot.id)
  }

  const clearSelectedDetail = () => setSelectedDetail(null)

  const goToStep = (index) => {
    setCurrentStepIndex(Math.min(Math.max(index, 0), steps.length - 1))
    setSelectedDetail(null)
  }

  const submitPractice = () => {
    setPracticeSubmitted(true)
    savePartsPracticeAttempt({ score: practiceScore, total: partsPracticeQuestions.length })
  }

  const retryPractice = () => {
    setPracticeAnswers({})
    setPracticeSubmitted(false)
  }

  const completeModule = () => {
    if (!practiceSubmitted) return
    onBack?.()
  }

  const renderScene = () => (
    <div className="parts-scene-wrap">
      <ForkliftViewport
        hotspots={hotspots}
        selectedHotspotId={selectedPartId}
        onHotspotSelect={selectPart}
        onResetView={() => setSelectedPartId(null)}
      />
    </div>
  )

  const renderExploreTask = () => (
    <div className="parts-task-stack">
      <ScopeNotice />
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
                  onClick={() => selectPart(part)}
                >
                  <span>{part.label}</span>
                  <small>{viewedIds.has(part.id) ? 'Viewed' : 'Not viewed'}</small>
                </button>
              ))}
          </div>
        ))}
      </div>
      <p className="task-note">{summary.viewedParts.length} of {hotspots.length} parts viewed.</p>
    </div>
  )

  const renderPracticeTask = () => (
    <div className="parts-task-stack">
      <p className="task-note">
        Latest practice: {latestPractice ? `${latestPractice.score}/${latestPractice.total} (${latestPractice.percentage}%)` : 'No attempt yet'}
      </p>
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
      {practiceSubmitted && <p className="task-note">Score: {practiceScore}/{partsPracticeQuestions.length}. Click Complete Module to finish.</p>}
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'practice') return renderPracticeTask()
    return renderExploreTask()
  }

  return (
    <div className="module-page-container parts-identification-page">
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          Back to Modules
        </button>
        <div className="module-title-section">
          <h1>{partsModule.fullTitle}</h1>
          <h2>{moduleName} Familiarization</h2>
        </div>
      </header>

      <main className="module-content wide-simulation-content">
        <ModuleSimulationShell
          module={partsModule}
          steps={steps}
          currentStepIndex={currentStepIndex}
          objectives={partsModule.learningObjectives}
          progress={summary.parts}
          canProceed
          onBackStep={() => goToStep(currentStepIndex - 1)}
          onNextStep={() => goToStep(currentStepIndex + 1)}
          onComplete={completeModule}
          renderScene={renderScene}
          renderTask={renderTask}
          selectedDetail={selectedDetail}
          onClearDetail={clearSelectedDetail}
        />
      </main>
    </div>
  )
}

export default PartsIdentificationPage
