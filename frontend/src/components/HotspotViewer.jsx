import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Bounds,
  Center,
  ContactShadows,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Loader,
  OrbitControls,
  PerspectiveCamera,
  useBounds,
  useGLTF,
} from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Compass, Eye, Maximize, RotateCcw } from 'lucide-react'
import { CHAIN_NODES } from '../data/defectLibrary'
import { EQUIPMENT_MODEL_URL } from '../data/equipment'
import { defectPose, NO_DEFECT_POSE } from '../lib/defectPose'
import { buildVehicleRig, REAR_WHEEL_KEYS } from '../lib/vehicleRig'
import { CameraFocus, ViewerErrorBoundary, ViewerLoadingPanel } from './viewer/ViewerShared'
import { DefectEffects } from './viewer/DefectEffects'
import { DeviceLamps } from './viewer/DeviceLamps'
import { HotspotMarkers } from './viewer/HotspotMarkers'
import './HotspotViewer.css'

// ---------------------------------------------------------------------------
// Floor tuning - safe to edit by hand.
//
// `<Center top>` grounds the model at y = 0, so these are all relative to the
// wheels touching the floor.
// ---------------------------------------------------------------------------

/** Height of the floor. Keep at 0: anything lower and every model visibly
 *  hovers, anything higher buries the wheels. The floor mesh uses polygonOffset
 *  rather than a gap to stay out of the model's depth range. */
const FLOOR_Y = 0

/** How far the floor extends. Larger = edge sits further away at the horizon.
 *  Too small and the far edge cuts across the middle of the forklift. */
const FLOOR_RADIUS = 9

/** Floor colour. Light greys make the dark oil puddle easy to see. */
const FLOOR_COLOR = '#b8c0cc'

/** Darkness of the shadow under the forklift, 0 (none) to 1 (black). */
const FLOOR_SHADOW_OPACITY = 0.5
const DEFAULT_CAMERA_PRESET = {
  position: [2.2, 1.35, 2.45],
  fov: 42,
  minDistance: 0.65,
  maxDistance: 5.5,
  // Stop the orbit at floor level. Below it the camera looks up from under the
  // ground plane and the grid appears to cut across the forklift.
  maxPolarAngle: Math.PI / 2,
}

/**
 * Frames the model on mount. On reset it first restores the configured camera
 * position and target, because `fit()` alone keeps whatever direction the user
 * has orbited to and would never return to the default view.
 */
function ViewReset({ cameraPreset, controlsRef, resetToken }) {
  const bounds = useBounds()
  const { camera } = useThree()
  const isFirstRun = React.useRef(true)

  React.useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      bounds.refresh().fit()
      return
    }

    camera.position.set(...cameraPreset.position)
    const controls = controlsRef.current
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
    bounds.refresh().fit()
  }, [bounds, camera, cameraPreset, controlsRef, resetToken])

  return null
}

// Control-demo animation tuning (model units - forklift is < 1 unit tall).
const ANIM_DAMP = 8
const STEER_SWING = 0.5
const LIFT_DEMO_HEIGHT = 0.28
const MAST_LIFT_RATIO = 0.5
const TILT_SWING = 0.07
const TRAVEL_DISTANCE = 0.3
const BRAKE_RUN_SPEED = 0.45
const BRAKE_STOP_TIME = 0.9
const BRAKE_DIP = 0.09
// A flat tyre bulges sideways and along as it squashes.
const SQUASH_BULGE = 0.35

function smoothstep(x) {
  const clamped = Math.min(Math.max(x, 0), 1)
  return clamped * clamped * (3 - 2 * clamped)
}

