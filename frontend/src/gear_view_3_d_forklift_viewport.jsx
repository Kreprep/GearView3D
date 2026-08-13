import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import { BadgeInfo, Compass, Eye, Maximize, RotateCcw, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { partsHotspots } from './lib/trainingData'

const DEFAULT_MODEL_URL = '/models/forklift.glb'

class ViewportErrorBoundary extends React.Component {
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
        <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-dashed bg-slate-950 p-8 text-center text-slate-100">
          <div className="max-w-md space-y-3">
            <BadgeInfo className="mx-auto h-8 w-8" />
            <h3 className="text-xl font-semibold">3D model could not be loaded</h3>
            <p className="text-sm text-slate-300">
              Confirm the GLB is available at{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5">{this.props.modelUrl || DEFAULT_MODEL_URL}</code>.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function AutoFit({ resetToken }) {
  const bounds = useBounds()

  useEffect(() => {
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

  useEffect(() => {
    activeId.current = null
  }, [resetToken])

  useFrame(() => {
    const controls = controlsRef.current

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

function ForkliftModel({ modelUrl, wireframe }) {
  const { scene } = useGLTF(modelUrl)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])

  useEffect(() => {
    forklift.traverse((object) => {
      if (!object.isMesh) return

      object.castShadow = true
      object.receiveShadow = true

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const cloned = materials.map((material) => {
        const next = material.clone()
        next.wireframe = wireframe
        next.roughness = Math.max(next.roughness ?? 0.55, 0.45)
        return next
      })

      object.material = Array.isArray(object.material) ? cloned : cloned[0]
    })
  }, [forklift, wireframe])

  return <primitive object={forklift} />
}

function HotspotPin({ hotspot, selected, onSelect, hotspotRefs }) {
  return (
    <group
      position={hotspot.position}
      ref={(node) => {
        if (node) hotspotRefs.current.set(hotspot.id, node)
        else hotspotRefs.current.delete(hotspot.id)
      }}
    >
      <Html center zIndexRange={[100, 0]} occlude={false}>
        <div className="group relative flex items-center justify-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(hotspot)
            }}
            className={`block h-4 w-4 rounded-full border-2 transition-transform ${
              selected
                ? 'scale-125 animate-pulse border-cyan-300 bg-cyan-400 shadow-[0_0_10px_3px_rgba(34,211,238,0.7)]'
                : 'border-white/80 bg-white/90 hover:scale-110'
            }`}
            aria-label={hotspot.label}
          />
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
            {hotspot.label}
          </span>
        </div>
      </Html>
    </group>
  )
}

function FallbackForkliftScene({ freeCam }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[1.3, 1.1, 1.8]} fov={42} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />
      <group rotation={[0, -0.18, 0]}>
        <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.88, 0.16, 0.78]} />
          <meshStandardMaterial color="#22d3ee" metalness={0.15} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.45, 0.2]} castShadow receiveShadow>
          <boxGeometry args={[0.55, 0.42, 0.2]} />
          <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.45, -0.28]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.16, 0.18]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.2} roughness={0.35} />
        </mesh>
        <mesh position={[-0.45, 0.12, 0.55]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.12, 1.1]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.25} roughness={0.35} />
        </mesh>
        <mesh position={[0.45, 0.12, 0.55]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.12, 1.1]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.25} roughness={0.35} />
        </mesh>
      </group>
      <Grid infiniteGrid cellSize={0.12} sectionSize={0.6} fadeDistance={6} fadeStrength={1.4} position={[0, -0.02, 0]} />
      <ContactShadows position={[0, -0.02, 0]} opacity={0.45} scale={4} blur={2.5} far={2.4} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.18}
        minDistance={freeCam ? 0.05 : 0.75}
        maxDistance={freeCam ? 50 : 4.2}
        maxPolarAngle={freeCam ? Math.PI : Math.PI / 2}
      />
    </>
  )
}

function ForkliftScene({
  modelUrl,
  hotspots,
  overlaysEnabled,
  selectedId,
  onSelectHotspot,
  resetToken,
  wireframe,
  freeCam,
}) {
  const hotspotRefs = useRef(new Map())
  const controlsRef = useRef(null)

  return (
    <>
      <PerspectiveCamera makeDefault position={[1.25, 0.85, 1.55]} fov={42} />
      <ambientLight intensity={1.05} />
      <hemisphereLight args={['#f8fafc', '#1e293b', 1.05]} />
      <directionalLight castShadow position={[2.2, 3, 1.8]} intensity={2.4} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-2.4, 1.8, -2]} intensity={1} />

      <Bounds fit clip margin={1.25}>
        <AutoFit resetToken={resetToken} />
        <Center position={[0, 0, 0]} top>
          <group rotation={[0, -0.18, 0]}>
            <ForkliftModel modelUrl={modelUrl} wireframe={wireframe} />
            {overlaysEnabled &&
              hotspots.map((hotspot) => (
                <HotspotPin
                  key={hotspot.id}
                  hotspot={hotspot}
                  selected={selectedId === hotspot.id}
                  onSelect={onSelectHotspot}
                  hotspotRefs={hotspotRefs}
                />
              ))}
          </group>
        </Center>
      </Bounds>

      <CameraFocus targetId={selectedId} hotspotRefs={hotspotRefs} controlsRef={controlsRef} resetToken={resetToken} />

      <Grid
        infiniteGrid
        cellSize={0.12}
        sectionSize={0.6}
        fadeDistance={6}
        fadeStrength={1.6}
        position={[0, -0.01, 0]}
      />
      <ContactShadows position={[0, -0.012, 0]} opacity={0.45} scale={4} blur={2.5} far={2.4} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.18}
        minDistance={freeCam ? 0.05 : 0.55}
        maxDistance={freeCam ? 50 : 4}
        maxPolarAngle={freeCam ? Math.PI : Math.PI / 2}
      />
      <GizmoHelper alignment="bottom-right" margin={[88, 88]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#f8fafc" />
      </GizmoHelper>
    </>
  )
}

