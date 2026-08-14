import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Bounds,
  Center,
  ContactShadows,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
  Loader,
  OrbitControls,
  PerspectiveCamera,
  useBounds,
  useGLTF,
} from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { Compass, Eye, Maximize, RotateCcw, Ruler } from 'lucide-react'
import { buildVehicleRig, REAR_WHEEL_KEYS } from '../lib/vehicleRig'
import { CameraFocus, ViewerErrorBoundary, ViewerLoadingPanel } from './viewer/ViewerShared'
import './HotspotViewer.css'

const DEFAULT_MODEL_URL = '/models/forklift.glb'

// ---------------------------------------------------------------------------
// Floor tuning - safe to edit by hand.
//
// `<Center top>` grounds the model at y = 0, and the scale-reference objects
// are built to stand at y = 0 too, so these are all relative to the wheels
// touching the floor.
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

function getScenarioResult(hotspot, scenario) {
  const unsafe = (hotspot.unsafeScenarios || []).includes(scenario)

  return {
    ...hotspot,
    result: unsafe ? 'unsafe' : 'safe',
    feedback: unsafe ? hotspot.unsafeFeedback : hotspot.safeFeedback,
  }
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

function smoothstep(x) {
  const clamped = Math.min(Math.max(x, 0), 1)
  return clamped * clamped * (3 - 2 * clamped)
}

function EquipmentModel({ modelUrl, modelScale, deviceEffect, adminEditMode, onSurfaceDown, onSurfaceMove, onSurfaceUp }) {
  const { scene } = useGLTF(modelUrl)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const rigRef = useRef(null)
  const moveGroupRef = useRef(null)
  const animStateRef = useRef({ start: null, lastZ: 0 })

  // De-skin + pivot rig must run before the material pass so the replacement
  // meshes get the shadow/material treatment too. A layout effect, not a
  // passive one: the parent <Center> measures the model in its own layout
  // effect, and child layout effects run first — so the measure sees the
  // de-skinned meshes with their true on-screen pose, not the raw skinned
  // bbox (wrong by the hidden bone offset on some models).
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

    const damp = Math.min(ANIM_DAMP * delta, 1)

    REAR_WHEEL_KEYS.forEach((key) => {
      const wheel = rig.wheels[key]
      if (wheel?.steer) wheel.steer.rotation.y += (steerTarget - wheel.steer.rotation.y) * damp
    })
    if (rig.carriageLift) rig.carriageLift.position.y += (liftTarget - rig.carriageLift.position.y) * damp
    if (rig.mastLift) rig.mastLift.position.y += (liftTarget * MAST_LIFT_RATIO - rig.mastLift.position.y) * damp
    if (rig.tiltPivot) rig.tiltPivot.rotation.x += (tiltTarget - rig.tiltPivot.rotation.x) * damp
    move.position.z += (travelTarget - move.position.z) * damp
    move.rotation.x += (pitchTarget - move.rotation.x) * damp

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
    <group ref={moveGroupRef} scale={modelScale || 1}>
      <primitive
        object={forklift}
        onPointerDown={adminEditMode ? onSurfaceDown : undefined}
        onPointerMove={adminEditMode ? onSurfaceMove : undefined}
        onPointerUp={adminEditMode ? onSurfaceUp : undefined}
      />
    </group>
  )
}

/**
 * Known-good reference objects the admin can toggle on beside the equipment
 * model, so a mis-scaled GLB (a common problem: authoring software using cm
 * or mixed units) is obvious at a glance rather than guessed at. Forklift.glb
 * is the scale baseline every equipment model is judged against - it renders
 * at its native size, no scale applied. The human figure is a plain capsule
 * mannequin (no GLB asset exists for one), sized to read as a bit shorter
 * than the forklift baseline rather than to a literal real-world metre
 * figure - forklift.glb's own native scale is not true-to-life (its actual
 * modeled height comes out under 1.7m), so a true 1.7m figure would render
 * taller than the forklift and read as backwards. The box reuses
 * cardboard-box's driving-course scale (0.25), already calibrated to
 * real-world metres there.
 */
