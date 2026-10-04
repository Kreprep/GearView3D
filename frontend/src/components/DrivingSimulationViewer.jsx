import { useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { DoubleSide } from 'three'
import { Box, Compass, Gamepad2, Locate, Radar, RotateCcw, VolumeX } from 'lucide-react'
import { useT } from '../i18n'
import { getAudioEngine } from '../lib/audio/audioEngine'
import { resolveVehicleProfile } from '../lib/vehicleProfile'
import { RACK_MODEL_URL } from '../data/rackProfile'
import {
  CARGO_BOX_MODEL_URL,
  CARGO_BOX_STACK_MODEL_URL,
  CONE_MODEL_URL,
  PALLET_MODEL_HEAVY_URL,
  PALLET_MODEL_LIGHT_URL,
  PALLET_MODEL_MEDIUM_URL,
} from '../lib/driving/models'
import { PALLET_STATE_LABEL_KEYS } from '../lib/driving/constants'
import { CAMERA_VIEWS, DEFAULT_CAMERA_VIEW, FREE_CAMERA_VIEW } from '../lib/driving/cameraModes'
import { loadRapier } from '../lib/physics/rapier'
import { useDrivingAttempt } from '../hooks/useDrivingAttempt'
import { useDrivingView } from '../hooks/useDrivingView'
import { useAudioSuspended } from '../hooks/useAudio'
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
import { DrivingStage } from './driving/DrivingStage'
import { OperatorDashboard } from './driving/OperatorDashboard'
import { ControllerSetup } from './driving/ControllerSetup'
import { ProximityInsetFrame } from './driving/ProximityInset'
import { SafetySigns } from './driving/SafetySigns'
import { HudMenu } from './driving/HudMenu'
import './DrivingSimulationViewer.css'

// The coded forklift numbers, used whenever no profile is passed.
// resolveVehicleProfile() lays the Equipment row's overrides over them.
const DEFAULT_PROFILE = resolveVehicleProfile(null)

const CAMERA_LABEL_KEYS = {
  'first-person': 'driving.camera.firstPerson',
  chase: 'driving.camera.chase',
}

// What stands on the course: its start ring, the path to follow, the
// checkpoints, decorations, cones, racks, pallets and goal markers. Drawn
// inside the stage (components/driving/DrivingStage.jsx); the cones and
// pallets register with the view's refs so syncView moves them.
function CourseObjects({ course, core, telemetry, refs }) {
  const checkpoints = course.checkpoints || []
  const { pallets, racks, liveCones } = core.world
  const { palletObjectsRef, coneObjectsRef } = refs
  const checkpointIndex = useTelemetry(telemetry, (snapshot) => snapshot.checkpointIndex)
  const palletState = useTelemetry(telemetry, (snapshot) => snapshot.palletState)
  const parked = useTelemetry(telemetry, (snapshot) => snapshot.parked)

  return (
    <>
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
          overweight={typeof course.capacityKg === 'number' && (palletDef.weightKg ?? 0) > course.capacityKg}
        />
      ))}
      {course.dropZone && <DropZoneMarker zone={course.dropZone} delivered={palletState === 'delivered'} />}
      {course.parkingBay && <ParkingBayMarker bay={course.parkingBay} parked={parked} />}
    </>
  )
}