// The model, its device demos and a defect scenario's changes to it. `defects`
// is the scenario's exterior effects (exteriorEffects() in data/
// defectLibrary.js): the rig-driven recipes are posed here each frame
// (lib/defectPose.js), the rest are DefectEffects.
function EquipmentModel({ defects, deviceEffect, adminEditMode, onSurfaceDown, onSurfaceMove, onSurfaceUp }) {
  const { scene } = useGLTF(EQUIPMENT_MODEL_URL)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const rigRef = useRef(null)
  const moveGroupRef = useRef(null)
  const animStateRef = useRef({ start: null, lastZ: 0 })
  const pose = useMemo(() => (defects?.visual?.length ? defectPose(defects.visual) : NO_DEFECT_POSE), [defects])

  // De-skin + pivot rig must run before the material pass so the replacement
  // meshes get the shadow/material treatment too. A layout effect, not a
  // passive one: the parent <Center> measures the model in its own layout
  // effect, and child layout effects run first — so the measure sees the
  // de-skinned meshes with their true on-screen pose, not the raw skinned
  // bbox (wrong by forklift.glb's hidden bone offset).
  React.useLayoutEffect(() => {
    rigRef.current = buildVehicleRig(forklift)
  }, [forklift])

  React.useEffect(() => {
    forklift.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = false

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

  const animation = deviceEffect?.animation || null

  React.useEffect(() => {
    animStateRef.current.start = null
  }, [deviceEffect])

  useFrame(({ clock }, delta) => {
    const rig = rigRef.current
    const move = moveGroupRef.current
    if (!rig || !move) return

    let steerTarget = 0
    let liftTarget = 0
    let tiltTarget = 0
    let travelTarget = 0
    let pitchTarget = 0

    if (animation) {
      if (animStateRef.current.start === null) animStateRef.current.start = clock.elapsedTime
      const t = clock.elapsedTime - animStateRef.current.start

      if (animation === 'steer') {
        // Rear wheels sweep left and right (forklifts steer from the rear),
        // frequency chosen so the sweep ends near centre at the 3s mark.
        steerTarget = Math.sin(t * 2.1) * STEER_SWING
      } else if (animation === 'lift-tilt') {
        // Raise the carriage, tilt the mast back and forward, then lower.
        const up = smoothstep(t / 1.4)
        const down = smoothstep((4.4 - t) / 1.0)
        liftTarget = LIFT_DEMO_HEIGHT * Math.min(up, down)
        if (t > 1.5 && t < 3.3) tiltTarget = TILT_SWING * Math.sin((t - 1.5) * 3.5)
      } else if (animation === 'travel') {
        // Creep forward, reverse back through the start point, and return.
        travelTarget = TRAVEL_DISTANCE * Math.sin((Math.PI * t) / 1.8)
      } else if (animation === 'brake') {
        // Roll forward, stop hard with a nose dip, then reverse back to rest.
        if (t < BRAKE_STOP_TIME) {
          travelTarget = BRAKE_RUN_SPEED * t
        } else {
          travelTarget = BRAKE_RUN_SPEED * BRAKE_STOP_TIME
          pitchTarget = BRAKE_DIP * Math.exp(-5 * (t - BRAKE_STOP_TIME))
          if (t > 2.2) travelTarget *= 1 - smoothstep((t - 2.2) / 1.1)
        }
      }
    }

    // A defect holding the mast tilted (mast-stuck-tilted) holds it there
    // for as long as the scenario is on screen, demo or not.
    if (pose.mastTilt !== null) tiltTarget = pose.mastTilt

    const damp = Math.min(ANIM_DAMP * delta, 1)
    const ease = (object, key, target) => {
      object[key] += (target - object[key]) * damp
    }

    Object.entries(rig.wheels).forEach(([key, wheel]) => {
      const squash = pose.wheelSquash[key] || 0
      ease(wheel.mount.scale, 'y', 1 - squash)
      ease(wheel.mount.scale, 'x', 1 + squash * SQUASH_BULGE)
      ease(wheel.mount.scale, 'z', 1 + squash * SQUASH_BULGE)
    })
    if (rig.carriageLift) ease(rig.carriageLift.rotation, 'z', pose.carriageRoll)
    Object.entries(rig.forks).forEach(([side, fork]) => ease(fork.pivot.rotation, 'x', pose.forkBend[side] || 0))

    REAR_WHEEL_KEYS.forEach((key) => {
      const wheel = rig.wheels[key]
      if (wheel?.steer) wheel.steer.rotation.y += (steerTarget - wheel.steer.rotation.y) * damp
    })
    if (rig.carriageLift) rig.carriageLift.position.y += (liftTarget - rig.carriageLift.position.y) * damp
    if (rig.mastLift) rig.mastLift.position.y += (liftTarget * MAST_LIFT_RATIO - rig.mastLift.position.y) * damp
    if (rig.tiltPivot) rig.tiltPivot.rotation.x += (tiltTarget - rig.tiltPivot.rotation.x) * damp
    move.position.z += (travelTarget - move.position.z) * damp
    move.position.y += (pose.bodyLift - move.position.y) * damp
    move.rotation.x += (pitchTarget + pose.bodyPitch - move.rotation.x) * damp
    move.rotation.z += (pose.bodyRoll - move.rotation.z) * damp

    // Roll all four wheels to match the distance actually travelled.
    const dz = move.position.z - animStateRef.current.lastZ
    animStateRef.current.lastZ = move.position.z
    if (dz !== 0) {
      Object.values(rig.wheels).forEach((wheel) => {
        wheel.spin.rotation.x += dz / wheel.radius
      })
    }
  })

  return (
    <group ref={moveGroupRef}>
      <primitive
        object={forklift}
        onPointerDown={adminEditMode ? onSurfaceDown : undefined}
        onPointerMove={adminEditMode ? onSurfaceMove : undefined}
        onPointerUp={adminEditMode ? onSurfaceUp : undefined}
      />
      {defects && <DefectEffects model={forklift} visual={defects.visual} sounds={defects.sounds} chainNodes={CHAIN_NODES} />}
    </group>
  )
}

function InteractiveScene({
  defects,
  locate,
  hotspots,
  selectedHotspotId,
  resetToken,
  showHotspots,
  cameraPreset,
  deviceEffect,
  freeCam,
  onHotspotSelect,
  adminEditMode,
  placingActive,
  onPlaceHotspot,
  onDragHotspot,
}) {
  const hotspotRefs = useRef(new Map())
  const controlsRef = useRef(null)
  const rigGroupRef = useRef(null)
  const draggingIdRef = useRef(null)

  const localPointFromEvent = (event) => {
    const point = rigGroupRef.current.worldToLocal(event.point.clone())
    return [point.x, point.y, point.z]
  }

  const stopDragging = () => {
    draggingIdRef.current = null
    if (controlsRef.current) controlsRef.current.enabled = true
  }

  const handleSurfacePointerDown = (event) => {
    if (!placingActive) return
    event.stopPropagation()
    onPlaceHotspot?.(localPointFromEvent(event))
  }

  const handleSurfacePointerMove = (event) => {
    if (!draggingIdRef.current) return
    event.stopPropagation()
    onDragHotspot?.(draggingIdRef.current, localPointFromEvent(event))
  }

  const handleMarkerPointerDown = (hotspotId, event) => {
    event.stopPropagation()
    draggingIdRef.current = hotspotId
    if (controlsRef.current) controlsRef.current.enabled = false
  }

  // A drag can end with the pointer off the model (or off the canvas
  // entirely), so releasing must not depend on a pointerup over the mesh.
  useEffect(() => {
    if (!adminEditMode) return undefined
    window.addEventListener('pointerup', stopDragging)
    return () => window.removeEventListener('pointerup', stopDragging)
  }, [adminEditMode])

  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPreset.position} fov={cameraPreset.fov} />
      <ambientLight intensity={1.2} />
      <hemisphereLight args={['#f8fafc', '#1e293b', 1.25]} />
      <directionalLight castShadow position={[2.2, 3, 1.8]} intensity={2.8} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-2.4, 1.8, -2]} intensity={1.2} />

      <Bounds fit clip margin={1.25}>
        <ViewReset cameraPreset={cameraPreset} controlsRef={controlsRef} resetToken={resetToken} />
        {/* Center measures once, when cacheKey first sets, never on child
            updates - which is right, because the model never swaps after
            mount and the device-demo animations must not re-ground it. */}
        <Center top cacheKey={EQUIPMENT_MODEL_URL}>
          <group ref={rigGroupRef} rotation={[0, -0.18, 0]}>
            <EquipmentModel
              defects={defects}
              deviceEffect={deviceEffect}
              adminEditMode={adminEditMode}
              onSurfaceDown={handleSurfacePointerDown}
              onSurfaceMove={handleSurfacePointerMove}
              onSurfaceUp={stopDragging}
            />
            <DeviceLamps lamps={deviceEffect?.lamps} color={deviceEffect?.color} radius={deviceEffect?.radius} mode={deviceEffect?.mode} />
            {/* A locate question's markers: the walk-around parts, unlabelled. */}
            {locate && showHotspots && (
              <HotspotMarkers
                hotspots={locate.hotspots}
                selectedHotspotId={locate.selectedId}
                onSelect={locate.onPick}
                labelFor={locate.labelFor}
              />
            )}
            {!locate && showHotspots && (
              <HotspotMarkers
                hotspots={hotspots}
                selectedHotspotId={selectedHotspotId}
                onSelect={onHotspotSelect}
                hotspotRefs={hotspotRefs}
                adminEditMode={adminEditMode}
                onMarkerPointerDown={handleMarkerPointerDown}
              />
            )}
          </group>
        </Center>
      </Bounds>

      <CameraFocus
        targetId={selectedHotspotId}
        hotspotRefs={hotspotRefs}
        controlsRef={controlsRef}
        resetToken={resetToken}
        cameraPreset={cameraPreset}
      />
      <WarehouseFloor />
      <ContactShadows position={[0, FLOOR_Y + 0.003, 0]} opacity={FLOOR_SHADOW_OPACITY} scale={3} blur={2.2} far={1.2} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.18}
        minDistance={freeCam ? 0.05 : cameraPreset.minDistance}
        maxDistance={freeCam ? 50 : cameraPreset.maxDistance}
        maxPolarAngle={freeCam ? Math.PI : cameraPreset.maxPolarAngle}
      />
      <GizmoHelper alignment="bottom-right" margin={[84, 84]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#f8fafc" />
      </GizmoHelper>
    </>
  )
}