const REFERENCE_HUMAN_HEIGHT = 0.40
const REFERENCE_BOX_SCALE = 0.25
const REFERENCE_BOX_URL = '/models/cardboard-box.glb'

function ReferenceLabel({ height, children }) {
  return (
    <Html center position={[0, height + 0.12, 0]} distanceFactor={2.4}>
      <span className="scale-reference-label">{children}</span>
    </Html>
  )
}

/** Bottom- and centre-aligns a cloned GLB scene so it stands on the floor
 *  regardless of how its own pivot was authored - the same trust-nothing
 *  approach that motivated this feature in the first place. */
function useGroundedClone(url, scale) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const clone = cloneSkeleton(scene)
    clone.scale.setScalar(scale)
    clone.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(clone)
    clone.position.x -= (box.min.x + box.max.x) / 2
    clone.position.z -= (box.min.z + box.max.z) / 2
    clone.position.y -= box.min.y
    return clone
  }, [scene, scale])
}

function ReferenceBox({ x }) {
  const clone = useGroundedClone(REFERENCE_BOX_URL, REFERENCE_BOX_SCALE)
  return (
    <group position={[x, 0, 0]}>
      <primitive object={clone} />
      <ReferenceLabel height={REFERENCE_BOX_SCALE}>Cardboard box</ReferenceLabel>
    </group>
  )
}

/**
 * Forklift.glb's parts are SkinnedMesh, rigidly bound to a bone whose node
 * transform carries a hidden offset that skinning cancels at render time (see
 * EquipmentModel above and buildVehicleRig's own comments) - a naive
 * `Box3.setFromObject` on the raw clone reads that uncancelled offset and
 * reports the model floating about 0.65 units above where it actually
 * renders. `buildVehicleRig` de-skins the same way EquipmentModel does,
 * which is what makes the ground alignment correct; skip useGroundedClone's
 * generic bbox approach for this one model.
 */
function ReferenceForklift({ x }) {
  const { scene } = useGLTF(DEFAULT_MODEL_URL)
  const clone = useMemo(() => cloneSkeleton(scene), [scene])

  // A passive effect runs after paint, which is too late: <Center> measures
  // in its own layout effect, and child layout effects fire first (see
  // EquipmentModel above), so buildVehicleRig has to be a layout effect too
  // or Center measures the still-skinned clone and grounds it wildly wrong.
  React.useLayoutEffect(() => {
    buildVehicleRig(clone)
  }, [clone])

  useEffect(() => {
    clone.traverse((object) => {
      if (!object.isMesh) return
      const wasArray = Array.isArray(object.material)
      const materials = wasArray ? object.material : [object.material]
      const cloned = materials.map((material) => {
        const next = material.clone()
        next.transparent = true
        next.opacity = 0.35
        next.depthWrite = false
        return next
      })
      object.material = wasArray ? cloned : cloned[0]
    })
  }, [clone])

  return (
    <group position={[x, 0, 0]}>
      <Center top cacheKey={DEFAULT_MODEL_URL}>
        <primitive object={clone} />
      </Center>
      <ReferenceLabel height={1}>Forklift (baseline)</ReferenceLabel>
    </group>
  )
}

function ReferenceHuman({ x }) {
  const headRadius = 0.075
  const bodyRadius = 0.1
  const bodyLength = REFERENCE_HUMAN_HEIGHT - headRadius * 2 - bodyRadius * 2
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, bodyRadius + bodyLength / 2, 0]}>
        <capsuleGeometry args={[bodyRadius, bodyLength, 4, 12]} />
        <meshStandardMaterial color="#f59e0b" transparent opacity={0.55} roughness={0.6} />
      </mesh>
      <mesh position={[0, REFERENCE_HUMAN_HEIGHT - headRadius, 0]}>
        <sphereGeometry args={[headRadius, 16, 16]} />
        <meshStandardMaterial color="#f59e0b" transparent opacity={0.55} roughness={0.6} />
      </mesh>
      <ReferenceLabel height={REFERENCE_HUMAN_HEIGHT}>Average adult</ReferenceLabel>
    </group>
  )
}

