import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { DoubleSide, Quaternion, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Compass, RotateCcw } from 'lucide-react'
import { buildForkliftRig, REAR_WHEEL_KEYS } from '../lib/forkliftRig'
import './DrivingSimulationViewer.css'

const DEFAULT_MODEL_URL = '/models/forklift.glb'

const CONE_MODEL_URL = '/models/traffic-cone.glb'
const PALLET_MODEL_LIGHT_URL = '/models/wooden-pallet.glb'
const PALLET_MODEL_MEDIUM_URL = '/models/plastic-pallet.glb'
const PALLET_MODEL_HEAVY_URL = '/models/cement-bag-pallet.glb'
const CARGO_BOX_MODEL_URL = '/models/cardboard-box.glb'

// Weight bands that pick which pallet prop renders for a course pallet.
const PALLET_LIGHT_MAX_KG = 500
const PALLET_HEAVY_MIN_KG = 1000

// Source assets come from mismatched free-asset scales/origins - each entry
// normalizes one to real-world size at this scene's world-units-are-metres/4
// convention (see forkliftRig.js) and re-centers it over its own group origin
// (measured via a throwaway inspect-glb.mjs bounding-box script).
const MODEL_TRANSFORM = {
  [CONE_MODEL_URL]: { scale: 0.00594, position: [0, 0, 0] }, // 0.7m cone
  [PALLET_MODEL_LIGHT_URL]: { scale: 0.15, position: [0.225, 0, 0] }, // 1.2m pallet
  [PALLET_MODEL_MEDIUM_URL]: { scale: 0.00245, position: [0, 0, 0] },
  [PALLET_MODEL_HEAVY_URL]: { scale: 0.25, position: [0, 0, 0] },
  [CARGO_BOX_MODEL_URL]: { scale: 0.25, position: [0, 0.0486, 0] },
}

// Deck height (world units) each pallet model's cargo box rests on top of.
const PALLET_DECK_Y = {
  [PALLET_MODEL_LIGHT_URL]: 0.0364,
  [PALLET_MODEL_MEDIUM_URL]: 0.0343,
}

function palletModelForWeight(weightKg) {
  if (typeof weightKg !== 'number') return PALLET_MODEL_LIGHT_URL
  if (weightKg >= PALLET_HEAVY_MIN_KG) return PALLET_MODEL_HEAVY_URL
  if (weightKg > PALLET_LIGHT_MAX_KG) return PALLET_MODEL_MEDIUM_URL
  return PALLET_MODEL_LIGHT_URL
}

const GROUND_HALF_WIDTH = 6
const COURSE_MAX_Z = 44
const COURSE_MIN_Z = -3

const MAX_SPEED = 1.5
const MAX_REVERSE_SPEED = 0.8
const ACCEL = 1.1
const BRAKE_DECEL = 2.4
const REVERSE_ACCEL = 0.7
const DRAG = 0.7
const TURN_RATE = 0.85
const STOP_SPEED_EPSILON = 0.04

// Model-derived rig tuning (forklift.glb, world units ~= metres/4).
const MAX_STEER_ANGLE = 0.45
const STEER_SIGN = -1 // rear-steer vehicle: rear wheels point away from the turn
const STEER_DAMP = 8
const FORK_MAX_HEIGHT = 0.3
const FORK_SPEED = 0.25
const MAST_LIFT_RATIO = 0.5
const FORK_TIP_OFFSET_FALLBACK = 0.45

// Pallet pickup gameplay thresholds (no physics engine - proximity/height checks).
const PICKUP_RADIUS = 0.35
const ALIGN_DOT_MIN = 0.9
const FORK_ENGAGE_HEIGHT = 0.05
const LIFT_THRESHOLD = 0.12
const DROP_LOWER_THRESHOLD = 0.06
const CLEAR_DISTANCE = 0.8
const PALLET_CARRY_Y = 0.01
const CARRY_LERP = 10

// Fail-condition "physics" (Module 4) - still kinematic, no physics engine.
// Tip-over pivots the whole truck about the front axle; dropped loads follow a
// simple ballistic arc; cones knock over about their base edge.
const TIP_PIVOT_Y = 0.08
const TIP_PIVOT_Z = 0.25
const TIP_GRAVITY_ACCEL = 2.4
const TIP_MAX_ANGLE = 1.15
const OVERLOAD_TIP_HEIGHT = 0.08
const CONE_HIT_RADIUS = 0.3
const CONE_MIN_HIT_SPEED = 0.05
const CONE_FALL_SPEED = 6
const CONE_FALL_ANGLE = 1.45
const WALL_THICKNESS = 0.05 // matches CourseDecorations' wall boxGeometry
const WALL_HALF_THICKNESS = WALL_THICKNESS / 2
const WALL_HIT_MARGIN = 0.12
// Parked-forklift footprint (half-extents), from forklift.glb's measured body
// bounding box - width along local X, length along local Z, same convention
// as the wall rectangle check.
const FORKLIFT_HALF_WIDTH = 0.15
const FORKLIFT_HALF_LENGTH = 0.45
const BODY_SAMPLE_OFFSETS = [0.38, 0, -0.32]
const SUDDEN_STOP_DECEL = 1.6
const SUDDEN_STOP_MIN_SPEED = 0.85
const LOAD_GRAVITY = 2.0
const LOAD_TUMBLE_RATE = 2.6
const LOAD_REST_TILT = 0.16

