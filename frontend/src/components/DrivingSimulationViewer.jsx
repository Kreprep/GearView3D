import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Html, useGLTF } from '@react-three/drei'
import { DoubleSide, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { RotateCcw } from 'lucide-react'
import './DrivingSimulationViewer.css'

const DEFAULT_MODEL_URL = '/models/Forklift_SEPERATED.glb'

const GROUND_HALF_WIDTH = 6
const COURSE_MAX_Z = 36
const COURSE_MIN_Z = -3

const MAX_SPEED = 1.5
const MAX_REVERSE_SPEED = 0.8
const ACCEL = 1.1
const BRAKE_DECEL = 2.4
const REVERSE_ACCEL = 0.7
const DRAG = 0.7
const TURN_RATE = 0.85
const STOP_SPEED_EPSILON = 0.04

const KEY_LEGEND = [
  { key: 'w', caption: 'Accelerate' },
  { key: 'a', caption: 'Steer Left' },
  { key: 's', caption: 'Brake' },
  { key: 'd', caption: 'Steer Right' },
  { key: 'e', caption: 'Engine' },
]

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function useDrivingInput(onEngineToggle, onKeyActive) {
  const keysRef = useRef({ forward: false, back: false, left: false, right: false })
  const [pressed, setPressed] = useState({ w: false, a: false, s: false, d: false, e: false })
  const onEngineToggleRef = useRef(onEngineToggle)
  const onKeyActiveRef = useRef(onKeyActive)

  useEffect(() => {
    onEngineToggleRef.current = onEngineToggle
  }, [onEngineToggle])

  useEffect(() => {
    onKeyActiveRef.current = onKeyActive
  }, [onKeyActive])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'e'].includes(key)) return
      event.preventDefault()
      if (key === 'w') keysRef.current.forward = true
      if (key === 's') keysRef.current.back = true
      if (key === 'a') keysRef.current.left = true
      if (key === 'd') keysRef.current.right = true
      if (key === 'e' && !event.repeat) onEngineToggleRef.current?.()
      setPressed((current) => {
        if (current[key]) return current
        if (key !== 'e') onKeyActiveRef.current?.(key)
        return { ...current, [key]: true }
      })
    }

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'e'].includes(key)) return
      if (key === 'w') keysRef.current.forward = false
      if (key === 's') keysRef.current.back = false
      if (key === 'a') keysRef.current.left = false
      if (key === 'd') keysRef.current.right = false
      setPressed((current) => (current[key] ? { ...current, [key]: false } : current))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return { keysRef, pressed }
}

function PathBreadcrumbs({ points }) {
  const dots = useMemo(() => {
    const result = []
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, , z1] = points[i]
      const [x2, , z2] = points[i + 1]
      const steps = Math.max(Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.4), 1)
      for (let step = 1; step <= steps; step += 1) {
        const t = step / (steps + 1)
        result.push([x1 + (x2 - x1) * t, 0.01, z1 + (z2 - z1) * t])
      }
    }
    return result
  }, [points])

  return (
    <group>
      {dots.map((point, index) => (
        <mesh key={index} position={point} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.08, 12]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  )
}

function CheckpointMarker({ checkpoint, status }) {
  if (checkpoint.shape === 'line') {
    return <FinishLineMarker checkpoint={checkpoint} status={status} />
  }

  return <RingCheckpointMarker checkpoint={checkpoint} status={status} />
}

function RingCheckpointMarker({ checkpoint, status }) {
  const ringMaterialRef = useRef(null)
  const [x, , z] = checkpoint.position

  useFrame(({ clock }) => {
    if (ringMaterialRef.current && status === 'active') {
      ringMaterialRef.current.opacity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.3
    }
  })

  const color = status === 'done' ? '#22c55e' : status === 'active' ? '#f59e0b' : '#64748b'
  const baseOpacity = status === 'pending' ? 0.22 : 0.85

  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(checkpoint.radius - 0.08, 0.05), checkpoint.radius, 48]} />
        <meshBasicMaterial ref={ringMaterialRef} color={color} transparent opacity={baseOpacity} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.4, 8]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0.19, 1.28, 0]}>
        <planeGeometry args={[0.36, 0.22]} />
        <meshBasicMaterial color={color} side={DoubleSide} />
      </mesh>
      {status !== 'done' && (
        <Html center position={[0, 1.75, 0]} distanceFactor={8}>
          <div className={`driving-checkpoint-label ${status}`}>
            {checkpoint.type === 'stop' ? 'STOP - ' : ''}
            {checkpoint.label}
          </div>
        </Html>
      )}
    </group>
  )
}

