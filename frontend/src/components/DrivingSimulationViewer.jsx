import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, Euler, Quaternion, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Compass, Eye, RotateCcw, Locate } from 'lucide-react'
import { buildVehicleRig, REAR_WHEEL_KEYS } from '../lib/vehicleRig'
import { clamp } from '../lib/math'
import { decorationType } from '../lib/courseEdit'
import { resolveCourseBounds } from '../lib/courseGoals'
import { DEFAULT_VEHICLE_MODEL_URL } from '../data/vehicleProfile'
import { resolveVehicleProfile } from '../lib/vehicleProfile'
import { evaluateForkEngagement, engagementRisk, gripQuality, slipThisFrame } from '../lib/loadPhysics'
import { distanceToOrientedRect, orientedRectOverlap, pointInOrientedRect, toRectLocal } from '../lib/simCollision'
import {
  LOAD_LAND_CLEARANCE,
  LOAD_TIP_HEIGHT,
  LOAD_TIP_TILT_RATIO,
  LOAD_TIP_WEIGHT_RATIO,
  PALLET_FALLBACK_FOOTPRINT,
  SLIP_FAIL_RATIO,
  TILT_RELEASE_ANGLE,
} from '../data/palletProfile'
import {
  DECOR_RACK_KINDS,
  RACK_FOOTPRINT,
  RACK_LEVEL_HEIGHTS,
  RACK_LEVEL_LABELS,
  RACK_LEVEL_TOLERANCE,
  RACK_LEVELS,
  RACK_MODEL_SCALE,
  RACK_MODEL_URL,
  RACK_PLACE_MAX_SPEED,
  RACK_SLOT_APPROACH_MARGIN,
  RACK_SLOT_HALF_WIDTH,
  RACK_SLOTS_BY_KIND,
  RACK_STRIKE_SPEED,
  rackSlotOffset,
} from '../data/rackProfile'
import './DrivingSimulationViewer.css'

const DEFAULT_MODEL_URL = DEFAULT_VEHICLE_MODEL_URL
// The forklift's own numbers, used whenever no profile is passed (the admin
// preview, mostly). resolveVehicleProfile() fills these in per equipment.
const DEFAULT_PROFILE = resolveVehicleProfile(null)

const CONE_MODEL_URL = '/models/traffic-cone.glb'
const PALLET_MODEL_LIGHT_URL = '/models/wooden-pallet.glb'
const PALLET_MODEL_MEDIUM_URL = '/models/plastic-pallet.glb'
const PALLET_MODEL_HEAVY_URL = '/models/cement-bag-pallet.glb'
const CARGO_BOX_MODEL_URL = '/models/cardboard-box.glb'
const CARGO_BOX_STACK_MODEL_URL = '/models/cardboard-box-stack.glb'

// Weight bands that pick which pallet prop renders for a course pallet.
const PALLET_LIGHT_MAX_KG = 500
const PALLET_HEAVY_MIN_KG = 1000

// Source assets come from mismatched free-asset scales/origins - each entry
// normalizes one to real-world size at this scene's world-units-are-metres/4
// convention (see vehicleRig.js) and re-centers it over its own group origin
// (measured via a throwaway inspect-glb.mjs bounding-box script).
const MODEL_TRANSFORM = {
  [CONE_MODEL_URL]: { scale: 0.00594, position: [0, 0, 0] }, // 0.7m cone
  [PALLET_MODEL_LIGHT_URL]: { scale: 0.15, position: [0.225, 0, 0] }, // 1.2m pallet
  [PALLET_MODEL_MEDIUM_URL]: { scale: 0.00245, position: [0, 0, 0] },
  [PALLET_MODEL_HEAVY_URL]: { scale: 0.25, position: [0, 0, 0] },
  [CARGO_BOX_MODEL_URL]: { scale: 0.25, position: [0, 0.0486, 0] },
  [CARGO_BOX_STACK_MODEL_URL]: { scale: 0.25, position: [0, 0, 0] },
  [RACK_MODEL_URL]: { scale: RACK_MODEL_SCALE, position: [0, 0, 0] },
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
// Raised from the original 0.3 so the carriage can clear the overhead guard
// and reach the rack's upper shelves - the rig has no baked ceiling of its
// own (mastLift/carriageLift are plain Group.position.y offsets, not morph
// or skeletal animation, see buildVehicleRig in lib/vehicleRig.js), so this
// is a gameplay/visual choice, not a model limit. FORK_SPEED is scaled up to
// match so a full raise still takes about the same time.
const FORK_MAX_HEIGHT = 0.8
const FORK_SPEED = 0.6
const MAST_LIFT_RATIO = 0.5
const FORK_TIP_OFFSET_FALLBACK = 0.6
const FORK_REACH_FALLBACK = 0.36

// Mast tilt: rotation.x on the rig's tiltPivot (see buildVehicleRig). Negative
// tilts the mast top back toward the operator (secures a carried load),
// positive tilts it forward (used to level the forks against a rack/floor
// before engaging a pallet). A load is only considered "secured" against a
// sudden-stop fail once tilted back past TILT_SECURE_ANGLE.
const TILT_MAX_ANGLE = 0.12
const TILT_SPEED = 0.5
const TILT_SECURE_ANGLE = -0.06

// Pallet pickup gameplay thresholds (no physics engine - see lib/loadPhysics.js
// for how far the forks are in, and data/palletProfile.js for the tiers it
// grades that against). These are the viewer's own fork-height gates.
const FORK_ENGAGE_HEIGHT = 0.05
const LIFT_THRESHOLD = 0.12
const CLEAR_DISTANCE = 0.8
// How far a carried pallet sits above the tines - just enough to keep the two
// surfaces from z-fighting.
const PALLET_CARRY_Y = 0

// Fail-condition "physics" (Module 4) - still kinematic, no physics engine.
// Tip-over pivots the whole truck about the front axle; dropped loads follow a
// simple ballistic arc; cones knock over about their base edge.
const TIP_PIVOT_Y = 0.08
const TIP_PIVOT_Z = 0.25
const TIP_GRAVITY_ACCEL = 2.4
const TIP_MAX_ANGLE = 1.15
const OVERLOAD_TIP_HEIGHT = 0.08
// The 0.7m cone's real base radius, at this scene's metres/4 convention.
// Combined with the truck's own footprint (FORKLIFT_HALF_WIDTH/LENGTH below)
// in the exact rectangle-vs-point cone check.
const CONE_RADIUS = 0.0375
const CONE_MIN_HIT_SPEED = 0.05
const CONE_FALL_SPEED = 6
const CONE_FALL_ANGLE = 1.45
const WALL_THICKNESS = 0.05 // matches CourseDecorations' wall boxGeometry
const WALL_HALF_THICKNESS = WALL_THICKNESS / 2
const WALL_HIT_MARGIN = 0.12
// Body footprint (half-extents) comes from the equipment's vehicle profile -
// width along local X, length along local Z, same convention as the wall
// rectangle check. The defaults are forklift.glb's measured chassis box.
// Solid objects the truck is stopped by rather than driven through: racking
// (which also fails the attempt, like a wall) and pallets sitting on the floor
// (which do not - driving into a pallet is how you pick one up). Racking is
// given a small margin so the body stops just clear of the uprights.
const RACK_HIT_MARGIN = 0.04
const PALLET_NUDGE_MAX = 0.02
// Above this the pallet is on a shelf or mid-fall, not an obstacle on the floor.
const PALLET_SOLID_MAX_Y = 0.1
const SUDDEN_STOP_DECEL = 1.6
const SUDDEN_STOP_MIN_SPEED = 0.85
// Standard travel height: forks should stay low and close to the ground while
// moving with a load. Above LIFT_THRESHOLD (0.12) so a normal pickup doesn't
// immediately trip it, well below FORK_MAX_HEIGHT (0.8) - exact value tuned
// for gameplay feel, not a real-world cm conversion.
const SAFE_TRAVEL_HEIGHT = 0.22
const HIGH_TRAVEL_MIN_SPEED = 0.4
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

const PALLET_STATE_LABELS = {
  ground: 'Pallet: On Ground',
  carried: 'Pallet: Carried',
  released: 'Pallet: Set Down',
  delivered: 'Pallet: Delivered',
}

// How well the forks are in, as the learner sees it. 'shallow' is lined up
// with a pallet but not far enough in to lift it; 'none' means no pallet is
// engaged at all, and hides the badge.
const GRIP_LABELS = {
  shallow: 'Forks not seated',
  partial: 'Partial grip',
  secure: 'Secure',
}

const TILT_LABELS = {
  back: 'Mast: Back',
  level: 'Mast: Level',
  forward: 'Mast: Forward',
}

function tiltStateName(angle) {
  if (angle <= TILT_SECURE_ANGLE) return 'back'
  if (angle >= TILT_RELEASE_ANGLE) return 'forward'
  return 'level'
}

function useDrivingInput(onEngineToggle, onKeyActive) {
  const keysRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    raise: false,
    lower: false,
    tiltBack: false,
    tiltForward: false,
  })
  const [pressed, setPressed] = useState({ w: false, a: false, s: false, d: false, e: false, r: false, f: false, t: false, g: false })
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
      if (!['w', 'a', 's', 'd', 'e', 'r', 'f', 't', 'g'].includes(key)) return
      event.preventDefault()
      if (key === 'w') keysRef.current.forward = true
      if (key === 's') keysRef.current.back = true
      if (key === 'a') keysRef.current.left = true
      if (key === 'd') keysRef.current.right = true
      if (key === 'r') keysRef.current.raise = true
      if (key === 'f') keysRef.current.lower = true
      if (key === 't') keysRef.current.tiltBack = true
      if (key === 'g') keysRef.current.tiltForward = true
      if (key === 'e' && !event.repeat) onEngineToggleRef.current?.()
      setPressed((current) => {
        if (current[key]) return current
        if (key !== 'e') onKeyActiveRef.current?.(key)
        return { ...current, [key]: true }
      })
    }

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'e', 'r', 'f', 't', 'g'].includes(key)) return
      if (key === 'w') keysRef.current.forward = false
      if (key === 's') keysRef.current.back = false
      if (key === 'a') keysRef.current.left = false
      if (key === 'd') keysRef.current.right = false
      if (key === 'r') keysRef.current.raise = false
      if (key === 'f') keysRef.current.lower = false
      if (key === 't') keysRef.current.tiltBack = false
      if (key === 'g') keysRef.current.tiltForward = false
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
        <Html center position={[0, 1.5, 0]} distanceFactor={8}>
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

