import React, { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Bounds,
  Center,
  ContactShadows,
  Environment,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
  Loader,
  OrbitControls,
  PerspectiveCamera,
  useBounds,
  useGLTF,
} from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BadgeInfo, Eye, Maximize, RotateCcw } from 'lucide-react'
import './InteractiveForkliftViewer.css'

const DEFAULT_MODEL_URL = '/models/Forklift_SEPERATED.glb'

const inspectionHotspots = [
  {
    id: 'underside-fluid-leaks',
    label: 'Underside / Fluid Leaks',
    position: [0, 0.05, -0.08],
    inspect: 'Look under the forklift for engine oil, hydraulic oil, coolant, or battery electrolyte leaks.',
    safeFeedback: 'No visible leak is shown. Continue the inspection.',
    unsafeFeedback: 'Fluid leak detected. Forklift is unsafe for operation.',
    unsafeScenarios: ['oil-leak'],
  },
  {
    id: 'engine-bay',
    label: 'Engine Bay',
    position: [-0.12, 0.32, -0.12],
    inspect: 'Check oil, coolant, and visible engine-area condition.',
    safeFeedback: 'Engine bay check is clear in this scenario.',
    unsafeFeedback: 'Engine bay concern detected. Report before operation.',
    unsafeScenarios: ['oil-leak'],
  },
  {
    id: 'battery-area',
    label: 'Battery Area',
    position: [0.14, 0.34, -0.05],
    inspect: 'Check for electrolyte leakage, corrosion, or unsafe battery condition.',
    safeFeedback: 'Battery area appears safe in this scenario.',
    unsafeFeedback: 'Battery area concern detected. Do not use until cleared.',
    unsafeScenarios: ['oil-leak'],
  },
  {
    id: 'tires',
    label: 'Tires',
    position: [0.12, 0.08, 0.19],
    inspect: 'Check tire wear, damage, inflation issues, and unsafe tire condition.',
    safeFeedback: 'Tire condition appears acceptable in this scenario.',
    unsafeFeedback: 'Unsafe tire condition affects steering and stability.',
    unsafeScenarios: ['flat-tire'],
  },
  {
    id: 'mast-assembly',
    label: 'Mast Assembly',
    position: [0, 0.44, 0.25],
    inspect: 'Inspect mast channels, lift chain path, and visible cracks or damage.',
    safeFeedback: 'No visible mast defect is shown.',
    unsafeFeedback: 'Mast damage should be reported before operation.',
    unsafeScenarios: [],
  },
  {
    id: 'forks',
    label: 'Forks',
    position: [0, 0.08, 0.58],
    inspect: 'Check fork tips, heels, locking pins, and visible cracks.',
    safeFeedback: 'Forks appear usable in this scenario.',
    unsafeFeedback: 'Fork damage should be reported before load handling.',
    unsafeScenarios: [],
  },
  {
    id: 'carriage',
    label: 'Carriage',
    position: [0, 0.13, 0.42],
    inspect: 'Check fork attachment points and carriage condition.',
    safeFeedback: 'Carriage attachment appears normal in this scenario.',
    unsafeFeedback: 'Carriage damage can make load handling unsafe.',
    unsafeScenarios: [],
  },
  {
    id: 'structural-bolts',
    label: 'Structural Bolts',
    position: [0, 0.68, -0.02],
    inspect: 'Look for loose, missing, or visibly unsafe structural bolts.',
    safeFeedback: 'No loose or missing structural bolt is shown.',
    unsafeFeedback: 'Loose or missing structural bolts must be reported.',
    unsafeScenarios: [],
  },
  {
    id: 'operator-area',
    label: 'Operator Area',
    position: [0, 0.34, -0.04],
    inspect: 'Check seat, dashboard visibility, and control area condition.',
    safeFeedback: 'Operator area appears ready for engine-on checks.',
    unsafeFeedback: 'Operator area issue detected. Report before operation.',
    unsafeScenarios: [],
  },
  {
    id: 'warning-devices',
    label: 'Warning Devices',
    position: [0, 0.66, -0.08],
    inspect: 'Check horn, lights, warning beacon, and backup alarm during engine-on inspection.',
    safeFeedback: 'Warning-device area is ready for functional tests.',
    unsafeFeedback: 'Warning device failure should stop operation until reported.',
    unsafeScenarios: [],
  },
]

function getScenarioResult(hotspot, scenario) {
  const unsafe = hotspot.unsafeScenarios.includes(scenario)

  return {
    ...hotspot,
    result: unsafe ? 'unsafe' : 'safe',
    feedback: unsafe ? hotspot.unsafeFeedback : hotspot.safeFeedback,
  }
}

class InteractiveViewerErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="interactive-viewer-error">
          <BadgeInfo />
          <h3>Forklift model could not be loaded</h3>
          <p>Confirm the GLB exists at /models/Forklift_SEPERATED.glb.</p>
        </div>
      )
    }

    return this.props.children
  }
}

function AutoFit({ resetToken }) {
  const bounds = useBounds()

  React.useEffect(() => {
    bounds.refresh().fit()
  }, [bounds, resetToken])

  return null
}

function ForkliftModel({ modelUrl }) {
  const { scene } = useGLTF(modelUrl)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])

  React.useEffect(() => {
    forklift.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
  }, [forklift])

  return <primitive object={forklift} />
}

function TrainingHotspot({ hotspot, selected, scenario, onSelect }) {
  const pulseRef = useRef(null)
  const result = getScenarioResult(hotspot, scenario)

  useFrame(({ clock }) => {
    if (!pulseRef.current) return
    const pulse = selected ? 1.16 + Math.sin(clock.elapsedTime * 4) * 0.05 : 1
    pulseRef.current.scale.setScalar(pulse)
  })

  return (
    <group position={hotspot.position}>
      <mesh
        ref={pulseRef}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(result)
        }}
      >
        <ringGeometry args={[0.02, 0.052, 32]} />
        <meshBasicMaterial color={result.result === 'unsafe' ? '#f97316' : '#67e8f9'} transparent opacity={0.9} />
      </mesh>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect(result)
        }}
      >
        <sphereGeometry args={[0.023, 16, 16]} />
        <meshStandardMaterial
          color={selected ? '#22d3ee' : '#ffffff'}
          emissive={result.result === 'unsafe' ? '#dc2626' : '#0891b2'}
          emissiveIntensity={selected ? 0.65 : 0.28}
          roughness={0.35}
        />
      </mesh>
      <Html center distanceFactor={7} position={[0, 0.065, 0]}>
        <button
          type="button"
          className={`viewer-hotspot-label ${selected ? 'selected' : ''} ${result.result}`}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(result)
          }}
        >
          {hotspot.label}
        </button>
      </Html>
    </group>
  )
}

function OilLeakOverlay({ onScenarioAction }) {
  return (
    <group>
      <mesh
        position={[0, 0.004, -0.1]}
        rotation={[-Math.PI / 2, 0, 0.18]}
        onClick={(event) => {
          event.stopPropagation()
          onScenarioAction?.({
            id: 'oil-leak',
            type: 'defect',
            feedback: 'Fluid leak detected. Forklift is unsafe for operation.',
          })
        }}
      >
        <circleGeometry args={[0.19, 48]} />
        <meshBasicMaterial color="#111111" transparent opacity={0.72} />
      </mesh>
      <Html center position={[0, 0.06, -0.1]} distanceFactor={5.6}>
        <button
          type="button"
          className="viewer-warning-label"
          onClick={() =>
            onScenarioAction?.({
              id: 'oil-leak',
              type: 'defect',
              feedback: 'Fluid leak detected. Forklift is unsafe for operation.',
            })
          }
        >
          Fluid leak detected
        </button>
      </Html>
    </group>
  )
}

function FlatTireMarker({ onScenarioAction }) {
  return (
    <Html center position={[0.16, 0.16, 0.2]} distanceFactor={5.6}>
      <button
        type="button"
        className="viewer-tire-warning"
        onClick={() =>
          onScenarioAction?.({
            id: 'flat-tire',
            type: 'defect',
            feedback: 'Unsafe tire condition affects steering and stability.',
          })
        }
      >
        <strong>!</strong>
        <span>Unsafe tire condition</span>
      </button>
    </Html>
  )
}

function ScenarioBadge({ mode, scenario }) {
  const label = {
    'good-forklift': 'Good forklift',
    'oil-leak': 'Oil leak defect',
    'flat-tire': 'Flat or worn tire',
    'engine-off': 'Engine-off inspection',
    'engine-on': 'Engine-on checks',
    stability: 'Stability demo',
    parking: 'Parking verification',
  }[scenario] || scenario

  return (
    <div className="viewer-scenario-badge">
      <span>{mode}</span>
      <strong>{label}</strong>
    </div>
  )
}