function FinishLineMarker({ checkpoint, status }) {
  const [x, , z] = checkpoint.position
  const halfWidth = checkpoint.halfWidth ?? 3
  const segments = 10
  const segmentWidth = (halfWidth * 2) / segments
  const poleColor = status === 'done' ? '#22c55e' : '#94a3b8'

  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: segments }, (_, index) => {
        const segmentX = -halfWidth + segmentWidth * (index + 0.5)
        const dark = index % 2 === 0
        return (
          <mesh key={index} position={[segmentX, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[segmentWidth, 0.5]} />
            <meshBasicMaterial color={dark ? '#111827' : '#f8fafc'} />
          </mesh>
        )
      })}
      {[-halfWidth, halfWidth].map((poleX) => (
        <mesh key={poleX} position={[poleX, 0.9, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
          <meshStandardMaterial color={poleColor} />
        </mesh>
      ))}
      {status !== 'done' && (
        <Html center position={[0, 2.1, 0]} distanceFactor={9}>
          <div className={`driving-checkpoint-label ${status}`}>{checkpoint.label}</div>
        </Html>
      )}
    </group>
  )
}

function CourseDecorations({ decorations }) {
  return (
    <group>
      {decorations.map((item, index) => {
        if (item.type === 'wall') {
          return (
            <mesh
              key={index}
              position={[item.position[0], 0.75, item.position[2]]}
              rotation={[0, item.rotation || 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.3, 1.5, item.length || 3]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.9} />
            </mesh>
          )
        }

        if (item.type === 'cone') {
          return (
            <group key={index} position={[item.position[0], 0, item.position[2]]}>
              <mesh position={[0, 0.05, 0]}>
                <cylinderGeometry args={[0.19, 0.19, 0.06, 12]} />
                <meshStandardMaterial color="#7c2d12" />
              </mesh>
              <mesh position={[0, 0.29, 0]} castShadow>
                <coneGeometry args={[0.16, 0.48, 12]} />
                <meshStandardMaterial color="#f97316" />
              </mesh>
            </group>
          )
        }

        return null
      })}
    </group>
  )
}

function DrivingLoadingPanel() {
  return (
    <Html center>
      <div className="interactive-loading-panel">
        <div />
        <p>Loading driving simulation</p>
      </div>
    </Html>
  )
}

