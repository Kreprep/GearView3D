import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { DoubleSide, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Compass, Eye, RotateCcw, Locate } from 'lucide-react'
import { useT } from '../i18n'
import { buildVehicleRig } from '../lib/vehicleRig'
import { clamp } from '../lib/math'
import { decorationType } from '../lib/courseEdit'
import { resolveCourseBounds } from '../lib/courseGoals'
import { resolveVehicleProfile } from '../lib/vehicleProfile'
import { TILT_RELEASE_ANGLE } from '../data/palletProfile'
import { DECOR_RACK_KINDS, RACK_FOOTPRINT, RACK_MODEL_URL } from '../data/rackProfile'
import { EQUIPMENT_MODEL_URL } from '../data/equipment'
import {
  CARGO_BOX_MODEL_URL,
  CARGO_BOX_STACK_MODEL_URL,
  CONE_MODEL_URL,
  PALLET_MODEL_HEAVY_URL,
  PALLET_MODEL_LIGHT_URL,
  PALLET_MODEL_MEDIUM_URL,
} from '../lib/driving/models'
import { FORK_MAX_HEIGHT, GRIP_LABEL_KEYS, LOOK_MAX_PITCH, LOOK_SENSITIVITY, PALLET_STATE_LABEL_KEYS, TILT_LABEL_KEYS, TILT_MAX_ANGLE, TIP_PIVOT_Y, TIP_PIVOT_Z, tiltStateName } from '../lib/driving/constants'
import { stepDrive } from '../lib/driving/stepDrive'
import { stepCollisionBody, stepCollisionHazards } from '../lib/driving/stepCollision'
import { stepForks } from '../lib/driving/stepForks'
import { stepFail } from '../lib/driving/stepFail'
import { stepPallet } from '../lib/driving/stepPallet'
import { stepCheckpoints, stepParking } from '../lib/driving/stepGoals'
import { stepCamera } from '../lib/driving/stepCamera'
import { useDrivingInput } from '../hooks/useDrivingInput'
import { useDrivingSceneRefs } from '../hooks/useDrivingSceneRefs'
import { PathBreadcrumbs } from './driving/PathBreadcrumbs'
import { CheckpointMarker } from './driving/CheckpointMarker'
import { CourseDecorations } from './driving/CourseDecorations'
import { Pallet } from './driving/Pallet'
import { ObstacleCones } from './driving/ObstacleCones'
import { DropZoneMarker } from './driving/DropZoneMarker'
import { CourseRacks } from './driving/CourseRacks'
import { RackLevelMarker } from './driving/RackLevelMarker'
import { ParkingBayMarker } from './driving/ParkingBayMarker'
import { DrivingLoadingPanel } from './driving/DrivingLoadingPanel'
import './DrivingSimulationViewer.css'

