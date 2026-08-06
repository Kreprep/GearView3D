import React, { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  ContactShadows,
  Grid,
  Html,
  Loader,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BadgeInfo, Compass } from 'lucide-react'

const DEFAULT_MODEL_URL = '/models/Forklift_SEPERATED.glb'

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
        <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-400 bg-slate-100 p-4 text-center text-slate-600">
          <div className="max-w-sm space-y-2">
            <BadgeInfo className="mx-auto h-6 w-6" />
            <h3 className="text-sm font-semibold">3D Model unavailable</h3>
            <p className="text-xs">The 3D model could not be loaded at this time.</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function Model3D({ modelUrl }) {
  const { scene } = useGLTF(modelUrl)
  const model = useMemo(() => cloneSkeleton(scene), [scene])

  return <primitive object={model} />
}

function LoadingOverlay() {
  return (
    <Html center>
      <div className="w-48 rounded-lg border border-white/20 bg-slate-900/80 p-3 text-center text-white shadow-lg backdrop-blur">
        <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
        <p className="text-xs font-medium">Loading 3D model...</p>
      </div>
    </Html>
  )
}

function ModelScene({ modelUrl, freeCam }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[1.25, 0.85, 1.55]} fov={42} />
      <ambientLight intensity={1.05} />
      <hemisphereLight args={['#f8fafc', '#1e293b', 1.05]} />
      <directionalLight
        castShadow
        position={[2.2, 3, 1.8]}
        intensity={2.4}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-2.4, 1.8, -2]} intensity={1} />

      <group rotation={[0, -0.18, 0]}>
        <Model3D modelUrl={modelUrl} />
      </group>

      <Grid
        infiniteGrid
        cellSize={0.12}
        sectionSize={0.6}
        fadeDistance={6}
        fadeStrength={1.6}
        position={[0, -0.01, 0]}
      />
      <ContactShadows
        position={[0, -0.012, 0]}
        opacity={0.45}
        scale={4}
        blur={2.5}
        far={2.4}
      />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={freeCam ? 0.05 : 0.55}
        maxDistance={freeCam ? 50 : 4}
        maxPolarAngle={freeCam ? Math.PI : undefined}
      />
    </>
  )
}

export default function Model3DViewer({
  modelUrl = DEFAULT_MODEL_URL,
  height = '300px',
  className = '',
  isAdmin = false,
}) {
  const [freeCam, setFreeCam] = useState(false)

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100 ${className}`}
      style={{ height }}
    >
      <ViewportErrorBoundary>
        <Canvas shadows dpr={[1, 1.35]} camera={{ position: [1.25, 0.85, 1.55], fov: 42 }}>
          <Suspense fallback={<LoadingOverlay />}>
            <ModelScene modelUrl={modelUrl} freeCam={freeCam} />
          </Suspense>
        </Canvas>
      </ViewportErrorBoundary>
      <Loader />
      {isAdmin && (
        <button
          type="button"
          onClick={() => setFreeCam((value) => !value)}
          className={`absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium shadow-sm backdrop-blur ${
            freeCam ? 'border-cyan-400 bg-cyan-500/90 text-white' : 'border-slate-300 bg-white/80 text-slate-600'
          }`}
        >
          <Compass size={14} /> Free Cam {freeCam ? 'On' : 'Off'}
        </button>
      )}
      <div className="absolute bottom-2 left-2 z-10 rounded-lg border border-slate-300 bg-white/80 px-2 py-1 text-xs text-slate-600 shadow-sm backdrop-blur">
        Drag to rotate - Scroll to zoom
      </div>
    </div>
  )
}