function DrivingScene({
  modelUrl,
  course,
  forkliftGroupRef,
  posRef,
  headingRef,
  speedRef,
  engineOnRef,
  keysRef,
  checkpointIndex,
  checkpointIndexRef,
  onAdvanceCheckpoint,
  onSpeedSample,
}) {
  const { scene } = useGLTF(modelUrl)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const { camera } = useThree()
  const checkpoints = course.checkpoints || []

  useEffect(() => {
    forklift.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true

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

  const hudAccumRef = useRef(0)
  const backRef = useRef(new Vector3())
  const desiredCamRef = useRef(new Vector3())
  const lookTargetRef = useRef(new Vector3())

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const keys = keysRef.current

    if (engineOnRef.current) {
      if (keys.forward) {
        speedRef.current = Math.min(speedRef.current + ACCEL * dt, MAX_SPEED)
      } else if (keys.back) {
        speedRef.current = speedRef.current > STOP_SPEED_EPSILON
          ? Math.max(speedRef.current - BRAKE_DECEL * dt, 0)
          : Math.max(speedRef.current - REVERSE_ACCEL * dt, -MAX_REVERSE_SPEED)
      } else if (speedRef.current > 0) {
        speedRef.current = Math.max(speedRef.current - DRAG * dt, 0)
      } else if (speedRef.current < 0) {
        speedRef.current = Math.min(speedRef.current + DRAG * dt, 0)
      }

      if (Math.abs(speedRef.current) > STOP_SPEED_EPSILON) {
        const turnInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0)
        const turnScale = clamp(Math.abs(speedRef.current) / MAX_SPEED, 0.35, 1) * Math.sign(speedRef.current)
        headingRef.current += turnInput * TURN_RATE * dt * turnScale
      }
    } else if (speedRef.current > 0) {
      speedRef.current = Math.max(speedRef.current - DRAG * dt, 0)
    } else if (speedRef.current < 0) {
      speedRef.current = Math.min(speedRef.current + DRAG * dt, 0)
    }

    const forwardX = Math.sin(headingRef.current)
    const forwardZ = Math.cos(headingRef.current)
    posRef.current.x = clamp(posRef.current.x + forwardX * speedRef.current * dt, -GROUND_HALF_WIDTH, GROUND_HALF_WIDTH)
    posRef.current.z = clamp(posRef.current.z + forwardZ * speedRef.current * dt, COURSE_MIN_Z, COURSE_MAX_Z)

    if (forkliftGroupRef.current) {
      forkliftGroupRef.current.position.set(posRef.current.x, posRef.current.y, posRef.current.z)
      forkliftGroupRef.current.rotation.y = headingRef.current
    }

    const idx = checkpointIndexRef.current
    if (engineOnRef.current && idx < checkpoints.length) {
      const checkpoint = checkpoints[idx]
      let satisfied

      if (checkpoint.shape === 'line') {
        const lineDz = posRef.current.z - checkpoint.position[2]
        const lineDx = Math.abs(posRef.current.x - checkpoint.position[0])
        satisfied = lineDz >= -0.3 && lineDz <= (checkpoint.lineDepth ?? 1.2) && lineDx <= (checkpoint.halfWidth ?? 3)
      } else {
        const dx = posRef.current.x - checkpoint.position[0]
        const dz = posRef.current.z - checkpoint.position[2]
        const withinRadius = Math.hypot(dx, dz) <= checkpoint.radius
        const speedOk = checkpoint.type === 'stop' ? Math.abs(speedRef.current) <= (checkpoint.maxSpeed ?? 0.25) : true
        satisfied = withinRadius && speedOk
      }

      if (satisfied) {
        onAdvanceCheckpoint(idx, checkpoint, idx + 1 === checkpoints.length)
      }
    }

    if (typeof window !== 'undefined') {
      window.__drivingDebug = {
        x: posRef.current.x,
        z: posRef.current.z,
        heading: headingRef.current,
        speed: speedRef.current,
      }
    }

    backRef.current.set(-forwardX, 0, -forwardZ)
    desiredCamRef.current.copy(posRef.current).addScaledVector(backRef.current, 2.6)
    desiredCamRef.current.y += 1.5
    camera.position.lerp(desiredCamRef.current, 1 - Math.pow(0.0001, dt))
    lookTargetRef.current.set(posRef.current.x, posRef.current.y + 0.55, posRef.current.z)
    camera.lookAt(lookTargetRef.current)

    hudAccumRef.current += dt
    if (hudAccumRef.current >= 0.12) {
      hudAccumRef.current = 0
      onSpeedSample(Math.round(Math.abs(speedRef.current) * 20))
    }
  })

  const groundLength = COURSE_MAX_Z - COURSE_MIN_Z
  const groundCenterZ = COURSE_MIN_Z + groundLength / 2

  return (
    <>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#f8fafc', '#1e293b', 1.1]} />
      <directionalLight castShadow position={[4, 6, 2]} intensity={2.2} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-3, 3, -2]} intensity={0.9} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, groundCenterZ]} receiveShadow>
        <planeGeometry args={[GROUND_HALF_WIDTH * 2 + 4, groundLength + 8]} />
        <meshStandardMaterial color="#334155" roughness={1} />
      </mesh>
      <Grid
        position={[0, 0, groundCenterZ]}
        args={[GROUND_HALF_WIDTH * 2 + 4, groundLength + 8]}
        cellSize={0.5}
        cellColor="#475569"
        sectionSize={2.5}
        sectionColor="#94a3b8"
        fadeDistance={45}
        fadeStrength={1}
      />

      {course.start && (
        <mesh position={[course.start.position[0], 0.002, course.start.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.72, 40]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={DoubleSide} />
        </mesh>
      )}

      {checkpoints.length > 0 && (
        <PathBreadcrumbs points={[course.start?.position || [0, 0, 0], ...checkpoints.map((c) => c.position)]} />
      )}

      {checkpoints.map((checkpoint, index) => (
        <CheckpointMarker
          key={checkpoint.id}
          checkpoint={checkpoint}
          status={index < checkpointIndex ? 'done' : index === checkpointIndex ? 'active' : 'pending'}
        />
      ))}

      {course.decorations && <CourseDecorations decorations={course.decorations} />}

      <group ref={forkliftGroupRef}>
        <primitive object={forklift} />
      </group>
    </>
  )
}

