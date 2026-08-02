import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Html, useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, Group, Matrix4, Mesh, Vector3 } from 'three'
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

// Model-derived rig tuning (Forklift_SEPERATED.glb, world units ~= metres/4).
const WHEEL_NODE_NAMES = { FL: 'Wheel_FL', FR: 'Wheel_FR', RL: 'Wheel_RL', RR: 'Wheel_RR' }
const REAR_WHEEL_KEYS = ['RL', 'RR']
const WHEEL_RADIUS_FALLBACK = 0.07
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

// The GLB exports every forklift part as a SkinnedMesh bound to a 3-bone rig
// that we never animate. In three.js 'attached' bind mode a SkinnedMesh ignores
// its own transform (the skinning math cancels it out), so rotating a wheel
// node directly would show nothing. Swap each SkinnedMesh for a plain Mesh with
// the same geometry/material/local transform (bind pose equals rest pose, so
// output is identical), then wrap the moving parts in pivot groups we can drive
// from the frame loop.
function buildForkliftRig(root) {
  if (root.userData.__forkliftRig) return root.userData.__forkliftRig

  root.updateMatrixWorld(true)

  const skinnedMeshes = []
  root.traverse((object) => {
    if (object.isSkinnedMesh) skinnedMeshes.push(object)
  })
  const skinTransform = new Matrix4()
  const parentInverse = new Matrix4()
  skinnedMeshes.forEach((skinned) => {
    // GLTFLoader binds skins before world matrices exist, so the on-screen pose
    // of each rigidly-skinned part is boneWorld * inverseBind * bindMatrix - not
    // the node's own transform chain. Bake that pose into the replacement mesh,
    // using the dominant (max-weight) bone of the first vertex.
    const skinIndex = skinned.geometry.attributes.skinIndex
    const skinWeight = skinned.geometry.attributes.skinWeight
    let boneIndex = 0
    if (skinIndex && skinWeight) {
      let bestWeight = -1
      for (let influence = 0; influence < 4; influence += 1) {
        const weight = skinWeight.getComponent(0, influence)
        if (weight > bestWeight) {
          bestWeight = weight
          boneIndex = skinIndex.getComponent(0, influence)
        }
      }
    }
    skinTransform
      .multiplyMatrices(skinned.skeleton.bones[boneIndex].matrixWorld, skinned.skeleton.boneInverses[boneIndex])
      .multiply(skinned.bindMatrix)
    const plain = new Mesh(skinned.geometry, skinned.material)
    plain.name = skinned.name
    parentInverse.copy(skinned.parent.matrixWorld).invert()
    plain.matrix.multiplyMatrices(parentInverse, skinTransform)
    plain.matrix.decompose(plain.position, plain.quaternion, plain.scale)
    plain.castShadow = true
    plain.receiveShadow = true
    skinned.parent.add(plain)
    skinned.parent.remove(skinned)
  })
  root.updateMatrixWorld(true)

  const wheels = {}
  Object.entries(WHEEL_NODE_NAMES).forEach(([key, name]) => {
    const mesh = root.getObjectByName(name)
    if (!mesh) return

    const box = new Box3().setFromObject(mesh)
    const center = box.getCenter(new Vector3())
    const radius = Number.isFinite(box.max.y)
      ? Math.max((box.max.y - box.min.y) / 2, 0.01)
      : WHEEL_RADIUS_FALLBACK
    const parent = mesh.parent
    const localCenter = parent.worldToLocal(center.clone())

    // Spin pivot sits at the wheel centre so rotation.x rolls the wheel about
    // its own axle; rear wheels get an extra yaw pivot for steering.
    const spin = new Group()
    if (REAR_WHEEL_KEYS.includes(key)) {
      const steer = new Group()
      steer.position.copy(localCenter)
      parent.add(steer)
      steer.add(spin)
      steer.updateMatrixWorld(true)
      spin.attach(mesh)
      wheels[key] = { spin, steer, radius }
    } else {
      spin.position.copy(localCenter)
      parent.add(spin)
      spin.updateMatrixWorld(true)
      spin.attach(mesh)
      wheels[key] = { spin, radius }
    }
  })

  const wrapInLiftGroup = (name) => {
    const mesh = root.getObjectByName(name)
    if (!mesh) return null
    const lift = new Group()
    mesh.parent.add(lift)
    lift.updateMatrixWorld(true)
    lift.attach(mesh)
    return lift
  }
  const mastLift = wrapInLiftGroup('Mast')
  const carriageLift = wrapInLiftGroup('Lift_Carriage')

  let forkTipOffset = FORK_TIP_OFFSET_FALLBACK
  const carriage = root.getObjectByName('Lift_Carriage')
  if (carriage) {
    const carriageBox = new Box3().setFromObject(carriage)
    if (Number.isFinite(carriageBox.max.z)) {
      forkTipOffset = clamp(carriageBox.max.z - 0.15, 0.3, 1.2)
    }
  }

  const rig = { wheels, mastLift, carriageLift, forkTipOffset }
  root.userData.__forkliftRig = rig
  if (typeof window !== 'undefined') window.__forkliftRig = rig
  return rig
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

function Pallet({ pallet, palletRef }) {
  return (
    <group ref={palletRef} position={[pallet.position[0], 0, pallet.position[2]]} rotation={[0, pallet.rotation || 0, 0]}>
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]} castShadow>
          <boxGeometry args={[0.05, 0.06, 0.34]} />
          <meshStandardMaterial color="#8a6d1a" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.32, 0.02, 0.34]} />
        <meshStandardMaterial color="#b8860b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#b45309" roughness={0.8} />
      </mesh>
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
}) {
  const { scene } = useGLTF(modelUrl)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const rigRef = useRef(null)
  const { camera } = useThree()
  const checkpoints = course.checkpoints || []

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
  const palletRef = useRef(null)
  const palletStateRef = useRef('ground')
  const forksEngagedRef = useRef(false)

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const keys = keysRef.current
    const turnInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0)

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

      const steerTarget = engineOnRef.current ? turnInput * MAX_STEER_ANGLE * STEER_SIGN : 0
      steerAngleRef.current += (steerTarget - steerAngleRef.current) * Math.min(STEER_DAMP * dt, 1)
      REAR_WHEEL_KEYS.forEach((key) => {
        if (rig.wheels[key]?.steer) rig.wheels[key].steer.rotation.y = steerAngleRef.current
      })

      if (engineOnRef.current) {
        if (keys.raise) {
          forkHeightRef.current = Math.min(forkHeightRef.current + FORK_SPEED * dt, FORK_MAX_HEIGHT)
        } else if (keys.lower) {
          forkHeightRef.current = Math.max(forkHeightRef.current - FORK_SPEED * dt, 0)
        }
      }
      if (rig.carriageLift) rig.carriageLift.position.y = forkHeightRef.current
      if (rig.mastLift) rig.mastLift.position.y = forkHeightRef.current * MAST_LIFT_RATIO
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

    // Pallet pickup/carry/release - proximity + fork-height checks, no physics.
    if (course.pallet && palletRef.current) {
      const attachOffset = rig?.forkTipOffset || FORK_TIP_OFFSET_FALLBACK
      const tipX = posRef.current.x + forwardX * attachOffset
      const tipZ = posRef.current.z + forwardZ * attachOffset
      const pallet = palletRef.current

      if (palletStateRef.current === 'ground' || palletStateRef.current === 'released') {
        const near = Math.hypot(pallet.position.x - tipX, pallet.position.z - tipZ) <= PICKUP_RADIUS
        const toX = pallet.position.x - posRef.current.x
        const toZ = pallet.position.z - posRef.current.z
        const facing = (forwardX * toX + forwardZ * toZ) / (Math.hypot(toX, toZ) || 1)

        if (near && facing >= ALIGN_DOT_MIN && forkHeightRef.current <= FORK_ENGAGE_HEIGHT) {
          forksEngagedRef.current = true
        } else if (!near || facing < ALIGN_DOT_MIN) {
          forksEngagedRef.current = false
        }

        if (forksEngagedRef.current && engineOnRef.current && forkHeightRef.current >= LIFT_THRESHOLD) {
          forksEngagedRef.current = false
          palletStateRef.current = 'carried'
          onPalletEvent({ type: 'pallet-lifted' }, 'carried')
        }
      } else if (palletStateRef.current === 'carried') {
        const lerpK = Math.min(CARRY_LERP * dt, 1)
        pallet.position.x += (tipX - pallet.position.x) * lerpK
        pallet.position.z += (tipZ - pallet.position.z) * lerpK
        pallet.position.y += (forkHeightRef.current + PALLET_CARRY_Y - pallet.position.y) * lerpK
        pallet.rotation.y = headingRef.current

        if (forkHeightRef.current <= DROP_LOWER_THRESHOLD) {
          palletStateRef.current = 'released'
          pallet.position.set(tipX, 0, tipZ)
          onPalletEvent({ type: 'pallet-dropped' }, 'released')
        }
      }

      if (palletStateRef.current === 'released' && course.dropZone) {
        const inZone = Math.hypot(
          pallet.position.x - course.dropZone.position[0],
          pallet.position.z - course.dropZone.position[2],
        ) <= course.dropZone.radius
        const cleared = Math.hypot(pallet.position.x - tipX, pallet.position.z - tipZ) >= CLEAR_DISTANCE
        if (inZone && cleared) {
          palletStateRef.current = 'delivered'
          onPalletEvent({ type: 'pallet-delivered' }, 'delivered')
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.__drivingDebug = {
        x: posRef.current.x,
        z: posRef.current.z,
        heading: headingRef.current,
        speed: speedRef.current,
        forkHeight: forkHeightRef.current,
        steer: steerAngleRef.current,
        palletState: palletStateRef.current,
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

      {checkpoints.length === 0 && course.pallet && course.dropZone && (
        <PathBreadcrumbs points={[course.start?.position || [0, 0, 0], course.pallet.position, course.dropZone.position]} />
      )}

      {checkpoints.map((checkpoint, index) => (
        <CheckpointMarker
          key={checkpoint.id}
          checkpoint={checkpoint}
          status={index < checkpointIndex ? 'done' : index === checkpointIndex ? 'active' : 'pending'}
        />
      ))}

      {course.decorations && <CourseDecorations decorations={course.decorations} />}

      {course.pallet && <Pallet pallet={course.pallet} palletRef={palletRef} />}
      {course.dropZone && <DropZoneMarker zone={course.dropZone} delivered={palletState === 'delivered'} />}

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
  const [palletState, setPalletState] = useState('ground')

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
        {course.pallet && (
          <span className="driving-checkpoint-badge">{PALLET_STATE_LABELS[palletState]}</span>
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
              setTimeout(() => onEventRef.current?.(event), 0)
            }}
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
          {engineOn
            ? 'Hold W to accelerate, S to brake or reverse, A / D to steer, R / F to raise or lower the forks.'
            : 'Press E to start the engine.'}
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
