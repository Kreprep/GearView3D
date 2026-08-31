import { useEffect, useState } from 'react'
import PartsViewport from './components/PartsViewport'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import SimulationPageLayout from './components/SimulationPageLayout'
import ScopeNoticeModal from './components/ScopeNoticeModal'
import Quiz from './components/Quiz'
import { useProgress } from './hooks/useProgress'
import { usePageTitle } from './hooks/usePageTitle'
import { useT } from './i18n'
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

// Key records rather than sentences, resolved in the component where there is
// a `t` to resolve them with - the shell wants a plain { title, instructions,
// hint } step, so the mapping happens once at the call site.
const EXPLORE_STEP_KEYS = {
  id: 'explore',
  title: 'parts.step.explore.title',
  instructions: 'parts.step.explore.instructions',
  hint: 'parts.step.explore.hint',
}

const QUIZ_STEP_KEYS = {
  id: 'quiz',
  title: 'parts.step.quiz.title',
  instructions: 'parts.step.quiz.instructions',
  hint: 'parts.step.quiz.hint',
}

function resolveStep(keys, t) {
  return {
    id: keys.id,
    title: t(keys.title),
    instructions: t(keys.instructions),
    hint: t(keys.hint),
  }
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
  const t = useT()
  const isAdmin = user?.role === 'ADMIN'
  const [equipment, setEquipment] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const [categories, setCategories] = useState([])
  const [hasQuiz, setHasQuiz] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const equipmentTitle = equipment?.title || 'Equipment'
  usePageTitle(t('parts.pageTitle', { equipment: equipmentTitle }))
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

  const exploreStep = resolveStep(EXPLORE_STEP_KEYS, t)
  const steps = hasQuiz ? [exploreStep, resolveStep(QUIZ_STEP_KEYS, t)] : [exploreStep]
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
      <small>{t(viewedIds.has(hotspot.id) ? 'parts.viewed' : 'parts.notViewed')}</small>
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
        title={t('parts.step.quiz.title')}
        emptyMessage={t('quiz.empty.parts')}
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
        title={t('parts.title')}
        subtitle={t('parts.subtitle', { equipment: equipmentTitle })}
        onBack={onBack}
      >
        {loading ? (
          <p>{t('parts.loading')}</p>
        ) : (
          <ModuleSimulationShell
            module={{ fullTitle: t('parts.title'), title: t('parts.title') }}
            steps={steps}
            currentStepIndex={currentStepIndex}
            objectives={[
              t('parts.objective.explore', { equipment: equipmentTitle }),
              t('parts.objective.viewAll'),
              ...(hasQuiz ? [t('parts.objective.quiz')] : []),
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
