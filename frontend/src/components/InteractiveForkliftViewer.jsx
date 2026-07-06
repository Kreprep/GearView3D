import React, { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Bounds,
  Center,
  ContactShadows,
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
import { Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BadgeInfo, Eye, Maximize, RotateCcw } from 'lucide-react'
import './InteractiveForkliftViewer.css'

const DEFAULT_MODEL_URL = '/models/Forklift_SEPERATED.glb'
const DEFAULT_CAMERA_PRESET = {
  position: [2.2, 1.35, 2.45],
  fov: 42,
  minDistance: 0.65,
  maxDistance: 5.5,
}

function getScenarioResult(hotspot, scenario) {
  const unsafe = (hotspot.unsafeScenarios || []).includes(scenario)

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
      <p>Confirm the configured GLB model path resolves correctly.</p>
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
      object.frustumCulled = false

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const cloned = materials.map((material) => {
        const next = material.clone()
        next.roughness = Math.max(next.roughness ?? 0.55, 0.45)
        next.metalness = Math.min(next.metalness ?? 0.2, 0.35)
        next.needsUpdate = true
        return next
      })

      object.material = Array.isArray(object.material) ? cloned : cloned[0]
    })
  }, [forklift])

  return <primitive object={forklift} />
}

function TrainingHotspot({ hotspot, selected, scenario, onSelect, onProject }) {
  const ringMaterialRef = useRef(null)
  const anchorRef = useRef(null)
  const vectorRef = useRef(new Vector3())
  const result = getScenarioResult(hotspot, scenario)

  useFrame(({ clock, camera, size }) => {
    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = selected ? 0.65 + Math.sin(clock.elapsedTime * 4) * 0.25 : 0.9
    }

    if (!anchorRef.current) return
    const projected = vectorRef.current
    anchorRef.current.getWorldPosition(projected)
    projected.project(camera)
    const visible = projected.z > -1 && projected.z < 1
    onProject(hotspot.id, {
      x: (projected.x * 0.5 + 0.5) * size.width,
      y: (-projected.y * 0.5 + 0.5) * size.height,
      visible,
      hotspot: result,
    })
  })

  return (
    <group ref={anchorRef} position={hotspot.position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect(result)
        }}
      >
        <ringGeometry args={[0.02, 0.052, 32]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={result.result === 'unsafe' ? '#f97316' : '#67e8f9'}
          transparent
          opacity={0.9}
        />
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
    </group>
  )
}

function PuddleOverlay({ id, position, rotation, radius, label, feedback, onScenarioAction }) {
  const emit = () => onScenarioAction?.({ id, type: 'defect', feedback })

  return (
    <group>
      <mesh position={position} rotation={rotation} onClick={(event) => { event.stopPropagation(); emit() }}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color="#111111" transparent opacity={0.72} />
      </mesh>
      <Html center position={[position[0], position[1] + 0.056, position[2]]} distanceFactor={2.4}>
        <button type="button" className="viewer-warning-label" onClick={emit}>
          {label}
        </button>
      </Html>
    </group>
  )
}

function MarkerOverlay({ id, position, label, feedback, onScenarioAction }) {
  const emit = () => onScenarioAction?.({ id, type: 'defect', feedback })

  return (
    <Html center position={position} distanceFactor={2.4}>
      <button type="button" className="viewer-tire-warning" onClick={emit}>
        <strong>!</strong>
        <span>{label}</span>
      </button>
    </Html>
  )
}

function ScenarioBadge({ mode, scenario }) {
  const label = {
    'good-forklift': 'Good forklift',
    'oil-leak': 'Oil leak defect',
    'flat-tire': 'Flat or worn tire',
    'mast-crack': 'Mast crack defect',
    'loose-bolt': 'Loose bolt defect',
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
  defectOverlays,
  selectedHotspotId,
  resetToken,
  showHotspots,
  cameraPreset,
  onHotspotSelect,
  onScenarioAction,
  onHotspotProject,
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPreset.position} fov={cameraPreset.fov} />
      <ambientLight intensity={1.2} />
      <hemisphereLight args={['#f8fafc', '#1e293b', 1.25]} />
      <directionalLight castShadow position={[2.2, 3, 1.8]} intensity={2.8} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-2.4, 1.8, -2]} intensity={1.2} />

      <Bounds fit clip margin={1.25}>
        <AutoFit resetToken={resetToken} />
        <Center top>
          <group rotation={[0, -0.18, 0]}>
            <ForkliftModel modelUrl={modelUrl} />
            {defectOverlays
              .filter((overlay) => overlay.scenario === scenario)
              .map((overlay) =>
                overlay.type === 'puddle' ? (
                  <PuddleOverlay key={overlay.id} {...overlay} onScenarioAction={onScenarioAction} />
                ) : (
                  <MarkerOverlay key={overlay.id} {...overlay} onScenarioAction={onScenarioAction} />
                ),
              )}
            {showHotspots &&
              hotspots.map((hotspot) => (
                <TrainingHotspot
                  key={hotspot.id}
                  hotspot={hotspot}
                  scenario={scenario}
                  selected={selectedHotspotId === hotspot.id}
                  onSelect={onHotspotSelect}
                  onProject={onHotspotProject}
                />
              ))}
          </group>
        </Center>
      </Bounds>

      <Grid infiniteGrid cellSize={0.12} sectionSize={0.6} fadeDistance={6} fadeStrength={1.6} position={[0, -0.01, 0]} />
      <ContactShadows position={[0, -0.012, 0]} opacity={0.45} scale={4} blur={2.5} far={2.4} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.18} minDistance={cameraPreset.minDistance} maxDistance={cameraPreset.maxDistance} />
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