/** Row of scale references beside the model. Spacing is generous and fixed
 *  rather than derived from the model's own (possibly wrong) bounding box. */
function ScaleReference() {
  return (
    <group>
      <ReferenceForklift x={-0.9} />
      <ReferenceHuman x={0.5} />
      <ReferenceBox x={0.9} />
    </group>
  )
}

function TrainingHotspot({ hotspot, selected, scenario, onSelect, hotspotRefs, adminEditMode, onMarkerPointerDown }) {
  const result = getScenarioResult(hotspot, scenario)

  return (
    <group
      position={hotspot.position}
      ref={(node) => {
        if (node) hotspotRefs.current.set(hotspot.id, node)
        else hotspotRefs.current.delete(hotspot.id)
      }}
    >
      <Html center zIndexRange={[100, 0]} occlude={false}>
        <div className="hotspot-marker-wrap">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(result)
            }}
            onPointerDown={adminEditMode ? (event) => onMarkerPointerDown?.(hotspot.id, event) : undefined}
            className={`hotspot-marker ${result.result === 'unsafe' ? 'unsafe' : ''} ${selected ? 'selected' : ''} ${adminEditMode ? 'admin-editable' : ''}`}
            aria-label={hotspot.label}
          />
          <span className="hotspot-marker-tooltip">{hotspot.label}</span>
        </div>
      </Html>
    </group>
  )
}

/** Glowing lamp played on the model while a safety device is being tested. */
function DeviceLamp({ position, color, radius, blink }) {
  const meshRef = useRef(null)
  const lightRef = useRef(null)

  useFrame(({ clock }) => {
    // 5 Hz square-ish flash for blinking devices, steady otherwise.
    const on = blink ? Math.sin(clock.getElapsedTime() * 16) > 0 : true
    const level = on ? 1 : 0.05

    if (meshRef.current) {
      meshRef.current.material.opacity = 0.35 + level * 0.55
      meshRef.current.material.emissiveIntensity = level * 3
    }
    if (lightRef.current) {
      lightRef.current.intensity = level * 1.6
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} transparent toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} color={color} distance={0.7} decay={2} />
    </group>
  )
}

function DeviceEffect({ effect }) {
  if (!effect?.lamps?.length) return null

  return (
    <group>
      {effect.lamps.map((position, index) => (
        <DeviceLamp
          key={`${position.join(',')}-${index}`}
          position={position}
          color={effect.color}
          radius={effect.radius ?? 0.04}
          blink={effect.mode === 'blink'}
        />
      ))}
    </group>
  )
}

function PuddleOverlay({ id, position, rotation, radius, label, feedback, onScenarioAction }) {
  const emit = () => onScenarioAction?.({ id, type: 'defect', feedback })

  return (
    <group>
      <mesh position={position} rotation={rotation} onClick={(event) => { event.stopPropagation(); emit() }}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color="#111111" transparent opacity={0.72} />
      </mesh>
      <Html center position={[position[0], position[1] + 0.056, position[2]]} distanceFactor={2.4}>
        <button type="button" className="viewer-warning-label" onClick={emit}>
          {label}
        </button>
      </Html>
    </group>
  )
}

function MarkerOverlay({ id, position, label, feedback, onScenarioAction }) {
  const emit = () => onScenarioAction?.({ id, type: 'defect', feedback })

  return (
    <Html center position={position} distanceFactor={2.4}>
      <button type="button" className="viewer-tire-warning" onClick={emit}>
        <strong>!</strong>
        <span>{label}</span>
      </button>
    </Html>
  )
}