// The course composition: one attempt (hooks/useDrivingAttempt.js) on the
// shared stage, with the course's objects, its goal chips and the HUD, the
// safety signs, the fail overlay and the operator dashboard.
function DrivingSimulationInner({ profile, course, onEvent, onRequestReset, className, isAdmin }) {
  const attempt = useDrivingAttempt({ course, profile, onEvent })
  const view = useDrivingView()
  const { core, dashboard, telemetry, signs, failInfo, pressed } = attempt
  const { cameraState, shot, moveCamera, insetOn, toggleInset, insetEnabled } = view
  const [showColliders, setShowColliders] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const soundSuspended = useAudioSuspended()
  const t = useT()

  const hud = useTelemetry(telemetry, (snapshot) => snapshot)
  const { engineOn, leverEngaged, shifterActive, checkpointIndex, palletState, parkingStatus, parked, needSeatbelt, needParkingBrake, needNeutral } = hud

  // One short line over the dashboard: how to start, what the lever does,
  // how to look around. Every key is listed in the dashboard's Controls
  // drawer.
  const interlockBlocked = needSeatbelt || needParkingBrake || needNeutral
  const hint = [
    !engineOn && t(interlockBlocked ? 'driving.hud.hint.interlock' : 'driving.hud.hint.engineOff'),
    engineOn && leverEngaged && t(shifterActive ? 'driving.hud.hint.shifter' : 'driving.hud.hint.lever'),
    shot === 'first-person' && t('driving.hud.hint.look'),
  ]
    .filter(Boolean)
    .join(' ')

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
        {/* One row at every width the app supports: reset, the view, the
            proximity inset, and a More menu for the rest. The camera's arrow
            moves are the arrow keys and the wheel's D-pad (and mouse drag),
            listed in the dashboard's Controls drawer. */}
        <div className="driving-hud-actions">
          <button type="button" className="driving-reset-button" onClick={onRequestReset}>
            <RotateCcw size={14} aria-hidden="true" /> {t('driving.hud.resetAttempt')}
          </button>
          <div className="driving-camera-modes" role="group" aria-label={t('driving.camera.label')} title={t('driving.camera.hint')}>
            {CAMERA_VIEWS.map((cameraView) => (
              <button
                key={cameraView}
                type="button"
                className={`driving-reset-button ${cameraState.view === cameraView ? 'is-active' : ''}`}
                aria-pressed={cameraState.view === cameraView}
                onClick={() => moveCamera(`view:${cameraView}`)}
              >
                {t(CAMERA_LABEL_KEYS[cameraView])}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`driving-reset-button driving-icon-button ${insetOn ? 'is-active' : ''}`}
            aria-pressed={insetOn}
            aria-label={t('driving.inset.toggle')}
            title={t('driving.inset.toggle')}
            onClick={toggleInset}
          >
            <Radar size={16} aria-hidden="true" />
          </button>
          <HudMenu
            label={t('driving.hud.more')}
            items={[
              { id: 'wheel', label: t('controller.open'), icon: Gamepad2, onSelect: () => setSetupOpen(true) },
              ...(shot === 'behind'
                ? [{ id: 'reset-camera', label: t('driving.hud.resetCamera'), icon: Locate, onSelect: view.resetCamera }]
                : []),
              ...(isAdmin
                ? [
                    {
                      id: 'free-camera',
                      label: t('driving.camera.freeCamera'),
                      icon: Compass,
                      checked: shot === FREE_CAMERA_VIEW,
                      onSelect: () => moveCamera(`view:${shot === FREE_CAMERA_VIEW ? DEFAULT_CAMERA_VIEW : FREE_CAMERA_VIEW}`),
                    },
                    { id: 'colliders', label: t('driving.hud.showColliders'), icon: Box, checked: showColliders, onSelect: () => setShowColliders((on) => !on) },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      <DrivingStage attempt={attempt} view={view} profile={profile} course={course} showColliders={showColliders}>
        <CourseObjects course={course} core={core} telemetry={telemetry} refs={view.refs} />
      </DrivingStage>

      {setupOpen && <ControllerSetup onClose={() => setSetupOpen(false)} />}

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
        {/* The safety signs at the centre and the proximity inset at the
            right-hand end share the row above the dashboard. */}
        <div className="driving-hud-upper">
          <SafetySigns store={signs} />
          {insetEnabled && <ProximityInsetFrame telemetry={telemetry} frameRef={view.insetFrameRef} />}
        </div>
        {soundSuspended && (
          <button type="button" className="driving-reset-button driving-sound-prompt" onClick={() => getAudioEngine().resume()}>
            <VolumeX size={14} aria-hidden="true" /> {t('driving.hud.enableSound')}
          </button>
        )}
        {hint && <p className="driving-hud-help">{hint}</p>}
        <OperatorDashboard telemetry={telemetry} dashboard={dashboard} keyLegend={profile.keyLegend} pressed={pressed} />
      </div>
    </section>
  )
}

// `profile` is the resolved vehicle profile (lib/vehicleProfile.js): body
// footprint, rig, HUD captions and fail messages. Omitted, it falls back to the
// coded forklift defaults.
export default function DrivingSimulationViewer({ profile = DEFAULT_PROFILE, course, onEvent, className = '', isAdmin = false }) {
  const [resetSeed, setResetSeed] = useState(0)
  // The physics engine is its own chunk, fetched the first time a driving
  // step mounts (lib/physics/rapier.js). An attempt needs it before it can
  // build its simulation core.
  const [physics, setPhysics] = useState('loading')
  const t = useT()
  useEffect(() => {
    let mounted = true
    loadRapier().then(
      () => mounted && setPhysics('ready'),
      () => mounted && setPhysics('failed'),
    )
    return () => {
      mounted = false
    }
  }, [])

  if (physics !== 'ready') {
    return (
      <section className={`driving-simulation ${className}`}>
        <p className="driving-loading" role={physics === 'failed' ? 'alert' : 'status'}>
          {t(physics === 'failed' ? 'driving.hud.loadFailed' : 'driving.hud.loading')}
        </p>
      </section>
    )
  }

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

useGLTF.preload(CONE_MODEL_URL)
useGLTF.preload(PALLET_MODEL_LIGHT_URL)
useGLTF.preload(PALLET_MODEL_MEDIUM_URL)
useGLTF.preload(PALLET_MODEL_HEAVY_URL)
useGLTF.preload(CARGO_BOX_MODEL_URL)
useGLTF.preload(CARGO_BOX_STACK_MODEL_URL)
useGLTF.preload(RACK_MODEL_URL)
