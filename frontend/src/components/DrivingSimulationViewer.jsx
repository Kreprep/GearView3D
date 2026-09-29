import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { DoubleSide } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Compass, Locate, Radar, RotateCcw } from 'lucide-react'
import { useT } from '../i18n'
import { buildVehicleRig } from '../lib/vehicleRig'
import { clamp } from '../lib/math'
import { playDeviceSound } from '../lib/deviceAudio'
import { resolveCourseBounds } from '../lib/courseGoals'
import { resolveVehicleProfile } from '../lib/vehicleProfile'
import { RACK_MODEL_URL } from '../data/rackProfile'
import { EQUIPMENT_MODEL_URL } from '../data/equipment'
import {
  CARGO_BOX_MODEL_URL,
  CARGO_BOX_STACK_MODEL_URL,
  CONE_MODEL_URL,
  PALLET_MODEL_HEAVY_URL,
  PALLET_MODEL_LIGHT_URL,
  PALLET_MODEL_MEDIUM_URL,
} from '../lib/driving/models'
import { LOOK_MAX_PITCH, LOOK_SENSITIVITY, PALLET_STATE_LABEL_KEYS, TIP_PIVOT_Y, TIP_PIVOT_Z } from '../lib/driving/constants'
import { createCabGauges, stepCabGauges } from '../lib/driving/cabGauges'
import { CAMERA_MODES, DEFAULT_CAMERA_MODE, FREE_CAMERA_MODE, nextCameraMode } from '../lib/driving/cameraModes'
import { cockpitSnapshot } from '../lib/driving/cockpitTelemetry'
import { createKeyActiveTracker, mergeControls, neutralControls } from '../lib/driving/controls'
import { createDashboardSource } from '../lib/driving/dashboardSource'
import { proximityReadout } from '../lib/driving/proximity'
import { rigGeometryMismatches } from '../lib/driving/rigGeometry'
import { createSimCore } from '../lib/driving/simCore'
import { createSimLoop } from '../lib/driving/simLoop'
import { capturePose, createPoseBuffer, syncView } from '../lib/driving/syncView'
import { createTelemetryStore, TELEMETRY_INTERVAL } from '../lib/driving/telemetry'
import { stepCamera } from '../lib/driving/stepCamera'
import { useDrivingInput } from '../hooks/useDrivingInput'
import { useDrivingSceneRefs } from '../hooks/useDrivingSceneRefs'
import { useTelemetry } from '../hooks/useTelemetry'
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
import { OperatorDashboard } from './driving/OperatorDashboard'
import { InsetRenderer, ProximityInsetFrame, ProximityRings } from './driving/ProximityInset'
import './DrivingSimulationViewer.css'

// The coded forklift numbers, used whenever no profile is passed.
// resolveVehicleProfile() lays the Equipment row's overrides over them.
const DEFAULT_PROFILE = resolveVehicleProfile(null)

// Head/work light brightness when switched on (candela, three.js's
// physically based light units).
const HEADLIGHT_INTENSITY = 6

const CAMERA_LABEL_KEYS = {
  'first-person': 'driving.camera.firstPerson',
  chase: 'driving.camera.chase',
  top: 'driving.camera.top',
  side: 'driving.camera.side',
  front: 'driving.camera.front',
  free: 'driving.camera.free',
}

// Keyboard commands that work the cab's switches. E is handled on its own
// (it turns the key), and anything else is the view's (camera, inset).
const CAB_COMMANDS = {
  seatbeltToggle: (dashboard) => dashboard.toggle('seatbelt'),
  parkingBrakeToggle: (dashboard) => dashboard.toggle('parkingBrake'),
  horn: (dashboard) => dashboard.horn(),
}

// Everything the driving screen shows, published into the telemetry store
// (lib/driving/telemetry.js) rather than set as React state every frame.
function publishCockpit(telemetry, core, course, { controls, switches, gauges }) {
  telemetry.publish(
    cockpitSnapshot(core.state, course, {
      controls,
      switches,
      gauges,
      proximity: proximityReadout(core.state, core.world),
    }),
  )
}