/**
 * Light concrete slab instead of the old dark grid. Dark defects such as the oil
 * puddle were nearly invisible against a dark navy grid; a pale, matte floor
 * gives them contrast and reads as a warehouse bay.
 */
function WarehouseFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <circleGeometry args={[FLOOR_RADIUS, 64]} />
        {/* polygonOffset pushes the floor back in the depth buffer so it can never
            poke through geometry resting on it, such as the fork tips. */}
        <meshStandardMaterial
          color={FLOOR_COLOR}
          roughness={0.96}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {/* Faint joint lines keep a sense of scale without competing with the model. */}
      <Grid
        infiniteGrid
        cellSize={0.25}
        sectionSize={1}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor="#93a0b0"
        sectionColor="#7c8b9d"
        fadeDistance={9}
        fadeStrength={1.4}
        position={[0, FLOOR_Y + 0.002, 0]}
      />
    </group>
  )
}

function filterHotspots(hotspots, activeHotspots) {
  if (!activeHotspots) {
    return hotspots
  }

  const active = new Set(activeHotspots)
  return hotspots.filter((hotspot) => active.has(hotspot.id))
}

// `defects`: a defect scenario's exterior effects (exteriorEffects() in
// data/defectLibrary.js), drawn on the model. `locate`: a locate question's
// markers ({ hotspots, labelFor(hotspot, index), selectedId, onPick }), drawn
// unlabelled in place of the hotspot markers.
export default function HotspotViewer({
  defects = null,
  locate = null,
  activeHotspots,
  hotspots: configuredHotspots = [],
  cameraPreset: configuredCameraPreset,
  onHotspotSelect,
  onResetView,
  selectedHotspotId: controlledHotspotId,
  deviceEffect,
  className = '',
  isAdmin = false,
  adminEditMode = false,
  placingActive = false,
  onPlaceHotspot,
  onDragHotspot,
}) {
  const containerRef = useRef(null)
  const [resetToken, setResetToken] = useState(0)
  const [showHotspots, setShowHotspots] = useState(true)
  const [freeCam, setFreeCam] = useState(false)
  const [internalHotspotId, setInternalHotspotId] = useState(null)
  // Memoized so ViewReset's effect doesn't re-run (and re-snap the camera) on
  // every render.
  const cameraPreset = useMemo(
    () => ({ ...DEFAULT_CAMERA_PRESET, ...(configuredCameraPreset || {}) }),
    [configuredCameraPreset],
  )
  const hotspots = useMemo(() => filterHotspots(configuredHotspots, activeHotspots), [configuredHotspots, activeHotspots])

  // Selection can be driven from outside (e.g. clicking an inspection card in the
  // task panel) so the camera focuses the same way as clicking the marker.
  const selectedHotspotId = controlledHotspotId !== undefined ? controlledHotspotId : internalHotspotId
  const activeSelectedHotspotId = hotspots.some((hotspot) => hotspot.id === selectedHotspotId) ? selectedHotspotId : null

  const handleHotspotSelect = (hotspot) => {
    setInternalHotspotId(hotspot.id)
    onHotspotSelect?.(hotspot)
  }

  // Clearing the selection matters: a still-selected hotspot would make
  // CameraFocus fly straight back to it and undo the reset.
  const resetView = () => {
    setInternalHotspotId(null)
    onResetView?.()
    setResetToken((value) => value + 1)
  }

  const enterFullscreen = async () => {
    if (!containerRef.current || document.fullscreenElement) return
    // Inside a simulation shell the task column is a sibling of the scene, so
    // fullscreen the whole shell to keep it visible.
    const target = containerRef.current.closest('.simulation-shell') || containerRef.current
    await target.requestFullscreen?.()
  }

  return (
    <section className={`interactive-forklift-viewer ${className}`}>
      <div ref={containerRef} className={`interactive-viewer-canvas-shell ${placingActive ? 'placing-active' : ''}`}>
        <div className="interactive-viewer-toolbar">
          <button type="button" onClick={resetView}>
            <RotateCcw size={16} /> Reset
          </button>
          <button type="button" onClick={() => setShowHotspots((value) => !value)}>
            <Eye size={16} /> {showHotspots ? 'Hide' : 'Show'} hotspots
          </button>
          <button type="button" onClick={enterFullscreen}>
            <Maximize size={16} /> Fullscreen
          </button>
          {isAdmin && (
            <button
              type="button"
              className={freeCam ? 'is-active' : ''}
              onClick={() => setFreeCam((value) => !value)}
            >
              <Compass size={16} /> Free Cam {freeCam ? 'On' : 'Off'}
            </button>
          )}
        </div>

        <ViewerErrorBoundary modelUrl={EQUIPMENT_MODEL_URL}>
          <Canvas shadows="percentage" dpr={[1, 1.35]} camera={{ position: cameraPreset.position, fov: cameraPreset.fov }}>
            <Suspense fallback={<ViewerLoadingPanel label="Loading training view" />}>
              <InteractiveScene
                defects={defects}
                locate={locate}
                hotspots={hotspots}
                selectedHotspotId={activeSelectedHotspotId}
                resetToken={resetToken}
                showHotspots={showHotspots}
                cameraPreset={cameraPreset}
                deviceEffect={deviceEffect}
                freeCam={freeCam}
                onHotspotSelect={handleHotspotSelect}
                adminEditMode={adminEditMode}
                placingActive={placingActive}
                onPlaceHotspot={onPlaceHotspot}
                onDragHotspot={onDragHotspot}
              />
            </Suspense>
          </Canvas>
        </ViewerErrorBoundary>
        <Loader />

        <div className="interactive-viewer-help">
          {placingActive
            ? 'Click a point on the model to place the hotspot there'
            : adminEditMode
              ? 'Drag a marker to reposition it - Drag to rotate - Scroll to zoom'
              : 'Drag to rotate - Scroll to zoom - Right-drag to pan'}
        </div>
      </div>
    </section>
  )
}

useGLTF.preload(EQUIPMENT_MODEL_URL)