// Secure-parking proficiency (Module 3): the bay completes when the truck is
// inside the painted lines, aligned with them, stopped, forks down, engine off.
const PARKING_MARGIN_X = 0.052
const PARKING_MARGIN_Z = 0.105
const PARKING_ALIGN_TOLERANCE = 0.26
const PARKING_SPEED_EPSILON = 0.03
const PARKING_FORK_MAX = 0.02

const FAIL_MESSAGES = {
  cone: {
    title: 'Cone Struck',
    message: 'You hit a traffic cone. Treat cones as people or racking - reset the attempt and keep the lane clear.',
  },
  wall: {
    title: 'Wall Struck',
    message: 'You hit a wall or racking upright. Keep clear of structures while driving - reset the attempt and watch your clearance.',
  },
  forklift: {
    title: 'Forklift Struck',
    message: 'You clipped a parked forklift. Ease in slowly and keep clearance on both sides - reset the attempt and try again.',
  },
  overload: {
    title: 'Tip-Over: Overloaded',
    message: 'That pallet exceeds the rated capacity, so the forklift tipped forward. Reset and choose a load within capacity.',
  },
  'load-dropped': {
    title: 'Load Thrown Off',
    message: 'Braking hard at speed threw the pallet off the forks. Reset, slow down early, and brake gently while loaded.',
  },
}

const KEY_LEGEND = [
  { key: 'w', caption: 'Accelerate' },
  { key: 'a', caption: 'Steer Left' },
  { key: 's', caption: 'Brake' },
  { key: 'd', caption: 'Steer Right' },
  { key: 'e', caption: 'Engine' },
  { key: 'r', caption: 'Raise Forks' },
  { key: 'f', caption: 'Lower Forks' },
]

const PALLET_STATE_LABELS = {
  ground: 'Pallet: On Ground',
  carried: 'Pallet: Carried',
  released: 'Pallet: Set Down',
  delivered: 'Pallet: Delivered',
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function useDrivingInput(onEngineToggle, onKeyActive) {
  const keysRef = useRef({ forward: false, back: false, left: false, right: false, raise: false, lower: false })
  const [pressed, setPressed] = useState({ w: false, a: false, s: false, d: false, e: false, r: false, f: false })
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
      if (!['w', 'a', 's', 'd', 'e', 'r', 'f'].includes(key)) return
      event.preventDefault()
      if (key === 'w') keysRef.current.forward = true
      if (key === 's') keysRef.current.back = true
      if (key === 'a') keysRef.current.left = true
      if (key === 'd') keysRef.current.right = true
      if (key === 'r') keysRef.current.raise = true
      if (key === 'f') keysRef.current.lower = true
      if (key === 'e' && !event.repeat) onEngineToggleRef.current?.()
      setPressed((current) => {
        if (current[key]) return current
        if (key !== 'e') onKeyActiveRef.current?.(key)
        return { ...current, [key]: true }
      })
    }

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'e', 'r', 'f'].includes(key)) return
      if (key === 'w') keysRef.current.forward = false
      if (key === 's') keysRef.current.back = false
      if (key === 'a') keysRef.current.left = false
      if (key === 'd') keysRef.current.right = false
      if (key === 'r') keysRef.current.raise = false
      if (key === 'f') keysRef.current.lower = false
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

function ModelProp({ url }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const next = cloneSkeleton(scene)
    next.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    return next
  }, [scene])
  const { scale, position } = MODEL_TRANSFORM[url]
  return <primitive object={cloned} scale={scale} position={position} />
}

// Static parked forklift used as a parking obstacle (park-between-forklifts
// scenario) - same model as the drivable one, just not wired to the rig/keys.
function ParkedForklift({ position, rotation }) {
  const { scene } = useGLTF(DEFAULT_MODEL_URL)
  const cloned = useMemo(() => {
    const next = cloneSkeleton(scene)
    next.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    return next
  }, [scene])
  return <primitive object={cloned} position={position} rotation={[0, rotation || 0, 0]} />
}

