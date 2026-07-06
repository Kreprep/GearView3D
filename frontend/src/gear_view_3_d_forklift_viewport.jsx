import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import { motion } from 'framer-motion'
import {
  BadgeInfo,
  BookOpen,
  CheckCircle2,
  Eye,
  Maximize,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { partsHotspots } from './lib/trainingData'

const DEFAULT_MODEL_URL = '/models/Forklift_SEPERATED.glb'

const iconMap = {
  forks: Wrench,
  mast: ShieldCheck,
  'lift-chain': ShieldCheck,
  carriage: Wrench,
  'operator-area': BookOpen,
  'overhead-guard': ShieldCheck,
  counterweight: BadgeInfo,
  tires: Wrench,
  'capacity-plate': BadgeInfo,
  'warning-devices': ShieldCheck,
}

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
            <h3 className="text-xl font-semibold">Forklift model could not be loaded</h3>
            <p className="text-sm text-slate-300">
              Confirm the GLB is available at{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5">/models/Forklift_SEPERATED.glb</code>.
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

function HotspotPin({ hotspot, selected, onSelect }) {
  const glowRef = useRef(null)

  useFrame(({ clock }) => {
    if (!glowRef.current) return

    const pulse = selected ? 1.08 + Math.sin(clock.elapsedTime * 3.4) * 0.03 : 1
    glowRef.current.scale.setScalar(pulse)
  })

  return (
    <group position={hotspot.position}>
      <mesh
        ref={glowRef}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(hotspot)
        }}
        castShadow={false}
        receiveShadow={false}
      >
        <ringGeometry args={[0.018, 0.04, 24]} />
        <meshBasicMaterial color={selected ? '#67e8f9' : '#e0f2fe'} transparent opacity={0.9} />
      </mesh>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect(hotspot)
        }}
        castShadow={false}
        receiveShadow={false}
      >
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshStandardMaterial
          color={selected ? '#22d3ee' : '#f8fafc'}
          emissive={selected ? '#0ea5e9' : '#111827'}
          emissiveIntensity={selected ? 0.6 : 0.2}
          metalness={0.1}
          roughness={0.35}
        />
      </mesh>
    </group>
  )
}

function FallbackForkliftScene() {
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
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.75} maxDistance={4.2} />
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
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[1.25, 0.85, 1.55]} fov={42} />
      <ambientLight intensity={0.75} />
      <directionalLight castShadow position={[2.2, 3, 1.8]} intensity={2.4} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Environment preset="warehouse" />

      <Bounds fit clip observe margin={1.25}>
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
                />
              ))}
          </group>
        </Center>
      </Bounds>

      <Grid
        infiniteGrid
        cellSize={0.12}
        sectionSize={0.6}
        fadeDistance={6}
        fadeStrength={1.6}
        position={[0, -0.01, 0]}
      />
      <ContactShadows position={[0, -0.012, 0]} opacity={0.45} scale={4} blur={2.5} far={2.4} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.55} maxDistance={4} />
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
        <p className="text-sm font-medium">Loading forklift model</p>
        <p className="mt-1 text-xs text-slate-400">Preparing GearView3D viewport...</p>
      </div>
    </Html>
  )
}