function LoadingPanel() {
  return (
    <Html center>
      <div className="w-56 rounded-2xl border border-white/10 bg-slate-950/90 p-4 text-center text-white shadow-2xl backdrop-blur">
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />
        <p className="text-sm font-medium">Loading 3D model</p>
        <p className="mt-1 text-xs text-slate-400">Preparing GearView3D viewport...</p>
      </div>
    </Html>
  )
}

/**
 * Bare 3D scene - toolbar, canvas and hotspot markers only. Selection is
 * controlled by the parent (mirrors InteractiveForkliftViewer's contract)
 * so it can sit inside ModuleSimulationShell's scene slot, which supplies
 * the surrounding chrome (objectives/steps/current-task overlays).
 */
export default function ForkliftViewport({
  modelUrl = DEFAULT_MODEL_URL,
  hotspots = partsHotspots,
  selectedHotspotId,
  onHotspotSelect,
  onResetView,
  isAdmin = false,
}) {
  const containerRef = useRef(null)
  const [overlaysEnabled, setOverlaysEnabled] = useState(true)
  const [wireframe, setWireframe] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [modelReady, setModelReady] = useState(false)
  const [freeCam, setFreeCam] = useState(false)

  useEffect(() => {
    let active = true

    fetch(modelUrl, { cache: 'no-store' })
      .then((response) => {
        if (active) {
          setModelReady(response.ok)
        }
      })
      .catch(() => {
        if (active) {
          setModelReady(false)
        }
      })

    return () => {
      active = false
    }
  }, [modelUrl])

  const enterFullscreen = async () => {
    if (!containerRef.current || document.fullscreenElement) return
    await containerRef.current.requestFullscreen?.()
  }

  const resetView = () => {
    setResetToken((value) => value + 1)
    onResetView?.()
  }

  const Scene = modelReady ? (
    <ForkliftScene
      modelUrl={modelUrl}
      hotspots={hotspots}
      overlaysEnabled={overlaysEnabled}
      selectedId={selectedHotspotId}
      onSelectHotspot={onHotspotSelect}
      resetToken={resetToken}
      wireframe={wireframe}
      freeCam={freeCam}
    />
  ) : (
    <FallbackForkliftScene freeCam={freeCam} />
  )

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-[1rem] bg-gradient-to-br from-slate-900 via-slate-950 to-black">
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="gap-2 rounded-full bg-white/90" onClick={resetView}>
          <RotateCcw className="h-4 w-4" /> Reset view
        </Button>
        <Button size="sm" variant="secondary" className="gap-2 rounded-full bg-white/90" onClick={() => setOverlaysEnabled((value) => !value)}>
          <Eye className="h-4 w-4" /> {overlaysEnabled ? 'Hide' : 'Show'} hotspots
        </Button>
        <Button size="sm" variant="secondary" className="gap-2 rounded-full bg-white/90" onClick={() => setWireframe((value) => !value)}>
          <Wrench className="h-4 w-4" /> {wireframe ? 'Solid' : 'Wireframe'}
        </Button>
        <Button size="sm" variant="secondary" className="gap-2 rounded-full bg-white/90" onClick={enterFullscreen}>
          <Maximize className="h-4 w-4" /> Fullscreen
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="secondary"
            className={`gap-2 rounded-full ${freeCam ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-white/90'}`}
            onClick={() => setFreeCam((value) => !value)}
          >
            <Compass className="h-4 w-4" /> Free Cam {freeCam ? 'On' : 'Off'}
          </Button>
        )}
      </div>

      <div className="absolute bottom-4 left-4 z-10 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-xs text-slate-200 shadow-xl backdrop-blur">
        Drag to rotate - Scroll to zoom - Right-drag to pan
      </div>

      <ViewportErrorBoundary modelUrl={modelUrl}>
        <Canvas shadows dpr={[1, 1.35]} camera={{ position: [1.25, 0.85, 1.55], fov: 42 }}>
          <Suspense fallback={<LoadingPanel />}>{Scene}</Suspense>
        </Canvas>
      </ViewportErrorBoundary>
      <Loader />
    </div>
  )
}
