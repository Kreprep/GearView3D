import { useEffect, useState } from 'react'
import PartsViewport from './components/PartsViewport'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import SimulationPageLayout from './components/SimulationPageLayout'
import ScopeNoticeModal from './components/ScopeNoticeModal'
import Quiz from './components/Quiz'
import { useProgress } from './hooks/useProgress'
import { usePageTitle } from './hooks/usePageTitle'
import { getEquipment, getHotspotCategories, getHotspots, getQuizQuestions } from './lib/api'
import { getPartsProgress } from './lib/progressService'
import { preloadImages } from './lib/imagePreload'
import './PartsIdentificationPage.css'

// Parts Identification for every equipment. It renders that equipment's
// `inParts` hotspots: the category list on the left, the model in the middle,
// and the same detail card the walk-around steps show, since a hotspot carries
// its card with it.
//
// The quiz step only appears once that equipment has `context: 'parts'`
// questions, so an equipment with none keeps the single-step page.

const exploreStep = {
  id: 'explore',
  title: 'Explore by Category',
  instructions: 'Select a part from the categorized list or tap a marker on the model. Viewed parts are saved automatically.',
  hint: 'Not sure where to start? Try tapping a marker directly on the 3D model, or pick a part from a category below.',
}

const quizStep = {
  id: 'quiz',
  title: 'Quiz',
  instructions: 'Answer each question to check part recognition. Results are saved to learner progress.',
  hint: 'Revisit any part you are unsure about in the Explore step before answering.',
}

// A hotspot already carries its own detail card, so this only fills the gaps
// left by a card an admin never wrote.
function buildDetail(hotspot) {
  if (!hotspot) return null
  return {
    title: hotspot.title || hotspot.label,
    subtitle: hotspot.subtitle || hotspot.category,
    image: hotspot.image,
    description: hotspot.description || hotspot.functionText,
  }
}

function PartsIdentificationPage({ equipmentId, user, onBack }) {
  const isAdmin = user?.role === 'ADMIN'
  const [equipment, setEquipment] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const [categories, setCategories] = useState([])
  const [hasQuiz, setHasQuiz] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  usePageTitle(`${equipment?.title || 'Equipment'} Parts Identification`)
  // Set once the learner submits the quiz, which is what unlocks Complete.
  const [quizScored, setQuizScored] = useState(false)
  const [showScopeNotice, setShowScopeNotice] = useState(true)
  const { progress, viewPart } = useProgress()

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getEquipment(),
      getHotspots(equipmentId, 'parts'),
      getHotspotCategories(equipmentId),
      getQuizQuestions({ equipment: equipmentId, context: 'parts' }).catch(() => []),
    ]).then(([equipmentRows, hotspotRows, categoryRows, questions]) => {
      if (cancelled) return
      setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
      setHotspots(hotspotRows)
      preloadImages(hotspotRows.map((hotspot) => hotspot.image))
      setCategories(categoryRows)
      setHasQuiz(questions.length > 0)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  const steps = hasQuiz ? [exploreStep, quizStep] : [exploreStep]
  const hotspotIds = hotspots.map((hotspot) => hotspot.id)
  const viewedIds = new Set(progress.parts.viewedPartIds)
  const viewedCount = hotspotIds.filter((id) => viewedIds.has(id)).length
  const percentage = getPartsProgress(progress, hotspotIds, equipmentId, hasQuiz)

  // Categories the admin defined, plus any a hotspot uses that has no row -
  // otherwise a part whose category was renamed would vanish from the list.
  const usedCategories = [...new Set(hotspots.map((hotspot) => hotspot.category).filter(Boolean))]
  const categoryLabels = [
    ...categories.map((category) => category.label),
    ...usedCategories.filter((label) => !categories.some((category) => category.label === label)),
  ]
  const uncategorised = hotspots.filter((hotspot) => !categoryLabels.includes(hotspot.category))

  const selectPart = (hotspot) => {
    setSelectedPartId(hotspot.id)
    setSelectedDetail(buildDetail(hotspot))
    viewPart(hotspot.id)
  }

  const goToStep = (index) => {
    setCurrentStepIndex(Math.min(Math.max(index, 0), steps.length - 1))
    setSelectedDetail(null)
  }

  const completeModule = () => {
    if (hasQuiz && !quizScored) return
    onBack?.()
  }

  const renderScene = () => (
    <div className="parts-scene-wrap">
      <PartsViewport
        modelUrl={equipment?.modelUrl}
        modelScale={equipment?.modelScale}
        modelOffsetY={equipment?.modelOffsetY}
        hotspots={hotspots}
        selectedHotspotId={selectedPartId}
        onHotspotSelect={selectPart}
        onResetView={() => setSelectedPartId(null)}
        isAdmin={isAdmin}
      />
    </div>
  )

  const renderPartButton = (hotspot) => (
    <button
      key={hotspot.id}
      type="button"
      className={selectedPartId === hotspot.id ? 'part-list-button active' : 'part-list-button'}
      onClick={() => selectPart(hotspot)}
    >
      <span>{hotspot.label}</span>
      <small>{viewedIds.has(hotspot.id) ? 'Viewed' : 'Not viewed'}</small>
    </button>
  )

  const renderExploreTask = () => (
    <div className="parts-task-stack">
      <div className="category-grid">
        {categoryLabels.map((label) => {
          const inCategory = hotspots.filter((hotspot) => hotspot.category === label)
          if (inCategory.length === 0) return null
          return (
            <div key={label} className="category-group">
              <h4>{label}</h4>
              {inCategory.map(renderPartButton)}
            </div>
          )
        })}
        {uncategorised.length > 0 && (
          <div className="category-group">
            <h4>{categoryLabels.length ? 'Other' : 'Parts'}</h4>
            {uncategorised.map(renderPartButton)}
          </div>
        )}
      </div>
      <p className="task-note">{viewedCount} of {hotspots.length} parts viewed.</p>
    </div>
  )

  const renderQuizTask = () => (
    <div className="parts-task-stack">
      <Quiz
        scope={{ equipment: equipmentId, context: 'parts' }}
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
    <>
      {showScopeNotice && (
        <ScopeNoticeModal equipmentId={equipmentId} onDismiss={() => setShowScopeNotice(false)} />
      )}
      <SimulationPageLayout
        className="parts-identification-page"
        compact
        title="Parts Identification"
        subtitle={`${equipment?.title || 'Equipment'} Familiarization`}
        onBack={onBack}
      >
        {loading ? (
          <p>Loading parts...</p>
        ) : (
          <ModuleSimulationShell
            module={{ fullTitle: 'Parts Identification', title: 'Parts Identification' }}
            steps={steps}
            currentStepIndex={currentStepIndex}
            objectives={[
              `Explore major ${equipment?.title || 'equipment'} parts using the 3D model and the category list.`,
              'View every part at least once to track exploration progress.',
              ...(hasQuiz ? ['Answer the quiz questions to check part recognition.'] : []),
            ]}
            progress={percentage}
            canProceed
            onSelectStep={goToStep}
            onBackStep={() => goToStep(currentStepIndex - 1)}
            onNextStep={() => (currentStepIndex + 1 < steps.length ? goToStep(currentStepIndex + 1) : onBack())}
            onComplete={completeModule}
            renderScene={renderScene}
            renderTask={renderTask}
            selectedDetail={selectedDetail}
            onClearDetail={() => setSelectedDetail(null)}
          />
        )}
      </SimulationPageLayout>
    </>
  )
}

export default PartsIdentificationPage
