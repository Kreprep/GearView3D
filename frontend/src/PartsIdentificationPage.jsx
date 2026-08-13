import { useEffect, useState } from 'react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import SimulationPageLayout from './components/SimulationPageLayout'
import ScopeNotice, { FORKLIFT_SCOPE_NOTE } from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import Quiz from './components/Quiz'
import { getPartCategories, getPartDetails, getParts } from './lib/api'
import { partCategories, partsHotspots } from './lib/trainingData'
import './PartsIdentificationPage.css'

const partsModule = {
  fullTitle: 'Parts Identification',
  title: 'Parts Identification',
  learningObjectives: [
    'Explore major forklift parts using the 3D model and the category list.',
    'View every part at least once to track exploration progress.',
    'Answer the quiz questions to check part recognition.',
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
    id: 'quiz',
    title: 'Quiz',
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

function PartsIdentificationPage({ moduleName, user, onBack }) {
  const isAdmin = user?.role === 'ADMIN'
  const [hotspots, setHotspots] = useState(partsHotspots)
  // Categories are DB rows the Parts tab edits; the static list is only the
  // pre-fetch fallback. The quiz itself renders through the shared Quiz
  // component, which fetches its own questions.
  const [categories, setCategories] = useState(partCategories)
  const [partDetails, setPartDetails] = useState({})
  const [selectedPartId, setSelectedPartId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  // Set once the learner submits the quiz, which is what unlocks Complete.
  const [quizScored, setQuizScored] = useState(false)
  const { summary, viewPart } = useProgress()

  useEffect(() => {
    getParts().then((items) => {
      if (items.length > 0) {
        setHotspots(items)
      }
    })
    getPartDetails().then(setPartDetails)
    getPartCategories().then((rows) => {
      if (rows.length > 0) setCategories(rows.map((row) => row.label))
    })
  }, [])

  const viewedIds = new Set(summary.viewedParts)

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

  const completeModule = () => {
    if (!quizScored) return
    onBack?.()
  }

  const renderScene = () => (
    <div className="parts-scene-wrap">
      <ForkliftViewport
        hotspots={hotspots}
        selectedHotspotId={selectedPartId}
        onHotspotSelect={selectPart}
        onResetView={() => setSelectedPartId(null)}
        isAdmin={isAdmin}
      />
    </div>
  )

  const renderExploreTask = () => (
    <div className="parts-task-stack">
      <ScopeNotice note={FORKLIFT_SCOPE_NOTE} />
      <div className="category-grid">
        {categories.map((category) => (
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

  const renderQuizTask = () => (
    <div className="parts-task-stack">
      <Quiz
        scope={{ equipment: 'forklift', context: 'parts' }}
        title="Quiz"
        emptyMessage="No quiz questions have been added for this equipment yet."
        onScored={() => setQuizScored(true)}
      />
      {quizScored && <p className="task-note">Click Complete Module to finish.</p>}
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'quiz') return renderQuizTask()
    return renderExploreTask()
  }

  return (
    <SimulationPageLayout
      className="parts-identification-page"
      title={partsModule.fullTitle}
      subtitle={`${moduleName} Familiarization`}
      onBack={onBack}
    >
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
    </SimulationPageLayout>
  )
}

export default PartsIdentificationPage