// Renders decorative course furniture. Cones are not handled here - they're
// unified with course.obstacles into `liveCones` so every rendered cone is a
// live collider (see DrivingScene), rendered once via <ObstacleCones>.
function CourseDecorations({ decorations }) {
  return (
    <group>
      {decorations.map((item, index) => {
        if (item.type === 'wall') {
          return (
            <mesh
              key={index}
              position={[item.position[0], 0.3125, item.position[2]]}
              rotation={[0, item.rotation || 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.05, 0.625, item.length || 3]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.9} />
            </mesh>
          )
        }

        if (item.type === 'forklift') {
          return (
            <ParkedForklift key={index} position={[item.position[0], item.position[1] ?? 0, item.position[2]]} rotation={item.rotation} />
          )
        }

        return null
      })}
    </group>
  )
}

function Pallet({ pallet, palletRef, overweight = false }) {
  const modelUrl = palletModelForWeight(pallet.weightKg)
  const cargoDeckY = PALLET_DECK_Y[modelUrl]

  return (
    <group ref={palletRef} position={[pallet.position[0], 0, pallet.position[2]]} rotation={[0, pallet.rotation || 0, 0]}>
      <ModelProp url={modelUrl} />
      {cargoDeckY != null && (
        <group position={[0, cargoDeckY, 0]}>
          <ModelProp url={CARGO_BOX_MODEL_URL} />
        </group>
      )}
      {typeof pallet.weightKg === 'number' && (
        <Html center position={[0, 0.55, 0]} distanceFactor={8}>
          <div className={`pallet-weight-label ${overweight ? 'overweight' : ''}`}>{pallet.weightKg} kg</div>
        </Html>
      )}
    </group>
  )
}

function ObstacleCones({ obstacles, coneRefs }) {
  return (
    <group>
      {obstacles.map((item, index) => (
        <group
          key={index}
          ref={(el) => {
            coneRefs.current[index] = el
          }}
          position={[item.position[0], 0, item.position[2]]}
        >
          <ModelProp url={CONE_MODEL_URL} />
        </group>
      ))}
    </group>
  )
}

