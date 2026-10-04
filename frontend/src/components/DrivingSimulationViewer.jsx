import { useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { DoubleSide } from 'three'
import { RotateCcw, VolumeX } from 'lucide-react'
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
import { DrivingHudActions } from './driving/DrivingHudActions'
import { drivingHint } from '../lib/driving/hudHint'
import { PhysicsGate } from './driving/PhysicsGate'
import './DrivingSimulationViewer.css'

// The coded forklift numbers, used whenever no profile is passed.
// resolveVehicleProfile() lays the Equipment row's overrides over them.
const DEFAULT_PROFILE = resolveVehicleProfile(null)

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
  const { shot, insetEnabled } = view
  const [showColliders, setShowColliders] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const soundSuspended = useAudioSuspended()
  const t = useT()

  const hud = useTelemetry(telemetry, (snapshot) => snapshot)
  const { checkpointIndex, palletState, parkingStatus, parked } = hud
  const hint = drivingHint(t, hud, shot)

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
        <DrivingHudActions
          view={view}
          isAdmin={isAdmin}
          onReset={onRequestReset}
          onWheelSetup={() => setSetupOpen(true)}
          showColliders={showColliders}
          onToggleColliders={() => setShowColliders((on) => !on)}
        />
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
  return (
    <PhysicsGate className={className}>
      <DrivingSimulationInner
        key={`${course.id}-${resetSeed}`}
        profile={profile}
        course={course}
        onEvent={onEvent}
        onRequestReset={() => setResetSeed((value) => value + 1)}
        className={className}
        isAdmin={isAdmin}
      />
    </PhysicsGate>
  )
}

useGLTF.preload(CONE_MODEL_URL)
useGLTF.preload(PALLET_MODEL_LIGHT_URL)
useGLTF.preload(PALLET_MODEL_MEDIUM_URL)
useGLTF.preload(PALLET_MODEL_HEAVY_URL)
useGLTF.preload(CARGO_BOX_MODEL_URL)
useGLTF.preload(CARGO_BOX_STACK_MODEL_URL)
useGLTF.preload(RACK_MODEL_URL)
