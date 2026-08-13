import { useEffect, useState } from 'react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import SimulationPageLayout from './components/SimulationPageLayout'
import ScopeNotice from './components/ScopeNotice'
import { useProgress } from './hooks/useProgress'
import { getEquipment, getEquipmentHotspots } from './lib/api'
import './PartsIdentificationPage.css'

const steps = [
  {
    id: 'explore',
    title: 'Explore Hotspots',
    instructions: 'Tap a marker on the model to see what it is.',
    hint: 'Rotate and zoom the model, then click any marker to open its details.',
  },
]

// The equivalent of PartsIdentificationPage for any equipment other than
// Forklift: a single explore step over that equipment's own EquipmentHotspot
// rows and model - no category filters or practice quiz, since those depend
// on Part/PracticeQuestion, which are still Forklift-only.
function HotspotIdentificationPage({ equipmentId, user, onBack }) {
  const isAdmin = user?.role === 'ADMIN'
  const [equipment, setEquipment] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const { viewPart } = useProgress()

  useEffect(() => {
    let cancelled = false

    Promise.all([getEquipment(), getEquipmentHotspots(equipmentId)]).then(([equipmentRows, hotspotRows]) => {
      if (cancelled) return
      setEquipment(equipmentRows.find((item) => item.id === equipmentId) || null)
      setHotspots(hotspotRows)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  const selected = hotspots.find((hotspot) => hotspot.id === selectedId) || null

  const selectHotspot = (hotspot) => {
    setSelectedId(hotspot.id)
    viewPart(hotspot.id)
  }

  const selectedDetail = selected
    ? { title: selected.label, subtitle: selected.category, description: selected.description }
    : null

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

  const renderTask = () => (
    <div className="parts-task-stack">
      <ScopeNotice />
      <p className="task-note">Tap a marker on the model to view its details.</p>
    </div>
  )

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
            currentStepIndex={0}
            objectives={['Explore this equipment\'s hotspots using the 3D model.']}
            progress={0}
            canProceed
            onBackStep={() => {}}
            onNextStep={onBack}
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