// Half-extents of a prop's model, in world units, measured off the source GLTF
// and scaled by its MODEL_TRANSFORM entry. Same idea as buildVehicleRig
// deriving forkTipOffset from the carriage's bounding box: the number that
// matters is the model's, so read it from the model rather than restating it
// as a constant that silently goes stale when the asset is swapped.
const footprintCache = new Map()

function modelFootprint(url, scene) {
  if (footprintCache.has(url)) return footprintCache.get(url)
  const { scale } = MODEL_TRANSFORM[url] || {}
  const scaleX = Array.isArray(scale) ? scale[0] : (scale ?? 1)
  const scaleZ = Array.isArray(scale) ? scale[2] : (scale ?? 1)
  const box = new Box3().setFromObject(scene)
  const footprint = Number.isFinite(box.max.x) && Number.isFinite(box.max.z)
    ? {
        halfWidth: ((box.max.x - box.min.x) / 2) * scaleX,
        halfDepth: ((box.max.z - box.min.z) / 2) * scaleZ,
      }
    : { ...PALLET_FALLBACK_FOOTPRINT }
  footprintCache.set(url, footprint)
  return footprint
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

// Static parked vehicle used as a parking obstacle (park-between-vehicles
// scenario) - the profile's parked model, just not wired to the rig/keys.
function ParkedVehicle({ position, rotation, modelUrl }) {
  const { scene } = useGLTF(modelUrl || DEFAULT_MODEL_URL)
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

// Background-dressing rack: same model/scale as the functional rack (see
// data/rackProfile.js), plus a pallet+box on whichever slots RACK_SLOTS_BY_KIND
// gives its type - 'rack-empty' gets none. Purely a `decorations` entry: no
// id, no target, not graded. It is still solid, though - dressing the course
// with racking the truck can drive through would teach the wrong clearance.
function DecorRack({ type, position, rotation }) {
  const boxUrl = type === 'rack-loaded' ? CARGO_BOX_STACK_MODEL_URL : CARGO_BOX_MODEL_URL
  return (
    <group position={[position[0], position[1] ?? 0, position[2]]} rotation={[0, rotation || 0, 0]}>
      <ModelProp url={RACK_MODEL_URL} />
      {(RACK_SLOTS_BY_KIND[type] || []).map((slot, index) => {
        const [x, y, z] = rackSlotOffset(slot)
        return (
          <group key={index} position={[x, y, z]}>
            <ModelProp url={PALLET_MODEL_LIGHT_URL} />
            <group position={[0, PALLET_DECK_Y[PALLET_MODEL_LIGHT_URL], 0]}>
              <ModelProp url={boxUrl} />
            </group>
          </group>
        )
      })}
    </group>
  )
}

// Renders decorative course furniture. Cones are not handled here - they're
// unified with course.obstacles into `liveCones` so every rendered cone is a
// live collider (see DrivingScene), rendered once via <ObstacleCones>.
function CourseDecorations({ decorations, parkedModelUrl }) {
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

        if (decorationType(item) === 'vehicle') {
          return (
            <ParkedVehicle
              key={index}
              modelUrl={parkedModelUrl}
              position={[item.position[0], item.position[1] ?? 0, item.position[2]]}
              rotation={item.rotation}
            />
          )
        }

        if (RACK_SLOTS_BY_KIND[item.type]) {
          return <DecorRack key={index} type={item.type} position={item.position} rotation={item.rotation} />
        }

        return null
      })}
    </group>
  )
}

