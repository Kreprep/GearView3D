import React, { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
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

function CameraFocus({ targetId, hotspotRefs, controlsRef, resetToken }) {
  const { camera } = useThree()
  const desiredCamPos = useRef(new Vector3())
  const desiredTarget = useRef(new Vector3())
  const framesRemaining = useRef(0)
  const activeId = useRef(null)

  React.useEffect(() => {
    activeId.current = null
  }, [resetToken])

  useFrame(() => {
    const controls = controlsRef.current

    // Clearing the selection must reset this, otherwise re-picking the same
    // hotspot later is treated as "already focused" and the camera won't move.
    if (!targetId) {
      activeId.current = null
    }

    if (controls && targetId && targetId !== activeId.current) {
      const object = hotspotRefs.current.get(targetId)
      if (object) {
        activeId.current = targetId
        object.getWorldPosition(desiredTarget.current)
        const direction = camera.position.clone().sub(controls.target).normalize()
        desiredCamPos.current.copy(desiredTarget.current).add(direction.multiplyScalar(0.5))
        framesRemaining.current = 40
      }
    }

    if (framesRemaining.current > 0 && controls) {
      controls.target.lerp(desiredTarget.current, 0.15)
      camera.position.lerp(desiredCamPos.current, 0.15)
      controls.update()
      framesRemaining.current -= 1
    }
  })

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

function TrainingHotspot({ hotspot, selected, scenario, onSelect, hotspotRefs }) {
  const result = getScenarioResult(hotspot, scenario)

  return (
    <group
      position={hotspot.position}
      ref={(node) => {
        if (node) hotspotRefs.current.set(hotspot.id, node)
        else hotspotRefs.current.delete(hotspot.id)
      }}
    >
      <Html center zIndexRange={[100, 0]} occlude={false}>
        <div className="hotspot-marker-wrap">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(result)
            }}
            className={`hotspot-marker ${result.result === 'unsafe' ? 'unsafe' : ''} ${selected ? 'selected' : ''}`}
            aria-label={hotspot.label}
          />
          <span className="hotspot-marker-tooltip">{hotspot.label}</span>
        </div>
      </Html>
    </group>
  )
}

/** Glowing lamp played on the model while a safety device is being tested. */
function DeviceLamp({ position, color, radius, blink }) {
  const meshRef = useRef(null)
  const lightRef = useRef(null)

  useFrame(({ clock }) => {
    // 5 Hz square-ish flash for blinking devices, steady otherwise.
    const on = blink ? Math.sin(clock.getElapsedTime() * 16) > 0 : true
    const level = on ? 1 : 0.05

    if (meshRef.current) {
      meshRef.current.material.opacity = 0.35 + level * 0.55
      meshRef.current.material.emissiveIntensity = level * 3
    }
    if (lightRef.current) {
      lightRef.current.intensity = level * 1.6
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} transparent toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} color={color} distance={0.7} decay={2} />
    </group>
  )
}

function DeviceEffect({ effect }) {
  if (!effect?.lamps?.length) return null

  return (
    <group>
      {effect.lamps.map((position, index) => (
        <DeviceLamp
          key={`${position.join(',')}-${index}`}
          position={position}
          color={effect.color}
          radius={effect.radius ?? 0.04}
          blink={effect.mode === 'blink'}
        />
      ))}
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
  deviceEffect,
  onHotspotSelect,
  onScenarioAction,
}) {
  const hotspotRefs = useRef(new Map())
  const controlsRef = useRef(null)

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
            <DeviceEffect effect={deviceEffect} />
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
                  hotspotRefs={hotspotRefs}
                />
              ))}
          </group>
        </Center>
      </Bounds>

      <CameraFocus targetId={selectedHotspotId} hotspotRefs={hotspotRefs} controlsRef={controlsRef} resetToken={resetToken} />
      <Grid infiniteGrid cellSize={0.12} sectionSize={0.6} fadeDistance={6} fadeStrength={1.6} position={[0, -0.01, 0]} />
      <ContactShadows position={[0, -0.012, 0]} opacity={0.45} scale={4} blur={2.5} far={2.4} />
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.18} minDistance={cameraPreset.minDistance} maxDistance={cameraPreset.maxDistance} />
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
  selectedHotspotId: controlledHotspotId,
  deviceEffect,
  modelUrl = DEFAULT_MODEL_URL,
  className = '',
}) {
  const containerRef = useRef(null)
  const [resetToken, setResetToken] = useState(0)
  const [showHotspots, setShowHotspots] = useState(true)
  const [internalHotspotId, setInternalHotspotId] = useState(null)
  const cameraPreset = { ...DEFAULT_CAMERA_PRESET, ...(configuredCameraPreset || {}) }
  const hotspots = useMemo(() => filterHotspots(configuredHotspots, activeHotspots), [configuredHotspots, activeHotspots])

  // Selection can be driven from outside (e.g. clicking an inspection card in the
  // task panel) so the camera focuses the same way as clicking the marker.
  const selectedHotspotId = controlledHotspotId !== undefined ? controlledHotspotId : internalHotspotId
  const activeSelectedHotspotId = hotspots.some((hotspot) => hotspot.id === selectedHotspotId) ? selectedHotspotId : null

  const handleHotspotSelect = (hotspot) => {
    setInternalHotspotId(hotspot.id)
    onHotspotSelect?.(hotspot)
  }

  const enterFullscreen = async () => {
    if (!containerRef.current || document.fullscreenElement) return
    // Inside a simulation shell the panels and control bar are siblings of the
    // scene, so fullscreen the whole shell to keep them visible.
    const target = containerRef.current.closest('.simulation-shell') || containerRef.current
    await target.requestFullscreen?.()
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
                deviceEffect={deviceEffect}
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