function DrivingSimulationInner({ modelUrl, course, onEvent, onRequestReset, className }) {
  const start = course.start || { position: [0, 0, 0], heading: 0 }
  const forkliftGroupRef = useRef(null)
  const posRef = useRef(new Vector3(start.position[0], start.position[1] ?? 0, start.position[2]))
  const headingRef = useRef(start.heading || 0)
  const speedRef = useRef(0)
  const engineOnRef = useRef(false)
  const checkpointIndexRef = useRef(0)

  const [engineOn, setEngineOn] = useState(false)
  const [checkpointIndex, setCheckpointIndex] = useState(0)
  const [hudSpeed, setHudSpeed] = useState(0)

  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const toggleEngine = () => {
    const next = !engineOnRef.current
    engineOnRef.current = next
    setEngineOn(next)
    onEventRef.current?.({ type: next ? 'engine-on' : 'engine-off' })
  }

  const handleKeyActive = (key) => {
    onEventRef.current?.({ type: 'key-active', key })
  }

  const { keysRef, pressed } = useDrivingInput(toggleEngine, handleKeyActive)

  const checkpoints = course.checkpoints || []

  return (
    <section className={`driving-simulation ${className}`}>
      <div className="driving-hud-top">
        <span className={`driving-engine-badge ${engineOn ? 'on' : 'off'}`}>Engine {engineOn ? 'ON' : 'OFF'}</span>
        <span className="driving-speed-badge">Speed {hudSpeed}</span>
        {checkpoints.length > 0 && (
          <span className="driving-checkpoint-badge">
            {checkpointIndex >= checkpoints.length
              ? 'Course complete'
              : `Checkpoint ${checkpointIndex + 1} / ${checkpoints.length}`}
          </span>
        )}
      </div>

      <Canvas shadows dpr={[1, 1.35]} camera={{ position: [0, 2, -4], fov: 55 }}>
        <Suspense fallback={<DrivingLoadingPanel />}>
          <DrivingScene
            modelUrl={modelUrl}
            course={course}
            forkliftGroupRef={forkliftGroupRef}
            posRef={posRef}
            headingRef={headingRef}
            speedRef={speedRef}
            engineOnRef={engineOnRef}
            keysRef={keysRef}
            checkpointIndex={checkpointIndex}
            checkpointIndexRef={checkpointIndexRef}
            onAdvanceCheckpoint={(idx, checkpoint, isLast) => {
              checkpointIndexRef.current = idx + 1
              setCheckpointIndex(idx + 1)
              const event = {
                type: isLast ? 'course-complete' : 'checkpoint',
                id: checkpoint.id,
                label: checkpoint.label,
                message: checkpoint.completeMessage,
              }
              setTimeout(() => onEventRef.current?.(event), 0)
            }}
            onSpeedSample={setHudSpeed}
          />
        </Suspense>
      </Canvas>

      <div className="driving-hud-bottom">
        <button type="button" className="driving-reset-button" onClick={onRequestReset}>
          <RotateCcw size={14} /> Reset Attempt
        </button>
        <div className="driving-keys">
          {KEY_LEGEND.map(({ key, caption }) => (
            <div key={key} className="driving-key-wrap">
              <span className={`driving-key ${pressed[key] ? 'active' : ''}`}>{key.toUpperCase()}</span>
              <span className="driving-key-caption">{caption}</span>
            </div>
          ))}
        </div>
        <p className="driving-hud-help">
          {engineOn ? 'Hold W to accelerate, S to brake or reverse, A / D to steer.' : 'Press E to start the engine.'}
        </p>
      </div>
    </section>
  )
}

export default function DrivingSimulationViewer({ modelUrl = DEFAULT_MODEL_URL, course, onEvent, className = '' }) {
  const [resetSeed, setResetSeed] = useState(0)

  return (
    <DrivingSimulationInner
      key={`${course.id}-${resetSeed}`}
      modelUrl={modelUrl}
      course={course}
      onEvent={onEvent}
      onRequestReset={() => setResetSeed((value) => value + 1)}
      className={className}
    />
  )
}

useGLTF.preload(DEFAULT_MODEL_URL)