function DropZoneMarker({ zone, delivered }) {
  const ringMaterialRef = useRef(null)

  useFrame(({ clock }) => {
    if (ringMaterialRef.current && !delivered) {
      ringMaterialRef.current.opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.25
    }
  })

  return (
    <group position={[zone.position[0], 0, zone.position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[Math.max(zone.radius - 0.1, 0.05), zone.radius, 48]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={delivered ? '#22c55e' : '#38bdf8'}
          transparent
          opacity={delivered ? 0.85 : 0.6}
          side={DoubleSide}
        />
      </mesh>
      {!delivered && (
        <Html center position={[0, 1.1, 0]} distanceFactor={8}>
          <div className="driving-checkpoint-label active">{zone.label || 'Drop Zone'}</div>
        </Html>
      )}
    </group>
  )
}

function ParkingBayMarker({ bay, parked }) {
  const width = bay.width ?? 1.3
  const depth = bay.depth ?? 1.9
  const stripe = 0.07
  const lineColor = parked ? '#22c55e' : '#f8fafc'

  return (
    <group position={[bay.position[0], 0.004, bay.position[2]]} rotation={[0, bay.heading || 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={parked ? '#166534' : '#1e3a5f'} transparent opacity={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[(side * width) / 2, 0, 0]}>
          <planeGeometry args={[stripe, depth]} />
          <meshBasicMaterial color={lineColor} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, depth / 2]}>
        <planeGeometry args={[width + stripe, stripe]} />
        <meshBasicMaterial color={lineColor} />
      </mesh>
      {!parked && (
        <Html center position={[0, 1.1, 0]} distanceFactor={8}>
          <div className="driving-checkpoint-label active">{bay.label || 'Parking Bay'}</div>
        </Html>
      )}
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
  palletState,
  onPalletEvent,
  onFail,
  parked,
  onParkingUpdate,
  freeCam,
}) {
  const { scene } = useGLTF(modelUrl)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const rigRef = useRef(null)
  const { camera } = useThree()
  const checkpoints = course.checkpoints || []
  const pallets = useMemo(() => course.pallets || (course.pallet ? [course.pallet] : []), [course])
  // Every rendered cone is a live collider, whether authored under
  // `obstacles` or as a `decorations` lane/gate marker - a cone is a hazard
  // regardless of which list placed it.
  const liveCones = useMemo(
    () => [...(course.obstacles || []), ...(course.decorations || []).filter((item) => item.type === 'cone')],
    [course],
  )
  const liveWalls = useMemo(
    () => (course.decorations || []).filter((item) => item.type === 'wall' || item.type === 'forklift'),
    [course],
  )

  useEffect(() => {
    rigRef.current = buildForkliftRig(forklift)
  }, [forklift])

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

  const forkHeightRef = useRef(0)
  const steerAngleRef = useRef(0)
  const palletRefs = useRef([])
  const palletSimRef = useRef(null)
  const carriedIndexRef = useRef(-1)
  const deliveredCountRef = useRef(0)
  const prevSpeedRef = useRef(0)
  const failedRef = useRef(false)
  const tipPivotRef = useRef(null)
  const tipStateRef = useRef({ active: false, angle: 0, vel: 0 })
  const coneRefs = useRef([])
  const coneSimRef = useRef(null)
  const coneAxisRef = useRef(new Vector3())
  const coneQuatRef = useRef(new Quaternion())

  const onFailRef = useRef(onFail)
  useEffect(() => {
    onFailRef.current = onFail
  }, [onFail])

  const parkedRef = useRef(false)
  const parkingStatusRef = useRef('')
  const onParkingUpdateRef = useRef(onParkingUpdate)
  useEffect(() => {
    onParkingUpdateRef.current = onParkingUpdate
  }, [onParkingUpdate])

  // Dev-only test hook: warp truck/fork state directly instead of faking held
  // keys, so browser-automation checks can reach a course's pallets/cones
  // without fighting acceleration/drag timing. Mirrors window.__drivingDebug.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__drivingDebugSet = (patch = {}) => {
      if (typeof patch.x === 'number') posRef.current.x = patch.x
      if (typeof patch.z === 'number') posRef.current.z = patch.z
      if (typeof patch.heading === 'number') headingRef.current = patch.heading
      if (typeof patch.speed === 'number') speedRef.current = patch.speed
      if (typeof patch.forkHeight === 'number') forkHeightRef.current = clamp(patch.forkHeight, 0, FORK_MAX_HEIGHT)
      if (typeof patch.engineOn === 'boolean') engineOnRef.current = patch.engineOn
    }
    return () => {
      delete window.__drivingDebugSet
    }
  }, [posRef, headingRef, speedRef, engineOnRef])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const keys = keysRef.current
    const controlsLocked = failedRef.current
    const turnInput = controlsLocked ? 0 : (keys.left ? 1 : 0) - (keys.right ? 1 : 0)
    const prevSpeed = prevSpeedRef.current

    const triggerFail = (reason) => {
      if (failedRef.current) return
      failedRef.current = true
      onFailRef.current?.(reason)
    }

    if (controlsLocked) {
      if (speedRef.current > 0) {
        speedRef.current = Math.max(speedRef.current - BRAKE_DECEL * dt, 0)
      } else if (speedRef.current < 0) {
        speedRef.current = Math.min(speedRef.current + BRAKE_DECEL * dt, 0)
      }
    } else if (engineOnRef.current) {
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

    // Procedural part animation: wheel roll, rear-wheel steering, fork lift.
    const rig = rigRef.current
    if (rig) {
      Object.values(rig.wheels).forEach((wheel) => {
        wheel.spin.rotation.x += (speedRef.current / wheel.radius) * dt
      })

      const steerTarget = engineOnRef.current && !controlsLocked ? turnInput * MAX_STEER_ANGLE * STEER_SIGN : 0
      steerAngleRef.current += (steerTarget - steerAngleRef.current) * Math.min(STEER_DAMP * dt, 1)
      REAR_WHEEL_KEYS.forEach((key) => {
        if (rig.wheels[key]?.steer) rig.wheels[key].steer.rotation.y = steerAngleRef.current
      })

      if (engineOnRef.current && !controlsLocked) {
        if (keys.raise) {
          forkHeightRef.current = Math.min(forkHeightRef.current + FORK_SPEED * dt, FORK_MAX_HEIGHT)
        } else if (keys.lower) {
          forkHeightRef.current = Math.max(forkHeightRef.current - FORK_SPEED * dt, 0)
        }
      }
      if (rig.carriageLift) rig.carriageLift.position.y = forkHeightRef.current
      if (rig.mastLift) rig.mastLift.position.y = forkHeightRef.current * MAST_LIFT_RATIO
    }

    // Overload tip-over: pitch the whole truck about the front axle with an
    // accelerating fall until the forks hit the ground.
    const tip = tipStateRef.current
    if (tip.active && tip.angle < TIP_MAX_ANGLE) {
      tip.vel += TIP_GRAVITY_ACCEL * dt
      tip.angle = Math.min(tip.angle + tip.vel * dt, TIP_MAX_ANGLE)
      if (tipPivotRef.current) tipPivotRef.current.rotation.x = tip.angle
    }

    // Cone collision: sample three points along the truck body against every
    // live cone (obstacles + decoration lane/gate markers); a hit knocks the
    // cone over and fails the attempt. Always on - a cone is a hazard however
    // the course authored it.
    if (liveCones.length && !failedRef.current && Math.abs(speedRef.current) > CONE_MIN_HIT_SPEED) {
      if (!coneSimRef.current) coneSimRef.current = liveCones.map(() => ({ hit: false, angle: 0, dirX: 0, dirZ: 1 }))
      const coneSims = coneSimRef.current
      for (let i = 0; i < liveCones.length && !failedRef.current; i += 1) {
        const cone = liveCones[i]
        if (coneSims[i].hit) continue
        for (const offset of BODY_SAMPLE_OFFSETS) {
          const px = posRef.current.x + forwardX * offset
          const pz = posRef.current.z + forwardZ * offset
          if (Math.hypot(cone.position[0] - px, cone.position[2] - pz) <= CONE_HIT_RADIUS) {
            const dirX = cone.position[0] - posRef.current.x
            const dirZ = cone.position[2] - posRef.current.z
            const len = Math.hypot(dirX, dirZ) || 1
            coneSims[i] = { hit: true, angle: 0, dirX: dirX / len, dirZ: dirZ / len }
            triggerFail('cone')
            break
          }
        }
      }
    }

    // Animate knocked-over cones (keeps running after the fail freeze).
    if (coneSimRef.current && liveCones.length) {
      coneSimRef.current.forEach((sim, i) => {
        if (!sim.hit || sim.angle >= CONE_FALL_ANGLE) return
        sim.angle = Math.min(sim.angle + CONE_FALL_SPEED * dt * Math.max(0.15, 1 - sim.angle / CONE_FALL_ANGLE), CONE_FALL_ANGLE)
        const group = coneRefs.current[i]
        if (!group) return
        coneAxisRef.current.set(sim.dirZ, 0, -sim.dirX)
        coneQuatRef.current.setFromAxisAngle(coneAxisRef.current, sim.angle)
        group.quaternion.copy(coneQuatRef.current)
        group.position.x = liveCones[i].position[0] + sim.dirX * sim.angle * 0.12
        group.position.z = liveCones[i].position[2] + sim.dirZ * sim.angle * 0.12
      })
    }

    // Wall/forklift collision: sample the same body points against every
    // decoration's oriented rectangle (thickness x length, or a parked
    // forklift's footprint). Immovable, so a hit just fails the attempt.
    if (liveWalls.length && !failedRef.current && Math.abs(speedRef.current) > CONE_MIN_HIT_SPEED) {
      wallLoop: for (const wall of liveWalls) {
        const isForklift = wall.type === 'forklift'
        const rot = wall.rotation || 0
        const cosRot = Math.cos(rot)
        const sinRot = Math.sin(rot)
        const halfThickness = isForklift ? FORKLIFT_HALF_WIDTH : WALL_HALF_THICKNESS
        const halfLen = isForklift ? FORKLIFT_HALF_LENGTH : (wall.length || 3) / 2
        for (const offset of BODY_SAMPLE_OFFSETS) {
          const dx = posRef.current.x + forwardX * offset - wall.position[0]
          const dz = posRef.current.z + forwardZ * offset - wall.position[2]
          const localX = dx * cosRot - dz * sinRot
          const localZ = dx * sinRot + dz * cosRot
          if (Math.abs(localX) <= halfThickness + WALL_HIT_MARGIN && Math.abs(localZ) <= halfLen + WALL_HIT_MARGIN) {
            triggerFail(isForklift ? 'forklift' : 'wall')
            break wallLoop
          }
        }
      }
    }

    const idx = checkpointIndexRef.current
    if (engineOnRef.current && !controlsLocked && idx < checkpoints.length) {
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

    // Pallet pickup/carry/release - proximity + fork-height checks, no physics
    // engine. Multi-pallet aware: only one pallet can be carried at a time, and
    // courses with `capacityKg`/`failConditions` add overload and sudden-stop
    // fail behavior on top of the module-2 flow.
    if (pallets.length) {
      if (!palletSimRef.current) {
        palletSimRef.current = pallets.map(() => ({ state: 'ground', engaged: false, vx: 0, vy: 0, vz: 0 }))
      }
      const capacity = typeof course.capacityKg === 'number' ? course.capacityKg : Infinity
      const attachOffset = rig?.forkTipOffset || FORK_TIP_OFFSET_FALLBACK
      const tipX = posRef.current.x + forwardX * attachOffset
      const tipZ = posRef.current.z + forwardZ * attachOffset

      pallets.forEach((palletDef, i) => {
        const pallet = palletRefs.current[i]
        const sim = palletSimRef.current[i]
        if (!pallet || !sim) return

        if ((sim.state === 'ground' || sim.state === 'released') && carriedIndexRef.current === -1 && !failedRef.current) {
          const near = Math.hypot(pallet.position.x - tipX, pallet.position.z - tipZ) <= PICKUP_RADIUS
          const toX = pallet.position.x - posRef.current.x
          const toZ = pallet.position.z - posRef.current.z
          const facing = (forwardX * toX + forwardZ * toZ) / (Math.hypot(toX, toZ) || 1)

          if (near && facing >= ALIGN_DOT_MIN && forkHeightRef.current <= FORK_ENGAGE_HEIGHT) {
            sim.engaged = true
          } else if (!near || facing < ALIGN_DOT_MIN) {
            sim.engaged = false
          }

          if (sim.engaged && engineOnRef.current) {
            const overweight = (palletDef.weightKg ?? 0) > capacity
            if (course.failConditions?.overload && overweight && forkHeightRef.current >= OVERLOAD_TIP_HEIGHT) {
              // Overload: the truck pitches forward and throws the load off.
              sim.engaged = false
              sim.state = 'falling'
              sim.vx = forwardX * (Math.abs(speedRef.current) + 0.5)
              sim.vz = forwardZ * (Math.abs(speedRef.current) + 0.5)
              sim.vy = 0.35
              tipStateRef.current.active = true
              triggerFail('overload')
            } else if (!overweight && forkHeightRef.current >= LIFT_THRESHOLD) {
              sim.engaged = false
              sim.state = 'carried'
              carriedIndexRef.current = i
              onPalletEvent({ type: 'pallet-lifted', palletId: palletDef.id, weightKg: palletDef.weightKg }, 'carried')
            }
          }
        } else if (sim.state === 'carried') {
          if (
            course.failConditions?.suddenStop &&
            !failedRef.current &&
            prevSpeed > SUDDEN_STOP_MIN_SPEED &&
            (prevSpeed - speedRef.current) / dt > SUDDEN_STOP_DECEL
          ) {
            // Hard braking at speed: the load slides off the forks.
            sim.state = 'falling'
            carriedIndexRef.current = -1
            sim.vx = forwardX * prevSpeed * 1.15
            sim.vz = forwardZ * prevSpeed * 1.15
            sim.vy = 0.1
            triggerFail('load-dropped')
          } else {
            const lerpK = Math.min(CARRY_LERP * dt, 1)
            pallet.position.x += (tipX - pallet.position.x) * lerpK
            pallet.position.z += (tipZ - pallet.position.z) * lerpK
            pallet.position.y += (forkHeightRef.current + PALLET_CARRY_Y - pallet.position.y) * lerpK
            pallet.rotation.y = headingRef.current

            if (forkHeightRef.current <= DROP_LOWER_THRESHOLD) {
              sim.state = 'released'
              carriedIndexRef.current = -1
              pallet.position.set(tipX, 0, tipZ)
              onPalletEvent({ type: 'pallet-dropped', palletId: palletDef.id }, 'released')
            }
          }
        } else if (sim.state === 'falling') {
          sim.vy -= LOAD_GRAVITY * dt
          pallet.position.x += sim.vx * dt
          pallet.position.y += sim.vy * dt
          pallet.position.z += sim.vz * dt
          pallet.rotation.x += LOAD_TUMBLE_RATE * dt
          if (pallet.position.y <= 0.01 && sim.vy < 0) {
            pallet.position.y = 0.02
            pallet.rotation.x = 0
            pallet.rotation.z = LOAD_REST_TILT
            sim.state = 'dropped'
          }
        }

        if (sim.state === 'released' && course.dropZone && !failedRef.current) {
          const inZone = Math.hypot(
            pallet.position.x - course.dropZone.position[0],
            pallet.position.z - course.dropZone.position[2],
          ) <= course.dropZone.radius
          const cleared = Math.hypot(pallet.position.x - tipX, pallet.position.z - tipZ) >= CLEAR_DISTANCE
          if (inZone && cleared) {
            sim.state = 'delivered'
            deliveredCountRef.current += 1
            onPalletEvent(
              {
                type: 'pallet-delivered',
                palletId: palletDef.id,
                weightKg: palletDef.weightKg,
                deliveredCount: deliveredCountRef.current,
              },
              'delivered',
            )
          }
        }
      })
    }

    // Secure-parking proficiency: report the first unmet requirement while the
    // learner works the bay, then latch "parked" once everything is satisfied.
    if (course.parkingBay && !parkedRef.current && !failedRef.current) {
      const bay = course.parkingBay
      const halfW = (bay.width ?? 1.3) / 2
      const halfD = (bay.depth ?? 1.9) / 2
      const dx = posRef.current.x - bay.position[0]
      const dz = posRef.current.z - bay.position[2]
      const inside = Math.abs(dx) <= halfW - PARKING_MARGIN_X && Math.abs(dz) <= halfD - PARKING_MARGIN_Z
      const headingError = Math.atan2(
        Math.sin(headingRef.current - (bay.heading || 0)),
        Math.cos(headingRef.current - (bay.heading || 0)),
      )
      const aligned = Math.abs(headingError) <= (bay.headingTolerance ?? PARKING_ALIGN_TOLERANCE)

      let status
      let isParked = false
      if (!inside) status = 'Drive into the bay'
      else if (!aligned) status = 'Straighten up between the lines'
      else if (Math.abs(speedRef.current) > PARKING_SPEED_EPSILON) status = 'Come to a complete stop'
      else if (forkHeightRef.current > PARKING_FORK_MAX) status = 'Lower the forks (F)'
      else if (engineOnRef.current) status = 'Switch the engine off (E)'
      else {
        status = 'Parked - well done'
        isParked = true
        parkedRef.current = true
      }

      if (status !== parkingStatusRef.current || isParked) {
        parkingStatusRef.current = status
        onParkingUpdateRef.current?.(status, isParked)
      }
    }

    prevSpeedRef.current = speedRef.current

    if (typeof window !== 'undefined') {
      window.__drivingDebug = {
        x: posRef.current.x,
        z: posRef.current.z,
        heading: headingRef.current,
        speed: speedRef.current,
        forkHeight: forkHeightRef.current,
        steer: steerAngleRef.current,
        palletStates: palletSimRef.current?.map((sim) => sim.state) || [],
        carriedIndex: carriedIndexRef.current,
        deliveredCount: deliveredCountRef.current,
        failed: failedRef.current,
        tipAngle: tipStateRef.current.angle,
        parkingStatus: parkingStatusRef.current,
        parked: parkedRef.current,
      }
    }

    if (!freeCam) {
      backRef.current.set(-forwardX, 0, -forwardZ)
      desiredCamRef.current.copy(posRef.current).addScaledVector(backRef.current, 2.6)
      desiredCamRef.current.y += 1.5
      camera.position.lerp(desiredCamRef.current, 1 - Math.pow(0.0001, dt))
      lookTargetRef.current.set(posRef.current.x, posRef.current.y + 0.55, posRef.current.z)
      camera.lookAt(lookTargetRef.current)
    }

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

      {checkpoints.length === 0 && pallets.length === 1 && course.dropZone && (
        <PathBreadcrumbs points={[course.start?.position || [0, 0, 0], pallets[0].position, course.dropZone.position]} />
      )}

      {checkpoints.length === 0 && course.parkingBay && (
        <PathBreadcrumbs points={[course.start?.position || [0, 0, 0], course.parkingBay.position]} />
      )}

      {checkpoints.map((checkpoint, index) => (
        <CheckpointMarker
          key={checkpoint.id}
          checkpoint={checkpoint}
          status={index < checkpointIndex ? 'done' : index === checkpointIndex ? 'active' : 'pending'}
        />
      ))}

      {course.decorations && <CourseDecorations decorations={course.decorations} />}
      {liveCones.length > 0 && <ObstacleCones obstacles={liveCones} coneRefs={coneRefs} />}

      {pallets.map((palletDef, index) => (
        <Pallet
          key={palletDef.id || index}
          pallet={palletDef}
          palletRef={(el) => {
            palletRefs.current[index] = el
          }}
          overweight={typeof course.capacityKg === 'number' && (palletDef.weightKg ?? 0) > course.capacityKg}
        />
      ))}
      {course.dropZone && <DropZoneMarker zone={course.dropZone} delivered={palletState === 'delivered'} />}
      {course.parkingBay && <ParkingBayMarker bay={course.parkingBay} parked={parked} />}

      <group ref={forkliftGroupRef}>
        <group ref={tipPivotRef} position={[0, TIP_PIVOT_Y, TIP_PIVOT_Z]}>
          <group position={[0, -TIP_PIVOT_Y, -TIP_PIVOT_Z]}>
            <primitive object={forklift} />
          </group>
        </group>
      </group>

      {freeCam && <OrbitControls makeDefault enableDamping dampingFactor={0.15} minDistance={0.5} maxDistance={80} />}
    </>
  )
}

