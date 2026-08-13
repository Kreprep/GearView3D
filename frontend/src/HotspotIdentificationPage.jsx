import { useEffect, useState } from 'react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import SimulationPageLayout from './components/SimulationPageLayout'
import ScopeNotice from './components/ScopeNotice'
import Quiz from './components/Quiz'
import { useProgress } from './hooks/useProgress'
import { getEquipment, getEquipmentHotspots, getQuizQuestions } from './lib/api'
import { getGenericPartsProgress } from './lib/progressService'
import './PartsIdentificationPage.css'

const exploreStep = {
  id: 'explore',
  title: 'Explore Hotspots',
  instructions: 'Tap a marker on the model to see what it is.',
  hint: 'Rotate and zoom the model, then click any marker to open its details.',
}

const quizStep = {
  id: 'quiz',
  title: 'Quiz',
  instructions: 'Answer each question to check part recognition. Results are saved to learner progress.',
  hint: 'Revisit any hotspot you are unsure about in the Explore step before answering.',
}

// The equivalent of PartsIdentificationPage for any equipment other than
// Forklift: an explore step over that equipment's own EquipmentHotspot rows and
// model, plus the same parts quiz once an admin has added questions for it.
// What still separates the two pages is Forklift's category filters and its
// richer Part/PartDetail rows.
function HotspotIdentificationPage({ equipmentId, user, onBack }) {
  const isAdmin = user?.role === 'ADMIN'
  const [equipment, setEquipment] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const [hasQuiz, setHasQuiz] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const { progress, viewPart } = useProgress()

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getEquipment(),
      getEquipmentHotspots(equipmentId),
      getQuizQuestions({ equipment: equipmentId, context: 'parts' }).catch(() => []),
    ]).then(([equipmentRows, hotspotRows, questions]) => {
      if (cancelled) return
      setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
      setHotspots(hotspotRows)
      setHasQuiz(questions.length > 0)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  // The quiz step only exists once this equipment has questions, so an
  // equipment without them keeps the single-step page it had before.
  const steps = hasQuiz ? [exploreStep, quizStep] : [exploreStep]
  const selected = hotspots.find((hotspot) => hotspot.id === selectedId) || null
  const hotspotIds = hotspots.map((hotspot) => hotspot.id)
  const percentage = getGenericPartsProgress(progress, hotspotIds, equipmentId, hasQuiz)

  const selectHotspot = (hotspot) => {
    setSelectedId(hotspot.id)
    viewPart(hotspot.id)
  }

  const selectedDetail = selected
    ? { title: selected.label, subtitle: selected.category, description: selected.description }
    : null

  const goToStep = (index) => {
    setCurrentStepIndex(Math.min(Math.max(index, 0), steps.length - 1))
    setSelectedId(null)
  }

  const renderScene = () => (
    <div className="parts-scene-wrap">
      <ForkliftViewport
        modelUrl={equipment?.modelUrl}
        hotspots={hotspots}
        selectedHotspotId={selectedId}
        onHotspotSelect={selectHotspot}
        onResetView={() => setSelectedId(null)}
        isAdmin={isAdmin}
      />
    </div>
  )

  const renderTask = ({ currentStep }) => {
    if (currentStep.id === 'quiz') {
      return (
        <div className="parts-task-stack">
          <Quiz
            scope={{ equipment: equipmentId, context: 'parts' }}
            title="Quiz"
            emptyMessage="No quiz questions have been added for this equipment yet."
          />
        </div>
      )
    }

    return (
      <div className="parts-task-stack">
        <ScopeNotice />
        <p className="task-note">Tap a marker on the model to view its details.</p>
        <p className="task-note">{hotspotIds.filter((id) => progress.parts.viewedPartIds.includes(id)).length} of {hotspots.length} hotspots viewed.</p>
      </div>
    )
  }

  return (
    <SimulationPageLayout
      className="parts-identification-page"
      title="Hotspot Identification"
      subtitle={`${equipment?.title || 'Equipment'} Familiarization`}
      onBack={onBack}
    >
      {loading ? (
          <p className="admin-panel-note">Loading hotspots...</p>
        ) : (
          <ModuleSimulationShell
            module={{ fullTitle: 'Hotspot Identification', title: 'Hotspot Identification' }}
            steps={steps}
            currentStepIndex={currentStepIndex}
            objectives={[
              'Explore this equipment\'s hotspots using the 3D model.',
              ...(hasQuiz ? ['Answer the quiz questions to check part recognition.'] : []),
            ]}
            progress={percentage}
            canProceed
            onBackStep={() => goToStep(currentStepIndex - 1)}
            onNextStep={() => (currentStepIndex + 1 < steps.length ? goToStep(currentStepIndex + 1) : onBack())}
            onComplete={onBack}
            renderScene={renderScene}
            renderTask={renderTask}
            selectedDetail={selectedDetail}
            onClearDetail={() => setSelectedId(null)}
          />
        )}
    </SimulationPageLayout>
  )
}

export default HotspotIdentificationPage