export default function ForkliftViewport({
  modelUrl = DEFAULT_MODEL_URL,
  hotspots = partsHotspots,
  selectedPartId,
  onPartSelect,
  onPartViewed,
}) {
  const containerRef = useRef(null)
  const [selectedHotspotId, setSelectedHotspotId] = useState(hotspots[0]?.id)
  const [overlaysEnabled, setOverlaysEnabled] = useState(true)
  const [wireframe, setWireframe] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [modelReady, setModelReady] = useState(false)
  const effectiveSelectedHotspotId = selectedPartId || selectedHotspotId
  const selectedHotspot = useMemo(
    () => hotspots.find((item) => item.id === effectiveSelectedHotspotId) || hotspots[0],
    [hotspots, effectiveSelectedHotspotId],
  )
  const progress = useMemo(() => {
    const index = hotspots.findIndex((item) => item.id === selectedHotspot?.id)
    return Math.round(((index + 1) / hotspots.length) * 100)
  }, [hotspots, selectedHotspot])

  useEffect(() => {
    if (selectedHotspot?.id) {
      onPartViewed?.(selectedHotspot.id)
    }
  }, [onPartViewed, selectedHotspot?.id])

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

  const handleSelectHotspot = (hotspot) => {
    setSelectedHotspotId(hotspot.id)
    onPartSelect?.(hotspot.id)
    onPartViewed?.(hotspot.id)
  }

  const Scene = modelReady ? (
    <ForkliftScene
      modelUrl={modelUrl}
      hotspots={hotspots}
      overlaysEnabled={overlaysEnabled}
      selectedId={selectedHotspot?.id}
      onSelectHotspot={handleSelectHotspot}
      resetToken={resetToken}
      wireframe={wireframe}
    />
  ) : (
    <FallbackForkliftScene />
  )

  const SelectedIcon = selectedHotspot ? iconMap[selectedHotspot.id] || BadgeInfo : BadgeInfo

  return (
    <section className="w-full rounded-[1.25rem] bg-slate-950 p-3 text-slate-100 shadow-2xl">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div ref={containerRef} className="relative min-h-[min(76vh,820px)] overflow-hidden rounded-[1rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black">
          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="gap-2 rounded-full bg-white/90" onClick={() => setResetToken((value) => value + 1)}>
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
          </div>

          <div className="absolute bottom-4 left-4 z-10 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-xs text-slate-200 shadow-xl backdrop-blur">
            Drag to rotate - Scroll to zoom - Right-drag to pan
          </div>

          <ViewportErrorBoundary>
            <Canvas shadows dpr={[1, 1.35]} camera={{ position: [1.25, 0.85, 1.55], fov: 42 }}>
              <Suspense fallback={<LoadingPanel />}>{Scene}</Suspense>
            </Canvas>
          </ViewportErrorBoundary>
          <Loader />
        </div>

        <aside className="grid content-start gap-3">
          <Card className="rounded-[1rem] border-white/10 bg-white text-slate-950 shadow-xl">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">GearView3D Module</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Forklift Parts Walkthrough</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Explore the forklift in 3D, select hotspots, and review each part's function and safety reminder.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Parts progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <motion.div
                    className="h-full rounded-full bg-cyan-600"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1rem] border-white/10 bg-white text-slate-950 shadow-xl">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                  <SelectedIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Selected part</p>
                  <h2 className="text-lg font-semibold">{selectedHotspot?.label}</h2>
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-600">{selectedHotspot?.functionText}</p>
              {selectedHotspot?.category && (
                <p className="mt-3 rounded-xl bg-cyan-50 p-3 text-sm leading-6 text-cyan-950">
                  Category: {selectedHotspot.category}
                </p>
              )}
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                Safety: {selectedHotspot?.safetyNote}
              </p>
              {selectedHotspot?.inspectionReminder && (
                <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">
                  Inspection reminder: {selectedHotspot.inspectionReminder}
                </p>
              )}

              <div className="mt-5 space-y-2">
                {selectedHotspot?.checklist.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-cyan-700" />
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1rem] border-white/10 bg-white text-slate-950 shadow-xl">
            <CardContent className="p-4">
              <div className="grid gap-2">
                {hotspots.map((hotspot) => {
                  const Icon = iconMap[hotspot.id] || BadgeInfo
                  const active = hotspot.id === selectedHotspot?.id

                  return (
                    <button
                      key={hotspot.id}
                      type="button"
                      onClick={() => handleSelectHotspot(hotspot)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        active ? 'border-cyan-500 bg-cyan-50 text-cyan-950' : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{hotspot.label}</span>
                        <span className="block text-xs text-slate-500">Tap marker or list item to review</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  )
}

useGLTF.preload(DEFAULT_MODEL_URL)