function InteractiveScene({
  modelUrl,
  modelScale,
  modelOffsetY,
  scenario,
  hotspots,
  defectOverlays,
  selectedHotspotId,
  resetToken,
  showHotspots,
  showScaleReference,
  cameraPreset,
  deviceEffect,
  freeCam,
  onHotspotSelect,
  onScenarioAction,
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
        {showScaleReference && <ScaleReference />}
        {/* Center measures only when cacheKey changes, never on child updates -
            without the key it keeps the offset computed for the model/scale it
            mounted with (often the forklift default while the equipment row is
            still loading), leaving the swapped-in model floating or buried.

            `position` lands on Center's outermost group, above the centering
            transform it computes, so the height nudge shifts the grounded model
            instead of being cancelled by the next measurement. It deliberately
            does not move the scale references, which stand on the floor. */}
        <Center top cacheKey={`${modelUrl}:${modelScale || 1}`} position={[0, modelOffsetY || 0, 0]}>
          <group ref={rigGroupRef} rotation={[0, -0.18, 0]}>
            <EquipmentModel
              modelUrl={modelUrl}
              modelScale={modelScale}
              deviceEffect={deviceEffect}
              adminEditMode={adminEditMode}
              onSurfaceDown={handleSurfacePointerDown}
              onSurfaceMove={handleSurfacePointerMove}
              onSurfaceUp={stopDragging}
            />
            <DeviceEffect effect={deviceEffect} />
            {defectOverlays
              .filter((overlay) => overlay.scenario === scenario)
              .map((overlay) =>
                overlay.type === 'puddle' ? (
                  <PuddleOverlay key={overlay.id} {...overlay} onScenarioAction={onScenarioAction} />
                ) : (
                  <MarkerOverlay key={overlay.id} {...overlay} onScenarioAction={onScenarioAction} />
                ),
              )}
            {showHotspots &&
              hotspots.map((hotspot) => (
                <TrainingHotspot
                  key={hotspot.id}
                  hotspot={hotspot}
                  scenario={scenario}
                  selected={selectedHotspotId === hotspot.id}
                  onSelect={onHotspotSelect}
                  hotspotRefs={hotspotRefs}
                  adminEditMode={adminEditMode}
                  onMarkerPointerDown={handleMarkerPointerDown}
                />
              ))}
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

export default function HotspotViewer({
  scenario = 'good-forklift',
  activeHotspots,
  hotspots: configuredHotspots = [],
  defectOverlays = [],
  cameraPreset: configuredCameraPreset,
  onHotspotSelect,
  onScenarioAction,
  onResetView,
  selectedHotspotId: controlledHotspotId,
  deviceEffect,
  modelUrl = DEFAULT_MODEL_URL,
  modelScale = 1,
  modelOffsetY = 0,
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
  const [showScaleReference, setShowScaleReference] = useState(false)
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

  // Toggling reference objects changes what Bounds needs to frame, so refit
  // the camera the same way Reset does.
  const toggleScaleReference = () => {
    setShowScaleReference((value) => !value)
    setResetToken((value) => value + 1)
  }

  const enterFullscreen = async () => {
    if (!containerRef.current || document.fullscreenElement) return
    // Inside a simulation shell the panels and control bar are siblings of the
    // scene, so fullscreen the whole shell to keep them visible.
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
          {isAdmin && (
            <button
              type="button"
              className={showScaleReference ? 'is-active' : ''}
              onClick={toggleScaleReference}
            >
              <Ruler size={16} /> {showScaleReference ? 'Hide' : 'Show'} scale reference
            </button>
          )}
        </div>

        <ViewerErrorBoundary modelUrl={modelUrl}>
          <Canvas shadows dpr={[1, 1.35]} camera={{ position: cameraPreset.position, fov: cameraPreset.fov }}>
            <Suspense fallback={<ViewerLoadingPanel label="Loading training view" />}>
              <InteractiveScene
                modelUrl={modelUrl}
                modelScale={modelScale}
                modelOffsetY={modelOffsetY}
                scenario={scenario}
                hotspots={hotspots}
                defectOverlays={defectOverlays}
                selectedHotspotId={activeSelectedHotspotId}
                resetToken={resetToken}
                showHotspots={showHotspots}
                showScaleReference={showScaleReference}
                cameraPreset={cameraPreset}
                deviceEffect={deviceEffect}
                freeCam={freeCam}
                onHotspotSelect={handleHotspotSelect}
                onScenarioAction={onScenarioAction}
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

useGLTF.preload(DEFAULT_MODEL_URL)