function filterHotspots(hotspots, activeHotspots) {
  if (!activeHotspots) {
    return hotspots
  }

  const active = new Set(activeHotspots)
  return hotspots.filter((hotspot) => active.has(hotspot.id))
}

export default function InteractiveForkliftViewer({
  mode = 'inspection',
  scenario = 'good-forklift',
  activeHotspots,
  hotspots: configuredHotspots = [],
  defectOverlays = [],
  cameraPreset: configuredCameraPreset,
  onHotspotSelect,
  onScenarioAction,
  modelUrl = DEFAULT_MODEL_URL,
  className = '',
}) {
  const containerRef = useRef(null)
  const [resetToken, setResetToken] = useState(0)
  const [showHotspots, setShowHotspots] = useState(true)
  const [selectedHotspotId, setSelectedHotspotId] = useState(null)
  const [screenHotspots, setScreenHotspots] = useState({})
  const cameraPreset = { ...DEFAULT_CAMERA_PRESET, ...(configuredCameraPreset || {}) }
  const hotspots = useMemo(() => filterHotspots(configuredHotspots, activeHotspots), [configuredHotspots, activeHotspots])

  const activeSelectedHotspotId = hotspots.some((hotspot) => hotspot.id === selectedHotspotId) ? selectedHotspotId : null

  const handleHotspotSelect = (hotspot) => {
    setSelectedHotspotId(hotspot.id)
    onHotspotSelect?.(hotspot)
  }

  const handleHotspotProject = (id, next) => {
    setScreenHotspots((current) => {
      const previous = current[id]
      if (
        previous &&
        Math.abs(previous.x - next.x) < 0.5 &&
        Math.abs(previous.y - next.y) < 0.5 &&
        previous.visible === next.visible &&
        previous.hotspot.result === next.hotspot.result
      ) {
        return current
      }

      return { ...current, [id]: next }
    })
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
          <Canvas shadows dpr={[1, 1.35]} camera={{ position: cameraPreset.position, fov: cameraPreset.fov }}>
            <Suspense fallback={<LoadingPanel />}>
              <InteractiveScene
                modelUrl={modelUrl}
                scenario={scenario}
                hotspots={hotspots}
                defectOverlays={defectOverlays}
                selectedHotspotId={activeSelectedHotspotId}
                resetToken={resetToken}
                showHotspots={showHotspots}
                cameraPreset={cameraPreset}
                onHotspotSelect={handleHotspotSelect}
                onScenarioAction={onScenarioAction}
                onHotspotProject={handleHotspotProject}
              />
            </Suspense>
          </Canvas>
        </InteractiveViewerErrorBoundary>
        <Loader />

        {showHotspots && (
          <div className="viewer-hotspot-overlay" aria-label="Projected forklift hotspot labels">
            {hotspots.map((hotspot) => {
              const projected = screenHotspots[hotspot.id]
              if (!projected?.visible) return null

              return (
                <button
                  key={hotspot.id}
                  type="button"
                  className={`viewer-hotspot-label ${activeSelectedHotspotId === hotspot.id ? 'selected' : ''} ${projected.hotspot.result}`}
                  style={{ transform: `translate(${projected.x}px, ${projected.y}px) translate(-50%, -50%)` }}
                  onClick={() => handleHotspotSelect(projected.hotspot)}
                >
                  {hotspot.label}
                </button>
              )
            })}
          </div>
        )}

        <div className="interactive-viewer-help">
          Drag to rotate - Scroll to zoom - Right-drag to pan
        </div>
      </div>
    </section>
  )
}

useGLTF.preload(DEFAULT_MODEL_URL)