function InteractiveScene({
  modelUrl,
  scenario,
  hotspots,
  selectedHotspotId,
  resetToken,
  showHotspots,
  onHotspotSelect,
  onScenarioAction,
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[1.25, 0.85, 1.55]} fov={42} />
      <ambientLight intensity={0.78} />
      <directionalLight castShadow position={[2.2, 3, 1.8]} intensity={2.4} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Environment preset="warehouse" />

      <Bounds fit clip observe margin={1.25}>
        <AutoFit resetToken={resetToken} />
        <Center top>
          <group rotation={[0, -0.18, 0]}>
            <ForkliftModel modelUrl={modelUrl} />
            {scenario === 'oil-leak' && <OilLeakOverlay onScenarioAction={onScenarioAction} />}
            {scenario === 'flat-tire' && <FlatTireMarker onScenarioAction={onScenarioAction} />}
            {showHotspots &&
              hotspots.map((hotspot) => (
                <TrainingHotspot
                  key={hotspot.id}
                  hotspot={hotspot}
                  scenario={scenario}
                  selected={selectedHotspotId === hotspot.id}
                  onSelect={onHotspotSelect}
                />
              ))}
          </group>
        </Center>
      </Bounds>

      <Grid infiniteGrid cellSize={0.12} sectionSize={0.6} fadeDistance={6} fadeStrength={1.6} position={[0, -0.01, 0]} />
      <ContactShadows position={[0, -0.012, 0]} opacity={0.45} scale={4} blur={2.5} far={2.4} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.55} maxDistance={4} />
      <GizmoHelper alignment="bottom-right" margin={[84, 84]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#f8fafc" />
      </GizmoHelper>
    </>
  )
}

function LoadingPanel() {
  return (
    <Html center>
      <div className="interactive-loading-panel">
        <div />
        <p>Loading forklift training view</p>
      </div>
    </Html>
  )
}

function filterHotspots(activeHotspots) {
  if (!activeHotspots || activeHotspots.length === 0) {
    return inspectionHotspots
  }

  const active = new Set(activeHotspots)
  return inspectionHotspots.filter((hotspot) => active.has(hotspot.id))
}

export default function InteractiveForkliftViewer({
  mode = 'inspection',
  scenario = 'good-forklift',
  activeHotspots,
  onHotspotSelect,
  onScenarioAction,
  modelUrl = DEFAULT_MODEL_URL,
  className = '',
}) {
  const containerRef = useRef(null)
  const [resetToken, setResetToken] = useState(0)
  const [showHotspots, setShowHotspots] = useState(true)
  const [selectedHotspotId, setSelectedHotspotId] = useState(null)
  const hotspots = useMemo(() => filterHotspots(activeHotspots), [activeHotspots])

  const handleHotspotSelect = (hotspot) => {
    setSelectedHotspotId(hotspot.id)
    onHotspotSelect?.(hotspot)
  }

  const enterFullscreen = async () => {
    if (!containerRef.current || document.fullscreenElement) return
    await containerRef.current.requestFullscreen?.()
  }

  return (
    <section className={`interactive-forklift-viewer ${className}`}>
      <div ref={containerRef} className="interactive-viewer-canvas-shell">
        <div className="interactive-viewer-toolbar">
          <button type="button" onClick={() => setResetToken((value) => value + 1)}>
            <RotateCcw size={16} /> Reset
          </button>
          <button type="button" onClick={() => setShowHotspots((value) => !value)}>
            <Eye size={16} /> {showHotspots ? 'Hide' : 'Show'} hotspots
          </button>
          <button type="button" onClick={enterFullscreen}>
            <Maximize size={16} /> Fullscreen
          </button>
        </div>

        <ScenarioBadge mode={mode} scenario={scenario} />

        <InteractiveViewerErrorBoundary>
          <Canvas shadows dpr={[1, 1.35]} camera={{ position: [1.25, 0.85, 1.55], fov: 42 }}>
            <Suspense fallback={<LoadingPanel />}>
              <InteractiveScene
                modelUrl={modelUrl}
                scenario={scenario}
                hotspots={hotspots}
                selectedHotspotId={selectedHotspotId}
                resetToken={resetToken}
                showHotspots={showHotspots}
                onHotspotSelect={handleHotspotSelect}
                onScenarioAction={onScenarioAction}
              />
            </Suspense>
          </Canvas>
        </InteractiveViewerErrorBoundary>
        <Loader />

        <div className="interactive-viewer-help">
          Drag to rotate - Scroll to zoom - Right-drag to pan
        </div>
      </div>
    </section>
  )
}

useGLTF.preload(DEFAULT_MODEL_URL)