function DrivingScene({ profile, course, core, telemetry, keyboard, dashboard, onSimEvent, onKeyActive, onViewCommand, cameraMode, insetEnabled, insetFrameRef, camAdjustedRef }) {
  const { scene } = useGLTF(EQUIPMENT_MODEL_URL)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const { camera, gl } = useThree()
  const checkpoints = course.checkpoints || []
  const { halfWidth: groundHalfWidth, minZ: courseMinZ, maxZ: courseMaxZ } = useMemo(
    () => resolveCourseBounds(course),
    [course],
  )
  const { pallets, racks, liveCones } = core.world
  const checkpointIndex = useTelemetry(telemetry, (snapshot) => snapshot.checkpointIndex)
  const palletState = useTelemetry(telemetry, (snapshot) => snapshot.palletState)
  const parked = useTelemetry(telemetry, (snapshot) => snapshot.parked)

  const refs = useDrivingSceneRefs()
  const { rigRef, truckGroupRef, tipPivotRef, palletObjectsRef, coneObjectsRef, vehicleOrbitRef, lookYawRef, lookPitchRef } = refs
  const sunLightRef = useRef()
  const sunTargetRef = useRef()
  const headlightRef = useRef()
  const headlightTargetRef = useRef()
  const telemetryClockRef = useRef(0)
  // The truck pose syncView drew this frame, for the inset's camera.
  const renderPoseRef = useRef(null)
  const firstPerson = cameraMode === 'first-person'

  // The fixed-step loop. Each step first records the pose it starts from, so
  // syncView can interpolate the render between the last two steps.
  const [sim] = useState(() => {
    const prevPose = capturePose(core.state, createPoseBuffer())
    const keyTracker = createKeyActiveTracker()
    let lastControls = neutralControls()
    const loop = createSimLoop((dt) => {
      capturePose(core.state, prevPose)
      const leverEngaged = dashboard.switches.lever !== null
      lastControls = mergeControls([keyboard.read(core.state, { leverEngaged }), dashboard.read()])
      core.step(dt, lastControls)
    })
    return {
      prevPose,
      loop,
      // Illustrative fuel, temperature and hours (lib/driving/cabGauges.js):
      // view-side, not part of the simulation.
      gauges: createCabGauges(),
      controls: () => lastControls,
      // The keysUsed adapter: the old keyboard letters, reported once per
      // press, for free-practice completion code.
      freshKeys: () => keyTracker.update(lastControls, keyboard.drainLetters()),
    }
  })

  useEffect(() => {
    rigRef.current = buildVehicleRig(forklift, profile.rig)
    if (import.meta.env.DEV) {
      const mismatches = rigGeometryMismatches(rigRef.current)
      if (mismatches.length) {
        console.warn('forklift.glb no longer matches lib/driving/rigGeometry.js - re-measure it:', mismatches)
      }
    }
  }, [forklift, profile.rig, rigRef])

  // light.target defaults to an Object3D that isn't in the scene graph, so its
  // matrixWorld never updates unless it's parented in - point each light at a
  // rendered target object instead of leaving it stuck at the origin.
  useEffect(() => {
    if (sunLightRef.current && sunTargetRef.current) {
      sunLightRef.current.target = sunTargetRef.current
    }
    if (headlightRef.current && headlightTargetRef.current) {
      headlightRef.current.target = headlightTargetRef.current
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

  // Dev-only test hooks: warp truck/fork state directly instead of faking held
  // keys, so browser-automation checks can reach a course's pallets/cones
  // without fighting acceleration/drag timing, and read the state back.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__drivingDebugSet = (patch = {}) => {
      core.debugSet(patch)
      // A warp is not motion: don't smear the render across it.
      capturePose(core.state, sim.prevPose)
    }
    return () => {
      delete window.__drivingDebugSet
      delete window.__drivingDebug
    }
  }, [core, sim])

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
    // Keyboard commands first: E turns the dashboard's key, B / Space / H
    // work its switches, and the rest (camera, inset) go to the view. Then
    // whatever the key switch decided reaches the simulation.
    for (const command of keyboard.drainCommands()) {
      if (command === 'engineToggle') dashboard.toggleEngine(core.state.truck.engineOn)
      else if (CAB_COMMANDS[command]) CAB_COMMANDS[command](dashboard)
      else onViewCommand(command)
    }
    for (const command of dashboard.drainCommands()) {
      if (command === 'horn') playDeviceSound('horn')
      else core.command(command)
    }
    const { alpha } = sim.loop.advance(rawDelta)
    stepCabGauges(sim.gauges, { engineOn: core.state.truck.engineOn, throttle: sim.controls().throttle }, rawDelta)

    const events = core.drainEvents()
    events.forEach(onSimEvent)
    sim.freshKeys().forEach(onKeyActive)

    const pose = syncView(
      {
        truckGroup: truckGroupRef.current,
        tipPivot: tipPivotRef.current,
        rig: rigRef.current,
        palletObjects: palletObjectsRef.current,
        coneObjects: coneObjectsRef.current,
      },
      core.state,
      sim.prevPose,
      alpha,
      core.world,
      rawDelta,
    )
    renderPoseRef.current = pose
    stepCamera({ ...refs, profile, camera, cameraMode, forkHeight: core.state.forks.height, camAdjustedRef }, pose, rawDelta)
    if (headlightRef.current) headlightRef.current.intensity = dashboard.switches.lights ? HEADLIGHT_INTENSITY : 0

    if (import.meta.env.DEV) window.__drivingDebug = core.debugSnapshot()

    // The HUD refreshes at TELEMETRY_HZ, and at once when something happened
    // or a dashboard switch moved.
    telemetryClockRef.current += rawDelta
    if (dashboard.takeChanged() || events.length || telemetryClockRef.current >= TELEMETRY_INTERVAL) {
      telemetryClockRef.current = 0
      publishCockpit(telemetry, core, course, { controls: sim.controls(), switches: dashboard.switches, gauges: sim.gauges })
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
      {liveCones.length > 0 && <ObstacleCones obstacles={liveCones} coneRefs={coneObjectsRef} />}
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
            palletObjectsRef.current[index] = el
          }}
          onMeasure={(footprint) => core.setPalletFootprint(index, footprint)}
          overweight={typeof course.capacityKg === 'number' && (palletDef.weightKg ?? 0) > course.capacityKg}
        />
      ))}
      {course.dropZone && <DropZoneMarker zone={course.dropZone} delivered={palletState === 'delivered'} />}
      {course.parkingBay && <ParkingBayMarker bay={course.parkingBay} parked={parked} />}

      <group ref={truckGroupRef}>
        <group ref={tipPivotRef} position={[0, TIP_PIVOT_Y, TIP_PIVOT_Z]}>
          <group position={[0, -TIP_PIVOT_Y, -TIP_PIVOT_Z]}>
            <primitive object={forklift} />
          </group>
        </group>
        {/* Head/work light on the overhead guard, switched from the dashboard.
            Always mounted and dimmed to 0 when off, since adding or removing a
            light recompiles every material in the scene. */}
        <spotLight ref={headlightRef} position={[0, 0.5, 0.12]} angle={0.55} penumbra={0.5} distance={4} decay={1} intensity={0} color="#fff7d6" />
        <object3D ref={headlightTargetRef} position={[0, 0, 1.6]} />
        <ProximityRings world={core.world} />
      </group>

      <InsetRenderer enabled={insetEnabled} frameRef={insetFrameRef} poseRef={renderPoseRef} />

      {cameraMode === FREE_CAMERA_MODE && <OrbitControls makeDefault enableDamping dampingFactor={0.15} minDistance={0.5} maxDistance={80} />}
      {cameraMode === 'chase' && (
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
  // First-person on every entry (docs/revisions/post-defense-plan.md, 4.1).
  const [cameraMode, setCameraMode] = useState(DEFAULT_CAMERA_MODE)
  const [insetOn, setInsetOn] = useState(true)
  const camAdjustedRef = useRef(false)
  const insetFrameRef = useRef(null)
  const t = useT()

  // One attempt: the component is keyed on the course and a reset counter, so
  // "Reset Attempt" builds a fresh core, dashboard and gauges.
  const [core] = useState(() => createSimCore(course, profile))
  const [dashboard] = useState(createDashboardSource)
  const [telemetry] = useState(() => {
    const store = createTelemetryStore(null)
    publishCockpit(store, core, course, { controls: neutralControls(), switches: dashboard.switches, gauges: createCabGauges() })
    return store
  })
  const { source: keyboard, pressed } = useDrivingInput()
  const [failInfo, setFailInfo] = useState(null)

  useEffect(() => {
    core.setProfile(profile)
  }, [core, profile])

  const hud = useTelemetry(telemetry, (snapshot) => snapshot)
  const { engineOn, leverEngaged, checkpointIndex, palletState, parkingStatus, parked } = hud

  const chooseCamera = (mode) => {
    camAdjustedRef.current = false
    setCameraMode(mode)
  }
  // Camera and inset keys, raised from the frame loop on a key press (never
  // per frame). C from the admin's free camera goes back to first-person.
  const handleViewCommand = (command) => {
    if (command === 'cameraNext') {
      chooseCamera(cameraMode === FREE_CAMERA_MODE ? DEFAULT_CAMERA_MODE : nextCameraMode(cameraMode))
    } else if (command === 'toggleInset') {
      setInsetOn((on) => !on)
    } else if (command.startsWith('camera:')) {
      chooseCamera(command.slice('camera:'.length))
    }
  }
  // The top view already is the bird's-eye picture.
  const insetEnabled = insetOn && cameraMode !== 'top'
  // One short line over the dashboard: how to start, what the lever does,
  // how to look around. Every key is listed in the dashboard's Controls
  // drawer.
  const hint = [
    !engineOn && t('driving.hud.hint.engineOff'),
    engineOn && leverEngaged && t('driving.hud.hint.lever'),
    cameraMode === 'first-person' && t('driving.hud.hint.look'),
  ]
    .filter(Boolean)
    .join(' ')

  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  // The core's events, turned into the viewer's own event vocabulary
  // (hooks/useDrivingController.jsx), which is unchanged. They are raised
  // from inside the frame loop, so they reach the page on the next tick.
  const emit = (event) => setTimeout(() => onEventRef.current?.(event), 0)
  const handleSimEvent = (event) => {
    if (event.type === 'engine') {
      emit({ type: event.on ? 'engine-on' : 'engine-off' })
    } else if (event.type === 'fail') {
      const info = profile.failMessages[event.reason] || { title: 'Attempt Failed', message: 'Reset the attempt and try again.' }
      setFailInfo({ reason: event.reason, ...info })
      emit({ type: 'sim-failed', reason: event.reason, title: info.title, message: info.message })
    } else if (event.type === 'checkpoint') {
      const { checkpoint, isLast } = event
      emit({
        type: isLast ? 'course-complete' : 'checkpoint',
        id: checkpoint.id,
        label: checkpoint.label,
        message: checkpoint.completeMessage,
      })
    } else if (event.type === 'pallet') {
      emit(event.event)
    } else if (event.type === 'parking' && event.isParked) {
      emit({ type: 'parking-complete' })
    }
  }
  const handleKeyActive = (key) => emit({ type: 'key-active', key })

  const checkpoints = course.checkpoints || []
  // Stored courses always use `pallets`; the singular `pallet` is the older
  // hand-written shape kept working here.
  const hasPallet = Boolean(course.pallets?.length || course.pallet)

  return (
    <section className={`driving-simulation ${className}`}>
      <div className="driving-hud-top">
        {/* Course objective and progress only: the operator dashboard at the
            bottom carries the truck's own readings. */}
        <div className="driving-hud-status">
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
        </div>
        <div className="driving-hud-actions">
          <button type="button" className="driving-reset-button" onClick={onRequestReset}>
            <RotateCcw size={14} /> {t('driving.hud.resetAttempt')}
          </button>
          <div className="driving-camera-modes" role="group" aria-label={t('driving.camera.label')} title={t('driving.camera.hint')}>
            {CAMERA_MODES.map((mode, index) => (
              <button
                key={mode}
                type="button"
                className={`driving-reset-button ${cameraMode === mode ? 'is-active' : ''}`}
                aria-pressed={cameraMode === mode}
                onClick={() => chooseCamera(mode)}
              >
                <span className="driving-camera-shortcut" aria-hidden="true">{index + 1}</span>
                {t(CAMERA_LABEL_KEYS[mode])}
              </button>
            ))}
            {isAdmin && (
              <button
                type="button"
                className={`driving-reset-button ${cameraMode === FREE_CAMERA_MODE ? 'is-active' : ''}`}
                aria-pressed={cameraMode === FREE_CAMERA_MODE}
                onClick={() => chooseCamera(FREE_CAMERA_MODE)}
              >
                <Compass size={14} /> {t(CAMERA_LABEL_KEYS.free)}
              </button>
            )}
          </div>
          {cameraMode === 'chase' && (
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
          <button
            type="button"
            className={`driving-reset-button ${insetOn ? 'is-active' : ''}`}
            aria-pressed={insetOn}
            onClick={() => setInsetOn((on) => !on)}
          >
            <Radar size={14} /> {t('driving.inset.toggle')}
          </button>
        </div>
      </div>

      {/* PCF shadows: R3F's default soft shadows are deprecated in three
          0.184, which renders them as PCF anyway and warns every frame. */}
      <Canvas
        shadows="percentage"
        dpr={[1, 1.35]}
        camera={{ position: [0, 2, -4], fov: 55 }}
        className={cameraMode === 'first-person' ? 'driving-canvas-lookable' : undefined}
      >
        <Suspense fallback={<DrivingLoadingPanel />}>
          <DrivingScene
            profile={profile}
            course={course}
            core={core}
            telemetry={telemetry}
            keyboard={keyboard}
            dashboard={dashboard}
            onSimEvent={handleSimEvent}
            onKeyActive={handleKeyActive}
            onViewCommand={handleViewCommand}
            cameraMode={cameraMode}
            insetEnabled={insetEnabled}
            insetFrameRef={insetFrameRef}
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
              <RotateCcw size={14} /> {t('driving.hud.resetAttempt')}
            </button>
          </div>
        </div>
      )}

      <div className="driving-hud-bottom">
        {insetEnabled && <ProximityInsetFrame telemetry={telemetry} frameRef={insetFrameRef} />}
        {hint && <p className="driving-hud-help">{hint}</p>}
        <OperatorDashboard telemetry={telemetry} dashboard={dashboard} capacityKg={course.capacityKg} keyLegend={profile.keyLegend} pressed={pressed} />
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