function DrivingSimulationInner({ modelUrl, course, onEvent, onRequestReset, className, isAdmin }) {
  const [freeCam, setFreeCam] = useState(false)
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
  const [palletState, setPalletState] = useState('ground')
  const [carriedLoad, setCarriedLoad] = useState(null)
  const [failInfo, setFailInfo] = useState(null)
  const failInfoRef = useRef(null)
  const [parkingStatus, setParkingStatus] = useState(course.parkingBay ? 'Drive into the bay' : null)
  const [parked, setParked] = useState(false)

  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const toggleEngine = () => {
    if (failInfoRef.current) return
    const next = !engineOnRef.current
    engineOnRef.current = next
    setEngineOn(next)
    onEventRef.current?.({ type: next ? 'engine-on' : 'engine-off' })
  }

  const handleFail = (reason) => {
    const info = FAIL_MESSAGES[reason] || { title: 'Attempt Failed', message: 'Reset the attempt and try again.' }
    failInfoRef.current = { reason, ...info }
    setFailInfo({ reason, ...info })
    setCarriedLoad(null)
    setTimeout(() => onEventRef.current?.({ type: 'sim-failed', reason, title: info.title, message: info.message }), 0)
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
        {course.pallet && (
          <span className="driving-checkpoint-badge">{PALLET_STATE_LABELS[palletState]}</span>
        )}
        {course.parkingBay && parkingStatus && (
          <span className={`driving-parking-badge ${parked ? 'done' : ''}`}>{parkingStatus}</span>
        )}
        {typeof course.capacityKg === 'number' && (
          <span className={`driving-load-badge ${carriedLoad != null && carriedLoad > course.capacityKg ? 'over' : ''}`}>
            {carriedLoad != null
              ? `Load ${carriedLoad.toLocaleString()} kg / ${course.capacityKg.toLocaleString()} kg`
              : `Capacity ${course.capacityKg.toLocaleString()} kg`}
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
            palletState={palletState}
            onPalletEvent={(event, nextState) => {
              setPalletState(nextState)
              if (event.type === 'pallet-lifted') setCarriedLoad(event.weightKg ?? null)
              if (event.type === 'pallet-dropped' || event.type === 'pallet-delivered') setCarriedLoad(null)
              setTimeout(() => onEventRef.current?.(event), 0)
            }}
            onFail={handleFail}
            parked={parked}
            onParkingUpdate={(status, isParked) => {
              setParkingStatus(status)
              if (isParked) {
                setParked(true)
                setTimeout(() => onEventRef.current?.({ type: 'parking-complete' }), 0)
              }
            }}
            freeCam={freeCam}
          />
        </Suspense>
      </Canvas>

      {failInfo && (
        <div className="driving-fail-overlay">
          <div className="driving-fail-card">
            <h3>{failInfo.title}</h3>
            <p>{failInfo.message}</p>
            <button type="button" className="driving-reset-button" onClick={onRequestReset}>
              <RotateCcw size={14} /> Reset Attempt
            </button>
          </div>
        </div>
      )}

      <div className="driving-hud-bottom">
        <button type="button" className="driving-reset-button" onClick={onRequestReset}>
          <RotateCcw size={14} /> Reset Attempt
        </button>
        {isAdmin && (
          <button
            type="button"
            className={`driving-reset-button ${freeCam ? 'is-active' : ''}`}
            onClick={() => setFreeCam((value) => !value)}
          >
            <Compass size={14} /> Free Cam {freeCam ? 'On' : 'Off'}
          </button>
        )}
        <div className="driving-keys">
          {KEY_LEGEND.map(({ key, caption }) => (
            <div key={key} className="driving-key-wrap">
              <span className={`driving-key ${pressed[key] ? 'active' : ''}`}>{key.toUpperCase()}</span>
              <span className="driving-key-caption">{caption}</span>
            </div>
          ))}
        </div>
        <p className="driving-hud-help">
          {engineOn
            ? 'Hold W to accelerate, S to brake or reverse, A / D to steer, R / F to raise or lower the forks.'
            : 'Press E to start the engine.'}
        </p>
      </div>
    </section>
  )
}

export default function DrivingSimulationViewer({ modelUrl = DEFAULT_MODEL_URL, course, onEvent, className = '', isAdmin = false }) {
  const [resetSeed, setResetSeed] = useState(0)

  return (
    <DrivingSimulationInner
      key={`${course.id}-${resetSeed}`}
      modelUrl={modelUrl}
      course={course}
      onEvent={onEvent}
      onRequestReset={() => setResetSeed((value) => value + 1)}
      className={className}
      isAdmin={isAdmin}
    />
  )
}

useGLTF.preload(DEFAULT_MODEL_URL)
useGLTF.preload(CONE_MODEL_URL)
useGLTF.preload(PALLET_MODEL_LIGHT_URL)
useGLTF.preload(PALLET_MODEL_MEDIUM_URL)
useGLTF.preload(PALLET_MODEL_HEAVY_URL)
useGLTF.preload(CARGO_BOX_MODEL_URL)
