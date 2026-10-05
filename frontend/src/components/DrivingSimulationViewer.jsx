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
import { palletTarget } from '../lib/coursePallets'
import { deratedCapacityKg } from '../lib/physics/loadChart'
import { seatedLoadCentreM } from '../data/physicsProfile'
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
// A checkpoint's marker state: in order, or in a mission by its task.
function checkpointStatus(checkpoint, index, { checkpointIndex, missionIndex, tasks }) {
  if (missionIndex === null) return index < checkpointIndex ? 'done' : index === checkpointIndex ? 'active' : 'pending'
  const taskIndex = tasks.findIndex((task) => task.type === 'checkpoint' && task.ref === checkpoint.id)
  if (taskIndex === -1) return 'pending'
  return taskIndex < missionIndex ? 'done' : taskIndex === missionIndex ? 'active' : 'pending'
}

function CourseObjects({ course, core, telemetry, refs }) {
  const checkpoints = course.checkpoints || []
  const { pallets, racks, liveCones, dropZones } = core.world
  const { palletObjectsRef, coneObjectsRef } = refs
  const checkpointIndex = useTelemetry(telemetry, (snapshot) => snapshot.checkpointIndex)
  const missionIndex = useTelemetry(telemetry, (snapshot) => snapshot.missionIndex)
  const delivered = useTelemetry(telemetry, (snapshot) => snapshot.deliveredPallets)
  const parked = useTelemetry(telemetry, (snapshot) => snapshot.parked)
  const deliveredIds = new Set(delivered ? delivered.split(',') : [])
  const progress = { checkpointIndex, missionIndex, tasks: core.world.mission || [] }
  // A zone shows delivered once a pallet bound for it is: one that names
  // it, or with a single zone, one that names none.
  const zoneDelivered = (zone) =>
    pallets.some((palletDef) => {
      const target = palletTarget(palletDef)
      const boundHere = target?.zone ? target.zone === zone.id : !target && dropZones.length === 1
      return boundHere && deliveredIds.has(palletDef.id)
    })
  const singleTarget = pallets.length === 1 ? palletTarget(pallets[0]) : null

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

      {checkpoints.length === 0 && pallets.length === 1 && !singleTarget?.rack && dropZones.length === 1 && (
        <PathBreadcrumbs points={[course.start?.position || [0, 0, 0], pallets[0].position, dropZones[0].position]} />
      )}

      {checkpoints.length === 0 && singleTarget?.rack && (
        <PathBreadcrumbs
          points={[
            course.start?.position || [0, 0, 0],
            pallets[0].position,
            racks.find((rack) => rack.id === singleTarget.rack)?.position,
          ].filter(Boolean)}
        />
      )}

      {checkpoints.length === 0 && course.parkingBay && (
        <PathBreadcrumbs points={[course.start?.position || [0, 0, 0], course.parkingBay.position]} />
      )}

      {checkpoints.map((checkpoint, index) => (
        <CheckpointMarker key={checkpoint.id} checkpoint={checkpoint} status={checkpointStatus(checkpoint, index, progress)} />
      ))}

      {course.decorations && (
        <CourseDecorations decorations={course.decorations} />
      )}
      {liveCones.length > 0 && <ObstacleCones obstacles={liveCones} coneRefs={coneObjectsRef} />}
      {racks.length > 0 && <CourseRacks racks={racks} />}
      {pallets.map((palletDef) => {
        const target = palletTarget(palletDef)
        const targetRack = target?.rack && racks.find((rack) => rack.id === target.rack)
        if (!targetRack) return null
        return (
          <RackLevelMarker
            key={`${palletDef.id}-target`}
            rack={targetRack}
            level={target.level}
            delivered={deliveredIds.has(palletDef.id)}
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
          overweight={typeof course.capacityKg === 'number' && (palletDef.weightKg ?? 0) > deratedCapacityKg(course.capacityKg, seatedLoadCentreM(palletDef))}
          loadCentreM={palletDef.loadOffsetM ? seatedLoadCentreM(palletDef) : null}
        />
      ))}
      {dropZones.map((zone) => (
        <DropZoneMarker key={zone.id} zone={zone} delivered={zoneDelivered(zone)} />
      ))}
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
  const { checkpointIndex, missionIndex, palletState, parkingStatus, parked } = hud
  const hint = drivingHint(t, hud, shot)

  const checkpoints = course.checkpoints || []
  const tasks = core.world.mission || []
  // Stored courses always use `pallets`; the singular `pallet` is the older
  // hand-written shape kept working here.
  const hasPallet = Boolean(course.pallets?.length || course.pallet)

  return (
    <section className={`driving-simulation ${className}`}>
      <div className="driving-hud-top">
        {/* Course objective and progress only: the operator dashboard at the
            bottom carries the truck's own readings. */}
        <div className="driving-hud-status">
          {missionIndex !== null && (
            <span className="driving-checkpoint-badge">
              {missionIndex >= tasks.length
                ? t('driving.hud.missionComplete')
                : t('driving.hud.task', { index: missionIndex + 1, total: tasks.length, label: tasks[missionIndex].label || '' })}
            </span>
          )}
          {missionIndex === null && checkpoints.length > 0 && (
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