// The coded forklift numbers, used whenever no profile is passed.
// resolveVehicleProfile() lays the Equipment row's overrides over them.
const DEFAULT_PROFILE = resolveVehicleProfile(null)

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
  const { scene } = useGLTF(EQUIPMENT_MODEL_URL)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const { halfWidth, halfLength } = profile.footprint
  const { camera, gl } = useThree()
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

  const {
    rigRef, vehicleOrbitRef, seatWorldRef, seatLookRef, lookYawRef, lookPitchRef, orbitTargetRef, prevOrbitTargetRef, orbitDeltaRef,
    hudAccumRef, backRef, desiredCamRef, lookTargetRef,
    forkHeightRef, tiltAngleRef, steerAngleRef, palletRefs, palletSimRef, palletFootprintsRef,
    bodyRectRef, palletRectRef, gripLocalRef, palletEulerRef, gripQuatRef, carriageQuatRef,
    gripQualityRef, carriedIndexRef, deliveredCountRef, prevSpeedRef, failedRef,
    tipPivotRef, tipStateRef, coneRefs, coneSimRef, coneAxisRef, coneQuatRef,
    onFailRef, parkedRef, parkingStatusRef, onParkingUpdateRef,
  } = useDrivingSceneRefs({ onFail, onParkingUpdate })
  // Reused every frame rather than reallocated - the steps below write their
  // per-frame scratch (forwardX/nextX/controlsLocked/...) onto this and read
  // it back off each other in the same order the original single useFrame
  // computed them in.
  const frameRef = useRef({})
  const sunLightRef = useRef()
  const sunTargetRef = useRef()

  useEffect(() => {
    rigRef.current = buildVehicleRig(forklift, profile.rig)
  }, [forklift, profile.rig, rigRef])

  // light.target defaults to an Object3D that isn't in the scene graph, so its
  // matrixWorld never updates unless it's parented in - point the light at the
  // rendered target object below instead of leaving it stuck at the origin.
  useEffect(() => {
    if (sunLightRef.current && sunTargetRef.current) {
      sunLightRef.current.target = sunTargetRef.current
    }
  }, [])

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
  }, [posRef, headingRef, speedRef, engineOnRef, forkHeightRef, tiltAngleRef])

  // Recentre the look-around offset every time first-person is (re-)entered,
  // same idea as the chase-cam's "Reset Camera" button - a leftover look
  // angle from the last session in the seat would be confusing to land in.
  useEffect(() => {
    if (!firstPerson) return
    lookYawRef.current = 0
    lookPitchRef.current = 0
  }, [firstPerson, lookYawRef, lookPitchRef])

  // Click-and-drag look-around: the camera stays pinned to the seat (still
  // riding along with the vehicle every frame, see stepCamera), only the
  // look direction swings free. Native pointer events rather than drei's
  // PointerLockControls so it works without capturing the cursor or an
  // Escape-to-exit lock, and drag-move listens on window so the look doesn't
  // stop just because the pointer slid off the canvas mid-drag.
  useEffect(() => {
    if (!firstPerson) return undefined
    const dom = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0

    const handlePointerDown = (event) => {
      if (event.button !== 0) return
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
    }
    const handlePointerMove = (event) => {
      if (!dragging) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      lookYawRef.current -= dx * LOOK_SENSITIVITY
      lookPitchRef.current = clamp(lookPitchRef.current - dy * LOOK_SENSITIVITY, -LOOK_MAX_PITCH, LOOK_MAX_PITCH)
    }
    const handlePointerUp = () => {
      dragging = false
    }

    dom.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      dom.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [firstPerson, gl, lookYawRef, lookPitchRef])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)

    const ctx = {
      profile, course, checkpoints, pallets, racks, liveCones, liveWalls, rackColliders,
      halfWidth, halfLength, bodySampleOffsets,
      groundHalfWidth, courseMinZ, courseMaxZ,
      camera, freeCam, firstPerson,
      forkliftGroupRef, posRef, headingRef, speedRef, engineOnRef, keysRef, checkpointIndexRef,
      rigRef, forkHeightRef, tiltAngleRef, steerAngleRef,
      palletRefs, palletSimRef, palletFootprintsRef,
      bodyRectRef, palletRectRef, gripLocalRef, palletEulerRef, gripQuatRef, carriageQuatRef,
      gripQualityRef, carriedIndexRef, deliveredCountRef, prevSpeedRef, failedRef,
      tipPivotRef, tipStateRef,
      coneRefs, coneSimRef, coneAxisRef, coneQuatRef,
      onFailRef, parkedRef, parkingStatusRef, onParkingUpdateRef,
      hudAccumRef, backRef, desiredCamRef, lookTargetRef,
      seatWorldRef, seatLookRef, lookYawRef, lookPitchRef, orbitTargetRef, prevOrbitTargetRef, orbitDeltaRef,
      vehicleOrbitRef, camAdjustedRef,
      onAdvanceCheckpoint, onHudSample, onPalletEvent,
      frame: frameRef.current,
    }

    stepDrive(ctx, dt)
    stepCollisionBody(ctx)
    stepForks(ctx, dt)
    // Tip-over animation continues here, one step before whatever set
    // tip.active this frame (stepPallet, below) - matches the original
    // single useFrame's ordering, where the pallet block ran after the tip
    // animation too, so a fail that starts the tip only shows its first
    // degree of pitch on the next frame. Imperceptible at 60fps and doesn't
    // change any pass/fail grading, which already happened via triggerFail.
    stepFail(ctx, dt)
    stepCollisionHazards(ctx, dt)
    stepCheckpoints(ctx)
    stepPallet(ctx, dt)
    stepParking(ctx)

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

    stepCamera(ctx, dt)

    // One throttled sample feeds every live HUD readout - the frame loop must
    // never setState per frame.
    hudAccumRef.current += dt
    if (hudAccumRef.current >= 0.12) {
      hudAccumRef.current = 0
      onHudSample({
        speed: Math.round(Math.abs(speedRef.current) * 20),
        grip: gripQualityRef.current,
        tilt: tiltStateName(tiltAngleRef.current, TILT_RELEASE_ANGLE),
      })
    }
  })

  const groundLength = courseMaxZ - courseMinZ
  const groundCenterZ = courseMinZ + groundLength / 2

  // Directional light's shadow camera is orthographic and fixed-size around its
  // target - default frustum only covers ~5 units, so a forklift driving further
  // than that from the origin fell outside it and lost its shadow. Track the
  // course center and size the frustum to the whole course instead of a fixed box.
  const shadowFrustumSize = Math.max(groundHalfWidth + 4, groundLength / 2 + 8)

  return (
    <>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#f8fafc', '#1e293b', 1.1]} />
      <directionalLight
        ref={sunLightRef}
        castShadow
        position={[4, 6, 2 + groundCenterZ]}
        intensity={2.2}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-shadowFrustumSize}
        shadow-camera-right={shadowFrustumSize}
        shadow-camera-top={shadowFrustumSize}
        shadow-camera-bottom={-shadowFrustumSize}
        shadow-camera-near={0.5}
        shadow-camera-far={shadowFrustumSize * 2 + 20}
      />
      <object3D ref={sunTargetRef} position={[0, 0, groundCenterZ]} />
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
        <CourseDecorations decorations={course.decorations} />
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
  const t = useT()
  const [hudSpeed, setHudSpeed] = useState(0)
  const [gripState, setGripState] = useState('none')
  const [tiltState, setTiltState] = useState('level')
  const [palletState, setPalletState] = useState('ground')
  const [carriedLoad, setCarriedLoad] = useState(null)
  const [failInfo, setFailInfo] = useState(null)
  const failInfoRef = useRef(null)
  // A catalog key, set by lib/driving/stepGoals.js from inside useFrame.
  const [parkingStatus, setParkingStatus] = useState(course.parkingBay ? 'driving.parking.enterBay' : null)
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
          <span className={`driving-engine-badge ${engineOn ? 'on' : 'off'}`}>
            {t(engineOn ? 'driving.hud.engineOn' : 'driving.hud.engineOff')}
          </span>
          <span className="driving-speed-badge">{t('driving.hud.speed', { speed: hudSpeed })}</span>
          {checkpoints.length > 0 && (
            <span className="driving-checkpoint-badge">
              {checkpointIndex >= checkpoints.length
                ? t('driving.hud.courseComplete')
                : t('driving.hud.checkpoint', {
                    index: checkpointIndex + 1,
                    total: checkpoints.length,
                  })}
            </span>
          )}
          {hasPallet && (
            <span className="driving-checkpoint-badge">{t(PALLET_STATE_LABEL_KEYS[palletState])}</span>
          )}
          {course.parkingBay && parkingStatus && (
            <span className={`driving-parking-badge ${parked ? 'done' : ''}`}>{t(parkingStatus)}</span>
          )}
          {typeof course.capacityKg === 'number' && (
            <span className={`driving-load-badge ${carriedLoad != null && carriedLoad > course.capacityKg ? 'over' : ''}`}>
              {carriedLoad != null
                ? t('driving.hud.load', {
                    load: carriedLoad.toLocaleString(),
                    capacity: course.capacityKg.toLocaleString(),
                  })
                : t('driving.hud.capacity', { capacity: course.capacityKg.toLocaleString() })}
            </span>
          )}
          {/* How far the forks are in, and which way the mast is leaning. Both
              decide whether a load stays put, so the learner has to be able to
              read them without guessing from the model. */}
          {hasPallet && gripState !== 'none' && (
            <span className={`driving-grip-badge ${gripState}`}>{t(GRIP_LABEL_KEYS[gripState])}</span>
          )}
          {hasPallet && (
            <span className={`driving-tilt-badge ${tiltState} ${palletState === 'carried' && tiltState !== 'back' ? 'warn' : ''}`}>
              {t(TILT_LABEL_KEYS[tiltState])}
            </span>
          )}
        </div>
        <div className="driving-hud-actions">
          <button type="button" className="driving-reset-button" onClick={onRequestReset}>
            <RotateCcw size={14} /> {t('driving.hud.resetAttempt')}
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
            <Eye size={14} /> {t(firstPerson ? 'driving.hud.firstPersonOn' : 'driving.hud.firstPersonOff')}
          </button>
          {!firstPerson && (
            <button
              type="button"
              className="driving-reset-button"
              onClick={() => {
                camAdjustedRef.current = false
              }}
            >
              <Locate size={14} /> {t('driving.hud.resetCamera')}
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
              <Compass size={14} /> {t(freeCam ? 'driving.hud.freeCamOn' : 'driving.hud.freeCamOff')}
            </button>
          )}
        </div>
      </div>

      <Canvas
        shadows
        dpr={[1, 1.35]}
        camera={{ position: [0, 2, -4], fov: 55 }}
        className={firstPerson ? 'driving-canvas-lookable' : undefined}
      >
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
            ? 'Hold W to accelerate, S to brake or reverse, A / D to steer, R / F to raise or lower the forks, T / G to tilt the mast back or forward.'
            : 'Press E to start the engine.'}
          {firstPerson && ' Click and drag the scene to look around.'}
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

// `profile` is the resolved vehicle profile (lib/vehicleProfile.js): body
// footprint, rig, HUD captions and fail messages. Omitted, it falls back to the
// coded forklift defaults.
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

useGLTF.preload(EQUIPMENT_MODEL_URL)
useGLTF.preload(CONE_MODEL_URL)
useGLTF.preload(PALLET_MODEL_LIGHT_URL)
useGLTF.preload(PALLET_MODEL_MEDIUM_URL)
useGLTF.preload(PALLET_MODEL_HEAVY_URL)
useGLTF.preload(CARGO_BOX_MODEL_URL)
useGLTF.preload(CARGO_BOX_STACK_MODEL_URL)
useGLTF.preload(RACK_MODEL_URL)