function Pallet({ pallet, palletRef, overweight = false, onMeasure }) {
  const modelUrl = palletModelForWeight(pallet.weightKg)
  const cargoDeckY = PALLET_DECK_Y[modelUrl]
  const { scene } = useGLTF(modelUrl)
  const onMeasureRef = useRef(onMeasure)
  useEffect(() => {
    onMeasureRef.current = onMeasure
  }, [onMeasure])

  // The frame loop needs this pallet's real half-extents for both the fork
  // insertion maths and the solid-obstacle test, so report them up once the
  // model is in.
  useEffect(() => {
    onMeasureRef.current?.(modelFootprint(modelUrl, scene))
  }, [modelUrl, scene])

  return (
    <group ref={palletRef} position={[pallet.position[0], 0, pallet.position[2]]} rotation={[0, pallet.rotation || 0, 0]}>
      <ModelProp url={modelUrl} />
      {cargoDeckY != null && (
        <group position={[0, cargoDeckY, 0]}>
          <ModelProp url={CARGO_BOX_MODEL_URL} />
        </group>
      )}
      {typeof pallet.weightKg === 'number' && (
        <Html center position={[0, 0.85, 0]} distanceFactor={5}>
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

// Static racking props. Solid: the truck body is blocked by, and fails
// against, a rack's footprint (see rackProfile.js). Only the forks reach into
// a bay, which is enough to place a pallet because the body stops roughly a
// fork-length short of the shelf.
function CourseRacks({ racks }) {
  return (
    <group>
      {racks.map((rack, index) => (
        <group
          key={rack.id || index}
          position={[rack.position[0], rack.position[1] ?? 0, rack.position[2]]}
          rotation={[0, rack.rotation || 0, 0]}
        >
          <ModelProp url={RACK_MODEL_URL} />
        </group>
      ))}
    </group>
  )
}

// One target ring per pallet assigned to a rack level - the racking
// equivalent of DropZoneMarker, just floating at the shelf's height instead
// of sitting on the ground.
function RackLevelMarker({ rack, level, delivered }) {
  const ringMaterialRef = useRef(null)
  const height = RACK_LEVEL_HEIGHTS[level] ?? 0

  useFrame(({ clock }) => {
    if (ringMaterialRef.current && !delivered) {
      ringMaterialRef.current.opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.25
    }
  })

  return (
    <group position={[rack.position[0], height, rack.position[2]]} rotation={[0, rack.rotation || 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[Math.max(RACK_SLOT_HALF_WIDTH - 0.06, 0.05), RACK_SLOT_HALF_WIDTH, 40]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={delivered ? '#22c55e' : '#a855f7'}
          transparent
          opacity={delivered ? 0.85 : 0.55}
          side={DoubleSide}
        />
      </mesh>
      {!delivered && (
        <Html center position={[0, 0.32, 0]} distanceFactor={4}>
          <div className="driving-checkpoint-label active">{RACK_LEVEL_LABELS[level] || level}</div>
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
  profile,
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
  onHudSample,
  palletState,
  onPalletEvent,
  onFail,
  parked,
  onParkingUpdate,
  freeCam,
  firstPerson,
  camAdjustedRef,
}) {
  const { scene } = useGLTF(profile.modelUrl)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const halfWidth = profile.footprint.halfWidth
  const halfLength = profile.footprint.halfLength
  const rigRef = useRef(null)
  const { camera } = useThree()
  const vehicleOrbitRef = useRef(null)
  const seatWorldRef = useRef(new Vector3())
  const seatLookRef = useRef(new Vector3())
  const orbitTargetRef = useRef(new Vector3())
  const prevOrbitTargetRef = useRef(new Vector3())
  const orbitDeltaRef = useRef(new Vector3())
  const checkpoints = course.checkpoints || []
  const { halfWidth: groundHalfWidth, minZ: courseMinZ, maxZ: courseMaxZ } = useMemo(
    () => resolveCourseBounds(course),
    [course],
  )
  const pallets = useMemo(() => course.pallets || (course.pallet ? [course.pallet] : []), [course])
  const racks = useMemo(() => course.racks || [], [course])
  // Every rendered cone is a live collider, whether authored under
  // `obstacles` or as a `decorations` lane/gate marker - a cone is a hazard
  // regardless of which list placed it.
  const liveCones = useMemo(
    () => [...(course.obstacles || []), ...(course.decorations || []).filter((item) => item.type === 'cone')],
    [course],
  )
  const liveWalls = useMemo(
    () => (course.decorations || []).filter((item) => item.type === 'wall' || decorationType(item) === 'vehicle'),
    [course],
  )
  // Racking is solid, functional and decorative alike, so both lists become
  // the same kind of oriented rectangle for the collision test.
  const rackColliders = useMemo(
    () =>
      [...racks, ...(course.decorations || []).filter((item) => DECOR_RACK_KINDS.includes(item.type))].map((item) => ({
        x: item.position[0],
        z: item.position[2],
        rotation: item.rotation || 0,
        halfX: RACK_FOOTPRINT.halfWidth,
        halfZ: RACK_FOOTPRINT.halfDepth,
      })),
    [racks, course],
  )

  useEffect(() => {
    rigRef.current = buildVehicleRig(forklift, profile.rig)
  }, [forklift, profile.rig])

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

  // Nose, middle and tail of the body, along its own centreline: the points
  // the wall check samples. Derived from the footprint so a profile with a
  // different body length samples its own ends, not the forklift's.
  const bodySampleOffsets = useMemo(() => [halfLength, 0, -halfLength], [halfLength])

  const hudAccumRef = useRef(0)
  const backRef = useRef(new Vector3())
  const desiredCamRef = useRef(new Vector3())
  const lookTargetRef = useRef(new Vector3())

  const forkHeightRef = useRef(0)
  const tiltAngleRef = useRef(0)
  const steerAngleRef = useRef(0)
  const palletRefs = useRef([])
  const palletSimRef = useRef(null)
  const palletFootprintsRef = useRef([])
  const bodyRectRef = useRef({ x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 })
  const palletRectRef = useRef({ x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 })
  const gripLocalRef = useRef(new Vector3())
  const palletEulerRef = useRef(new Euler(0, 0, 0, 'YXZ'))
  const gripQuatRef = useRef(new Quaternion())
  const carriageQuatRef = useRef(new Quaternion())
  const gripQualityRef = useRef('none')
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
      if (typeof patch.tilt === 'number') tiltAngleRef.current = clamp(patch.tilt, -TILT_MAX_ANGLE, TILT_MAX_ANGLE)
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
    const nextX = clamp(posRef.current.x + forwardX * speedRef.current * dt, -groundHalfWidth, groundHalfWidth)
    const nextZ = clamp(posRef.current.z + forwardZ * speedRef.current * dt, courseMinZ, courseMaxZ)

    // Solid objects stop the truck rather than let it drive through. Racking
    // also fails the attempt - it is structure, and only the forks belong
    // inside a bay. A pallet does not fail, because driving into one is how
    // the forks go in: it lets the tines through when the approach is square
    // and low, blocks once they have bottomed out against the carriage, and
    // gets shoved aside when the truck hits it off-square.
    const body = bodyRectRef.current
    body.x = nextX
    body.z = nextZ
    body.rotation = headingRef.current
    body.halfX = halfWidth
    body.halfZ = halfLength

    // Only a move that pushes *deeper* into an object is rejected. Testing raw
    // overlap instead would trap the truck the moment it ended up inside
    // something - most easily right after setting a pallet down, where it is
    // standing on top of the load it just released and still has to reverse
    // clear of it.
    const worsensOverlap = (rect, margin = 0) => {
      const next = orientedRectOverlap(body, rect, margin)
      if (!next) return null
      body.x = posRef.current.x
      body.z = posRef.current.z
      const now = orientedRectOverlap(body, rect, margin)
      body.x = nextX
      body.z = nextZ
      return !now || next.depth > now.depth + 1e-4 ? next : null
    }

    let blocked = false

    for (const rack of rackColliders) {
      if (!worsensOverlap(rack, RACK_HIT_MARGIN)) continue
      blocked = true
      // Placing a load on a shelf puts the truck's nose at the rack's face on
      // purpose, so touching it while creeping only stops the truck. Above
      // RACK_STRIKE_SPEED it is a strike, and racking is structure.
      if (Math.abs(speedRef.current) > RACK_STRIKE_SPEED) triggerFail('rack')
      break
    }

    if (!blocked && pallets.length) {
      const tipOffset = rigRef.current?.forkTipOffset || FORK_TIP_OFFSET_FALLBACK
      const tipReach = rigRef.current?.forkReach || FORK_REACH_FALLBACK
      for (let i = 0; i < pallets.length; i += 1) {
        const pallet = palletRefs.current[i]
        if (!pallet || palletSimRef.current?.[i]?.state === 'carried') continue
        // A pallet up on a shelf, or still in the air, is not in the way.
        if (pallet.position.y > PALLET_SOLID_MAX_Y) continue

        const palletHalf = palletFootprintsRef.current[i] || PALLET_FALLBACK_FOOTPRINT
        const rect = palletRectRef.current
        rect.x = pallet.position.x
        rect.z = pallet.position.z
        rect.rotation = pallet.rotation.y
        rect.halfX = palletHalf.halfWidth
        rect.halfZ = palletHalf.halfDepth

        const hit = worsensOverlap(rect)
        if (!hit) continue

        const engagement = evaluateForkEngagement({
          palletX: rect.x,
          palletZ: rect.z,
          palletRot: rect.rotation,
          palletHalf,
          vehicleX: nextX,
          vehicleZ: nextZ,
          heading: headingRef.current,
          forkTipOffset: tipOffset,
          forkReach: tipReach,
        })
        const forksEntering =
          profile.hasForks && engagement.canEnter && forkHeightRef.current <= FORK_ENGAGE_HEIGHT

        if (forksEntering && engagement.insertDepth < engagement.seatedDepth) continue

        blocked = true
        if (!forksEntering) {
          const push = Math.min(hit.depth, PALLET_NUDGE_MAX)
          pallet.position.x -= hit.axisX * push
          pallet.position.z -= hit.axisZ * push
        }
        break
      }
    }

    if (blocked) {
      speedRef.current = 0
    } else {
      posRef.current.x = nextX
      posRef.current.z = nextZ
    }

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
        if (profile.hasForks && rig.tiltPivot) {
          if (keys.tiltBack) {
            tiltAngleRef.current = Math.max(tiltAngleRef.current - TILT_SPEED * dt, -TILT_MAX_ANGLE)
          } else if (keys.tiltForward) {
            tiltAngleRef.current = Math.min(tiltAngleRef.current + TILT_SPEED * dt, TILT_MAX_ANGLE)
          }
        }
      }
      if (rig.carriageLift) rig.carriageLift.position.y = forkHeightRef.current
      if (rig.mastLift) rig.mastLift.position.y = forkHeightRef.current * MAST_LIFT_RATIO
      if (rig.tiltPivot) rig.tiltPivot.rotation.x = tiltAngleRef.current
    }

    // Overload tip-over: pitch the whole truck about the front axle with an
    // accelerating fall until the forks hit the ground.
    const tip = tipStateRef.current
    if (tip.active && tip.angle < TIP_MAX_ANGLE) {
      tip.vel += TIP_GRAVITY_ACCEL * dt
      tip.angle = Math.min(tip.angle + tip.vel * dt, TIP_MAX_ANGLE)
      if (tipPivotRef.current) tipPivotRef.current.rotation.x = tip.angle
    }

    // Cone collision: exact point-vs-oriented-rectangle test (cone position
    // against the truck's own footprint), the same technique the wall check
    // below uses. The old approach approximated the rectangular body as three
    // fixed-radius circles along the centerline (BODY_SAMPLE_OFFSETS) - that
    // overshot the body right at each sample point but left gaps directly
    // between them, so a hit felt too generous or too strict depending on
    // exactly where along the body the cone lined up. A hit knocks the cone
    // over and fails the attempt. Always on - a cone is a hazard however the
    // course authored it.
    if (liveCones.length && !failedRef.current && Math.abs(speedRef.current) > CONE_MIN_HIT_SPEED) {
      if (!coneSimRef.current) coneSimRef.current = liveCones.map(() => ({ hit: false, angle: 0, dirX: 0, dirZ: 1 }))
      const coneSims = coneSimRef.current
      body.x = posRef.current.x
      body.z = posRef.current.z
      for (let i = 0; i < liveCones.length && !failedRef.current; i += 1) {
        const cone = liveCones[i]
        if (coneSims[i].hit) continue
        const dx = cone.position[0] - posRef.current.x
        const dz = cone.position[2] - posRef.current.z
        if (distanceToOrientedRect(cone.position[0], cone.position[2], body) <= CONE_RADIUS) {
          const len = Math.hypot(dx, dz) || 1
          coneSims[i] = { hit: true, angle: 0, dirX: dx / len, dirZ: dz / len }
          triggerFail('cone')
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

    // Wall/vehicle collision: sample the same body points against every
    // decoration's oriented rectangle (thickness x length, or a parked
    // vehicle's footprint). Immovable, so a hit just fails the attempt.
    if (liveWalls.length && !failedRef.current && Math.abs(speedRef.current) > CONE_MIN_HIT_SPEED) {
      const wallRect = palletRectRef.current
      wallLoop: for (const wall of liveWalls) {
        const isVehicle = decorationType(wall) === 'vehicle'
        wallRect.x = wall.position[0]
        wallRect.z = wall.position[2]
        wallRect.rotation = wall.rotation || 0
        wallRect.halfX = isVehicle ? halfWidth : WALL_HALF_THICKNESS
        wallRect.halfZ = isVehicle ? halfLength : (wall.length || 3) / 2
        for (const offset of bodySampleOffsets) {
          const sampleX = posRef.current.x + forwardX * offset
          const sampleZ = posRef.current.z + forwardZ * offset
          if (pointInOrientedRect(sampleX, sampleZ, wallRect, WALL_HIT_MARGIN)) {
            triggerFail(isVehicle ? 'vehicle' : 'wall')
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

    // Pallet pickup/carry/release. Still kinematic, no physics engine, but
    // lib/loadPhysics.js now grades how far the forks actually went in and how
    // squarely, and that grade decides whether the load survives being thrown
    // about. Multi-pallet aware: only one pallet can be carried at a time, and
    // a course's `capacityKg`/`failConditions` layer the overload, slip and
    // tip-over rules on top of the module-2 flow.
    if (pallets.length) {
      if (!palletSimRef.current) {
        palletSimRef.current = pallets.map(() => ({
          state: 'ground',
          engaged: false,
          vx: 0,
          vy: 0,
          vz: 0,
          risk: 0,
          grip: null,
          slipCause: null,
          landed: false,
          restY: 0,
        }))
      }
      const capacity = typeof course.capacityKg === 'number' ? course.capacityKg : Infinity
      const failConditions = course.failConditions || {}
      const attachOffset = rig?.forkTipOffset || FORK_TIP_OFFSET_FALLBACK
      const attachReach = rig?.forkReach || FORK_REACH_FALLBACK
      const tipX = posRef.current.x + forwardX * attachOffset
      const tipZ = posRef.current.z + forwardZ * attachOffset
      const decel = prevSpeed > SUDDEN_STOP_MIN_SPEED ? (prevSpeed - speedRef.current) / dt : 0
      const brakingHard = decel > SUDDEN_STOP_DECEL
      const turnLoad = Math.abs(turnInput) * Math.abs(speedRef.current)
      let liveQuality = 'none'
      // Racking blocks the truck body, so the fork tip can only ever reach a
      // little way past the rack's front face - and how far depends on the
      // vehicle, since a short fork on a long body reaches less. Derive the
      // depth the slot accepts from that geometry rather than trusting a fixed
      // margin, or a vehicle profile with a shorter fork could never deliver.
      const slotReach =
        RACK_FOOTPRINT.halfDepth +
        Math.max(RACK_SLOT_APPROACH_MARGIN, halfLength + RACK_HIT_MARGIN - attachOffset + 0.05)

      // A carried pallet is pinned to the carriage rather than chased toward a
      // point in front of the truck: its pose is captured in the carriage's own
      // local frame the moment it lifts, then replayed from that node's world
      // matrix every frame. The carriage sits under the tilt pivot (see
      // lib/vehicleRig.js), so one matrix already carries the truck's position
      // and heading, the fork height and the mast tilt. The load therefore
      // stays exactly where it was picked up - including a shallow or
      // off-centre bite - and pitches with the mast, with no lag.
      const carriage = rig?.carriageLift || null

      const captureGrip = (pallet, engagement) => {
        if (!carriage) return { local: null, quat: null, insertDepth: engagement.insertDepth, seatedDepth: engagement.seatedDepth }
        carriage.updateWorldMatrix(true, false)
        pallet.updateWorldMatrix(true, false)
        carriage.getWorldQuaternion(carriageQuatRef.current)
        const world = pallet.getWorldPosition(gripLocalRef.current)
        // Only the *bite* is captured - how far in along the tines and how far
        // off their centreline the pallet is. Its height is the tines
        // themselves: measure from the deck it is being picked off rather than
        // from wherever the forks have already lifted or pitched it to, or that
        // head start is baked into the grip and the load rides that far above
        // the tines for the rest of the carry.
        world.y = 0
        const local = carriage.worldToLocal(world).clone()
        // Undo however far the carriage has already lifted: lift travels along
        // the carriage's local +Y (up the tilted mast), so this is its exact
        // inverse, and leaves an offset that holds at any fork height.
        local.y += forkHeightRef.current + PALLET_CARRY_Y
        return {
          local,
          quat: carriageQuatRef.current.clone().invert().multiply(pallet.getWorldQuaternion(gripQuatRef.current)),
          insertDepth: engagement.insertDepth,
          seatedDepth: engagement.seatedDepth,
        }
      }

      const applyGrip = (pallet, grip) => {
        if (carriage && grip?.local) {
          carriage.updateWorldMatrix(true, false)
          carriage.getWorldQuaternion(carriageQuatRef.current)
          pallet.position.copy(grip.local).applyMatrix4(carriage.matrixWorld)
          pallet.quaternion.copy(carriageQuatRef.current).multiply(grip.quat)
          return
        }
        // No carriage node in this vehicle's rig: pin the load to the fork tip
        // point instead. Same result minus lift and tilt, neither of which such
        // a model animates anyway.
        pallet.position.set(tipX, forkHeightRef.current + PALLET_CARRY_Y, tipZ)
        pallet.rotation.set(0, headingRef.current, 0)
      }

      // A load resting on the floor or a shelf is held up by that surface, not
      // by the tines. It keeps its own yaw, pitches only with a mast tilted
      // *back* - tilting forward would drive its far edge through the deck -
      // and rises just enough to keep its near edge on the surface as it does.
      const settleLoad = (pallet, surfaceY, halfDepth, pitch) => {
        palletEulerRef.current.setFromQuaternion(pallet.quaternion, 'YXZ')
        const yaw = palletEulerRef.current.y
        pallet.rotation.order = 'YXZ'
        pallet.rotation.set(pitch, yaw, 0)
        pallet.position.y = surfaceY + halfDepth * Math.sin(-pitch)
      }

      // How much of the mast's tilt a supported load actually shows.
      const restingPitch = () => Math.min(tiltAngleRef.current, 0)

      // What is under a carried load: the shelf it is lined up with, or the
      // floor. Only a level the load has already been raised above counts, so
      // lowering past one shelf settles on the next one down rather than
      // snapping back up to the one it just cleared.
      const supportHeight = (loadY, inSlot) => {
        if (!inSlot) return 0
        let best = 0
        for (const level of RACK_LEVELS) {
          const height = RACK_LEVEL_HEIGHTS[level] ?? 0
          if (height <= loadY + RACK_LEVEL_TOLERANCE && height > best) best = height
        }
        return best
      }

      const dropLoad = (pallet, sim, reason, launchSpeed) => {
        sim.state = 'falling'
        sim.grip = null
        sim.engaged = false
        carriedIndexRef.current = -1
        sim.vx = forwardX * launchSpeed
        sim.vz = forwardZ * launchSpeed
        sim.vy = 0.1
        triggerFail(reason)
      }

      pallets.forEach((palletDef, i) => {
        const pallet = palletRefs.current[i]
        const sim = palletSimRef.current[i]
        if (!pallet || !sim) return
        const palletHalf = palletFootprintsRef.current[i] || PALLET_FALLBACK_FOOTPRINT

        if ((sim.state === 'ground' || sim.state === 'released') && carriedIndexRef.current === -1 && !failedRef.current) {
          const engagement = evaluateForkEngagement({
            palletX: pallet.position.x,
            palletZ: pallet.position.z,
            palletRot: pallet.rotation.y,
            palletHalf,
            vehicleX: posRef.current.x,
            vehicleZ: posRef.current.z,
            heading: headingRef.current,
            forkTipOffset: attachOffset,
            forkReach: attachReach,
          })
          const forksDown = forkHeightRef.current <= FORK_ENGAGE_HEIGHT

          // Engagement latches: the forks have to go in with the carriage down,
          // but raising them from there must not undo it - the learner passes
          // through FORK_ENGAGE_HEIGHT on the way to LIFT_THRESHOLD. It only
          // clears when the pallet stops being forkable at all, which also
          // freezes `risk` at the quality the forks actually went in with.
          if (engagement.canLift && forksDown) {
            sim.engaged = true
            sim.risk = engagementRisk(engagement)
          } else if (!engagement.canLift) {
            sim.engaged = false
            sim.risk = 0
            sim.grip = null
          }

          if (sim.engaged) {
            // Keep the grip current right up until the load leaves the ground,
            // so it lifts from exactly where it is sitting. Capturing it only
            // at the lift threshold would record the carriage already raised
            // and pin the pallet to the floor.
            sim.grip = captureGrip(pallet, engagement)
            liveQuality = gripQuality({ risk: sim.risk, canLift: true })
            // Tines in, load still on the deck: it already answers the mast.
            // Raising the carriage lifts it, and tilting back rolls its outer
            // edge up off the floor - which is exactly why an operator tilts
            // back before travelling, so it has to be visible here.
            settleLoad(pallet, forkHeightRef.current + PALLET_CARRY_Y, palletHalf.halfDepth, restingPitch())
          } else if (engagement.canEnter && forksDown && engagement.insertDepth > 0) {
            liveQuality = 'shallow'
          }

          if (sim.engaged && engineOnRef.current) {
            const overweight = (palletDef.weightKg ?? 0) > capacity
            if (failConditions.overload && overweight && forkHeightRef.current >= OVERLOAD_TIP_HEIGHT) {
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
              sim.slipCause = null
              carriedIndexRef.current = i
              onPalletEvent({ type: 'pallet-lifted', palletId: palletDef.id, weightKg: palletDef.weightKg }, 'carried')
            }
          }
        } else if (sim.state === 'carried') {
          liveQuality = gripQuality({ risk: sim.risk, canLift: true })

          // Rack-targeted pallets place directly from the carried state: the
          // learner holds the pallet at the target shelf's height, drives it
          // into the bay and tilts the mast forward to set it down, rather than
          // lowering to the ground like a dropZone delivery - a shelf is
          // elevated, so there is no "lower to release" step.
          const targetRack = palletDef.targetRack ? racks.find((rack) => rack.id === palletDef.targetRack) : null
          const targetHeight = targetRack && palletDef.targetLevel ? RACK_LEVEL_HEIGHTS[palletDef.targetLevel] : null
          const rackRot = targetRack?.rotation || 0
          // Lined up with the bay at any height is what puts a shelf under the
          // load instead of the floor; being at the *target* level as well is
          // what makes setting it down a delivery. The set-down itself happens
          // in the carry branch below, so the floor and the shelf are one rule.
          let inSlotRect = false
          let atTargetSlot = false

          if (targetRack && targetHeight != null) {
            const slot = toRectLocal(tipX, tipZ, { x: targetRack.position[0], z: targetRack.position[2], rotation: rackRot })
            inSlotRect = Math.abs(slot.x) <= RACK_SLOT_HALF_WIDTH && Math.abs(slot.z) <= slotReach
            atTargetSlot = inSlotRect && Math.abs(forkHeightRef.current - targetHeight) <= RACK_LEVEL_TOLERANCE
          }

          // Lined up at the target shelf, tilting forward is the correct move -
          // exempt it, or storing a heavy pallet up high would be impossible
          // whenever the tip-over rule is on.
          const tipsForward =
            failConditions.loadTipping &&
            !failedRef.current &&
            !atTargetSlot &&
            !sim.landed &&
            profile.hasForks &&
            forkHeightRef.current > LOAD_TIP_HEIGHT &&
            tiltAngleRef.current >= TILT_MAX_ANGLE * LOAD_TIP_TILT_RATIO &&
            (palletDef.weightKg ?? 0) > capacity * LOAD_TIP_WEIGHT_RATIO

          if (tipsForward) {
            // A heavy load, high up and tilted forward, puts the combined
            // centre of gravity past the front wheels.
            tipStateRef.current.active = true
            dropLoad(pallet, sim, 'load-tipping', Math.abs(speedRef.current) + 0.4)
          } else if (
            failConditions.highTravel &&
            !failedRef.current &&
            Math.abs(speedRef.current) > HIGH_TRAVEL_MIN_SPEED &&
            forkHeightRef.current > SAFE_TRAVEL_HEIGHT
          ) {
            // Driving at speed with the forks raised above standard travel
            // height: unsafe practice, not a physical spill - fail in place.
            triggerFail('high-travel')
          } else {
            // A partially engaged load creeps out along the tines when the
            // truck is braked hard, swung round or carried with the mast not
            // tilted back. A load seated to the carriage and square has risk 0
            // and never moves, which is the habit the step is teaching.
            if (!failedRef.current && sim.grip && !sim.landed) {
              const { slip, cause } = slipThisFrame({
                risk: sim.risk,
                tiltAngle: tiltAngleRef.current,
                tiltSecureAngle: TILT_SECURE_ANGLE,
                decel: brakingHard ? decel : 0,
                turnLoad,
                dt,
                enabled: failConditions,
              })
              if (slip > 0) {
                sim.grip.insertDepth = Math.max(sim.grip.insertDepth - slip, 0)
                // The carriage's local +Z runs out along the forks, so losing
                // insertion depth slides the pallet toward the tips.
                if (sim.grip.local) sim.grip.local.z += slip
                sim.slipCause = cause
              }
            }

            const depthRatio = sim.grip?.seatedDepth > 0 ? sim.grip.insertDepth / sim.grip.seatedDepth : 1

            if (!failedRef.current && sim.grip && depthRatio < SLIP_FAIL_RATIO) {
              dropLoad(pallet, sim, sim.slipCause || 'load-dropped', Math.max(Math.abs(prevSpeed), 0.35) * 1.15)
            } else {
              applyGrip(pallet, sim.grip)

              // Setting a load down is two moves, on the floor and on a shelf
              // alike: lower it until the surface takes its weight, then tilt
              // the mast forward to let it off the tines. Between the two the
              // pallet is landed - it stops following the forks down and sits
              // on whatever is holding it up while the forks keep moving.
              // A surface that has taken the load keeps it until the forks
              // raise it clear again. Re-deriving the support from the load's
              // live height every frame would let tilting the mast forward -
              // which drops it a few centimetres - sink it straight through
              // the shelf it is already resting on, which is exactly the move
              // that is supposed to release it.
              const holding = sim.landed && (inSlotRect || sim.restY === 0)
              const surfaceY = holding ? sim.restY : supportHeight(pallet.position.y, inSlotRect)
              sim.landed = pallet.position.y <= surfaceY + LOAD_LAND_CLEARANCE

              if (sim.landed) {
                sim.restY = surfaceY
                settleLoad(pallet, surfaceY, palletHalf.halfDepth, restingPitch())

                const tiltedForward = !profile.hasForks || tiltAngleRef.current >= TILT_RELEASE_ANGLE
                const onTargetShelf = targetHeight != null && Math.abs(surfaceY - targetHeight) < 1e-3
                const steady = !onTargetShelf || Math.abs(speedRef.current) <= RACK_PLACE_MAX_SPEED

                if (tiltedForward && steady && !failedRef.current) {
                  sim.grip = null
                  sim.engaged = false
                  sim.landed = false
                  carriedIndexRef.current = -1
                  settleLoad(pallet, surfaceY, palletHalf.halfDepth, 0)

                  if (onTargetShelf) {
                    // Square the delivered pallet up in its bay. The truck body
                    // is stopped at the rack's face, so the load comes off the
                    // tines at the mouth of the shelf rather than over its
                    // middle - the only place they can reach.
                    sim.state = 'delivered'
                    pallet.position.set(targetRack.position[0], targetHeight, targetRack.position[2])
                    pallet.rotation.set(0, rackRot, 0)
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
                  } else {
                    sim.state = 'released'
                    onPalletEvent({ type: 'pallet-dropped', palletId: palletDef.id }, 'released')
                  }
                }
              }
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

      gripQualityRef.current = liveQuality
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

    if (import.meta.env.DEV && typeof window !== 'undefined') {
      window.__drivingDebug = {
        x: posRef.current.x,
        z: posRef.current.z,
        heading: headingRef.current,
        speed: speedRef.current,
        forkHeight: forkHeightRef.current,
        tilt: tiltAngleRef.current,
        steer: steerAngleRef.current,
        grip: gripQualityRef.current,
        palletStates: palletSimRef.current?.map((sim) => sim.state) || [],
        palletRisks: palletSimRef.current?.map((sim) => sim.risk) || [],
        palletInsertDepths: palletSimRef.current?.map((sim) => sim.grip?.insertDepth ?? null) || [],
        palletHeights: palletRefs.current.map((pallet) => pallet?.position.y ?? null),
        palletLanded: palletSimRef.current?.map((sim) => Boolean(sim.landed)) || [],
        carriedIndex: carriedIndexRef.current,
        deliveredCount: deliveredCountRef.current,
        failed: failedRef.current,
        tipAngle: tipStateRef.current.angle,
        parkingStatus: parkingStatusRef.current,
        parked: parkedRef.current,
      }
    }

    if (firstPerson) {
      const [seatX, seatY, seatZ] = profile.rig.cabin.seatOffset
      seatWorldRef.current.set(
        posRef.current.x + seatX * forwardZ + seatZ * forwardX,
        posRef.current.y + seatY,
        posRef.current.z - seatX * forwardX + seatZ * forwardZ,
      )
      seatLookRef.current.set(
        seatWorldRef.current.x + forwardX * 5,
        seatWorldRef.current.y,
        seatWorldRef.current.z + forwardZ * 5,
      )
      camera.position.copy(seatWorldRef.current)
      camera.lookAt(seatLookRef.current)
    } else if (!freeCam) {
      orbitTargetRef.current.set(posRef.current.x, posRef.current.y + 0.55, posRef.current.z)
      if (camAdjustedRef.current) {
        // The user has orbited by hand: OrbitControls only re-aims at a moved
        // target, it does not reposition the camera - so carry the camera by
        // the same delta the vehicle moved this frame to keep the orbit
        // rigidly anchored to it instead of the camera staying put while the
        // vehicle drives out from under it.
        camera.position.add(orbitDeltaRef.current.subVectors(orbitTargetRef.current, prevOrbitTargetRef.current))
      } else {
        backRef.current.set(-forwardX, 0, -forwardZ)
        desiredCamRef.current.copy(posRef.current).addScaledVector(backRef.current, 2.6)
        desiredCamRef.current.y += 1.5
        camera.position.lerp(desiredCamRef.current, 1 - Math.pow(0.0001, dt))
        lookTargetRef.current.set(posRef.current.x, posRef.current.y + 0.55, posRef.current.z)
        camera.lookAt(lookTargetRef.current)
      }
      prevOrbitTargetRef.current.copy(orbitTargetRef.current)
      if (vehicleOrbitRef.current) {
        vehicleOrbitRef.current.target.copy(orbitTargetRef.current)
      }
    }

    // One throttled sample feeds every live HUD readout - the frame loop must
    // never setState per frame.
    hudAccumRef.current += dt
    if (hudAccumRef.current >= 0.12) {
      hudAccumRef.current = 0
      onHudSample({
        speed: Math.round(Math.abs(speedRef.current) * 20),
        grip: gripQualityRef.current,
        tilt: tiltStateName(tiltAngleRef.current),
      })
    }
  })

  const groundLength = courseMaxZ - courseMinZ
  const groundCenterZ = courseMinZ + groundLength / 2

  return (
    <>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#f8fafc', '#1e293b', 1.1]} />
      <directionalLight castShadow position={[4, 6, 2]} intensity={2.2} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-3, 3, -2]} intensity={0.9} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, groundCenterZ]} receiveShadow>
        <planeGeometry args={[groundHalfWidth * 2 + 4, groundLength + 8]} />
        <meshStandardMaterial color="#334155" roughness={1} />
      </mesh>
      <Grid
        position={[0, 0, groundCenterZ]}
        args={[groundHalfWidth * 2 + 4, groundLength + 8]}
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

      {checkpoints.length === 0 && !course.dropZone && pallets.length === 1 && pallets[0].targetRack && (
        <PathBreadcrumbs
          points={[
            course.start?.position || [0, 0, 0],
            pallets[0].position,
            racks.find((rack) => rack.id === pallets[0].targetRack)?.position,
          ].filter(Boolean)}
        />
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

      {course.decorations && (
        <CourseDecorations decorations={course.decorations} parkedModelUrl={profile.parkedModelUrl} />
      )}
      {liveCones.length > 0 && <ObstacleCones obstacles={liveCones} coneRefs={coneRefs} />}
      {racks.length > 0 && <CourseRacks racks={racks} />}
      {pallets
        .filter((palletDef) => palletDef.targetRack && palletDef.targetLevel)
        .map((palletDef) => {
          const targetRack = racks.find((rack) => rack.id === palletDef.targetRack)
          if (!targetRack) return null
          return (
            <RackLevelMarker
              key={`${palletDef.id}-target`}
              rack={targetRack}
              level={palletDef.targetLevel}
              delivered={palletState === 'delivered'}
            />
          )
        })}

      {pallets.map((palletDef, index) => (
        <Pallet
          key={palletDef.id || index}
          pallet={palletDef}
          palletRef={(el) => {
            palletRefs.current[index] = el
          }}
          onMeasure={(footprint) => {
            palletFootprintsRef.current[index] = footprint
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
      {!freeCam && !firstPerson && (
        <OrbitControls
          ref={vehicleOrbitRef}
          makeDefault
          enableDamping
          dampingFactor={0.15}
          enablePan={false}
          enableZoom={false}
          onStart={() => {
            camAdjustedRef.current = true
          }}
        />
      )}
    </>
  )
}

function DrivingSimulationInner({ profile, course, onEvent, onRequestReset, className, isAdmin }) {
  const [freeCam, setFreeCam] = useState(false)
  const [firstPerson, setFirstPerson] = useState(false)
  const camAdjustedRef = useRef(false)
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
  const [gripState, setGripState] = useState('none')
  const [tiltState, setTiltState] = useState('level')
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
    const info = profile.failMessages[reason] || { title: 'Attempt Failed', message: 'Reset the attempt and try again.' }
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
  // Stored courses always use `pallets`; the singular `pallet` is the older
  // hand-written shape kept working here.
  const hasPallet = Boolean(course.pallets?.length || course.pallet)

  return (
    <section className={`driving-simulation ${className}`}>
      <div className="driving-hud-top">
        <div className="driving-hud-status">
          <span className={`driving-engine-badge ${engineOn ? 'on' : 'off'}`}>Engine {engineOn ? 'ON' : 'OFF'}</span>
          <span className="driving-speed-badge">Speed {hudSpeed}</span>
          {checkpoints.length > 0 && (
            <span className="driving-checkpoint-badge">
              {checkpointIndex >= checkpoints.length
                ? 'Course complete'
                : `Checkpoint ${checkpointIndex + 1} / ${checkpoints.length}`}
            </span>
          )}
          {hasPallet && (
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
          {/* How far the forks are in, and which way the mast is leaning. Both
              decide whether a load stays put, so the learner has to be able to
              read them without guessing from the model. */}
          {hasPallet && profile.hasForks && gripState !== 'none' && (
            <span className={`driving-grip-badge ${gripState}`}>{GRIP_LABELS[gripState]}</span>
          )}
          {hasPallet && profile.hasForks && (
            <span className={`driving-tilt-badge ${tiltState} ${palletState === 'carried' && tiltState !== 'back' ? 'warn' : ''}`}>
              {TILT_LABELS[tiltState]}
            </span>
          )}
        </div>
        <div className="driving-hud-actions">
          <button type="button" className="driving-reset-button" onClick={onRequestReset}>
            <RotateCcw size={14} /> Reset Attempt
          </button>
          <button
            type="button"
            className={`driving-reset-button ${firstPerson ? 'is-active' : ''}`}
            onClick={() => {
              setFirstPerson((value) => !value)
              setFreeCam(false)
              camAdjustedRef.current = false
            }}
          >
            <Eye size={14} /> First-Person {firstPerson ? 'On' : 'Off'}
          </button>
          {!firstPerson && (
            <button
              type="button"
              className="driving-reset-button"
              onClick={() => {
                camAdjustedRef.current = false
              }}
            >
              <Locate size={14} /> Reset Camera
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={`driving-reset-button ${freeCam ? 'is-active' : ''}`}
              onClick={() => {
                setFreeCam((value) => !value)
                setFirstPerson(false)
                camAdjustedRef.current = false
              }}
            >
              <Compass size={14} /> Free Cam {freeCam ? 'On' : 'Off'}
            </button>
          )}
        </div>
      </div>

      <Canvas shadows dpr={[1, 1.35]} camera={{ position: [0, 2, -4], fov: 55 }}>
        <Suspense fallback={<DrivingLoadingPanel />}>
          <DrivingScene
            profile={profile}
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
            onHudSample={({ speed, grip, tilt }) => {
              setHudSpeed(speed)
              setGripState(grip)
              setTiltState(tilt)
            }}
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
            firstPerson={firstPerson}
            camAdjustedRef={camAdjustedRef}
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
        <p className="driving-hud-help">
          {engineOn
            ? `Hold W to accelerate, S to brake or reverse, A / D to steer${profile.hasForks ? ', R / F to raise or lower the forks, T / G to tilt the mast back or forward' : ''}.`
            : 'Press E to start the engine.'}
        </p>
        <div className="driving-keys">
          {profile.keyLegend.map(({ key, caption }) => (
            <div key={key} className="driving-key-wrap">
              <span className={`driving-key ${pressed[key] ? 'active' : ''}`}>{key.toUpperCase()}</span>
              <span className="driving-key-caption">{caption}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// `profile` is the equipment's vehicle profile (lib/vehicleProfile.js): model,
// rig node names, body footprint, HUD captions and fail messages. Omitted, it
// falls back to the forklift defaults - which is also what an equipment with no
// model of its own gets, so a driving step is never an empty scene.
export default function DrivingSimulationViewer({ profile = DEFAULT_PROFILE, course, onEvent, className = '', isAdmin = false }) {
  const [resetSeed, setResetSeed] = useState(0)

  return (
    <DrivingSimulationInner
      key={`${course.id}-${resetSeed}`}
      profile={profile}
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
useGLTF.preload(CARGO_BOX_STACK_MODEL_URL)
useGLTF.preload(RACK_MODEL_URL)
