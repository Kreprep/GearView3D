import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { BufferAttribute } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { buildVehicleRig } from '../../lib/vehicleRig'
import { clamp } from '../../lib/math'
import { resolveCourseBounds } from '../../lib/courseGoals'
import { EQUIPMENT_MODEL_URL } from '../../data/equipment'
import { LOOK_MAX_PITCH, LOOK_SENSITIVITY } from '../../lib/driving/constants'
import { cameraShot, FREE_CAMERA_VIEW, glanceTargetYaw } from '../../lib/driving/cameraModes'
import { cabLampLit, cabLampMounts } from '../../lib/driving/cabLamps'
import { rigGeometryMismatches } from '../../lib/driving/rigGeometry'
import { syncView } from '../../lib/driving/syncView'
import { stepCamera } from '../../lib/driving/stepCamera'
import { DeviceLamps } from '../viewer/DeviceLamps'
import { DrivingLoadingPanel } from './DrivingLoadingPanel'
import { InsetRenderer, ProximityRings } from './ProximityInset'

// Head/work light brightness when switched on (candela, three.js's
// physically based light units).
const HEADLIGHT_INTENSITY = 6

// Where the cab switches' lamps sit on the truck (lib/driving/cabLamps.js).
const CAB_LAMPS = cabLampMounts()

// The physics world's colliders as Rapier draws them itself (the admin
// preview's "Show colliders"): what is on screen is exactly what the physics
// simulates. It shows the last step, not the interpolated frame.
function ColliderWireframe({ core }) {
  const geometryRef = useRef(null)
  useFrame(() => {
    const geometry = geometryRef.current
    if (!geometry || !core.physics) return
    const { vertices, colors } = core.physics.debugRender()
    geometry.setAttribute('position', new BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new BufferAttribute(colors, 4))
  })
  return (
    <lineSegments frustumCulled={false} renderOrder={10}>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial vertexColors transparent depthTest={false} />
    </lineSegments>
  )
}

function StageScene({ attempt, view, profile, course, showColliders, children }) {
  const { core, dashboard } = attempt
  const { cameraState, refs, camAdjustedRef, insetFrameRef, insetEnabled } = view
  const { scene } = useGLTF(EQUIPMENT_MODEL_URL)
  const forklift = useMemo(() => cloneSkeleton(scene), [scene])
  const { camera, gl } = useThree()
  const { halfWidth: groundHalfWidth, minZ: courseMinZ, maxZ: courseMaxZ } = useMemo(
    () => resolveCourseBounds(course),
    [course],
  )

  const { rigRef, truckGroupRef, palletObjectsRef, coneObjectsRef, vehicleOrbitRef, lookYawRef, lookPitchRef, glanceRef } = refs
  const sunLightRef = useRef()
  const sunTargetRef = useRef()
  const headlightRef = useRef()
  const headlightTargetRef = useRef()
  // The truck pose syncView drew this frame, for the inset's camera.
  const renderPoseRef = useRef(null)
  const firstPerson = cameraState.view === 'first-person'
  const shot = cameraShot(cameraState)

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

  // Recentre the look-around offset every time first-person is (re-)entered,
  // same idea as the chase-cam's "Reset Camera" button - a leftover look
  // angle from the last session in the seat would be confusing to land in.
  useEffect(() => {
    if (!firstPerson) return
    lookYawRef.current = 0
    lookPitchRef.current = 0
    glanceRef.current = null
  }, [firstPerson, lookYawRef, lookPitchRef, glanceRef])

  // A D-pad glance in first-person eases the look to that side (or behind)
  // and levels it (stepCamera does the easing). Drag-to-look carries on from
  // wherever it is.
  const { glance, glanceCount } = cameraState
  useEffect(() => {
    if (!glanceCount) return
    glanceRef.current = { yaw: glanceTargetYaw(glance, lookYawRef.current), pitch: 0 }
  }, [glance, glanceCount, lookYawRef, glanceRef])

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
      glanceRef.current = null
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
  }, [firstPerson, gl, lookYawRef, lookPitchRef, glanceRef])

  useFrame((_, rawDelta) => {
    const alpha = attempt.frame(rawDelta, { firstPerson, lookYaw: lookYawRef.current, onViewCommand: view.handleViewCommand })

    const pose = syncView(
      {
        truckGroup: truckGroupRef.current,
        rig: rigRef.current,
        palletObjects: palletObjectsRef.current,
        coneObjects: coneObjectsRef.current,
      },
      core.state,
      attempt.prevPose,
      alpha,
      core.world,
      rawDelta,
    )
    renderPoseRef.current = pose
    stepCamera({ ...refs, profile, camera, cameraState, forkHeight: core.state.forks.height, camAdjustedRef }, pose, rawDelta)
    if (headlightRef.current) headlightRef.current.intensity = dashboard.switches.lights ? HEADLIGHT_INTENSITY : 0
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

      {children}

      <group ref={truckGroupRef}>
        <primitive object={forklift} />
        {/* Head/work light on the overhead guard, switched from the dashboard.
            Always mounted and dimmed to 0 when off, since adding or removing a
            light recompiles every material in the scene. */}
        <spotLight ref={headlightRef} position={[0, 0.5, 0.12]} angle={0.55} penumbra={0.5} distance={4} decay={1} intensity={0} color="#fff7d6" />
        <object3D ref={headlightTargetRef} position={[0, 0, 1.6]} />
        {/* The lights, beacon and turn signals, lit from the dashboard's
            switches each frame (no React render). Seen from outside only:
            in first-person they would sit in the operator's view, and the
            cluster's indicators show them there. */}
        {CAB_LAMPS.map((group) => (
          <DeviceLamps
            key={group.id}
            lamps={group.lamps}
            color={group.color}
            radius={group.radius}
            mode={group.mode}
            isOn={() => !firstPerson && cabLampLit(group, dashboard.switches, core.state.truck.engineOn)}
          />
        ))}
        <ProximityRings world={core.world} />
      </group>

      {showColliders && <ColliderWireframe core={core} />}

      <InsetRenderer enabled={insetEnabled} frameRef={insetFrameRef} poseRef={renderPoseRef} />

      {shot === FREE_CAMERA_VIEW && <OrbitControls makeDefault enableDamping dampingFactor={0.15} minDistance={0.5} maxDistance={80} />}
      {shot === 'behind' && (
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

// What every driving composition shares: the canvas, the floor sized to the
// course's bounds, the lights, the truck with its rig and headlight, the
// camera, the proximity inset's render pass and the admin collider overlay.
// It runs the attempt (hooks/useDrivingAttempt.js) once per frame and copies
// the state onto the scene with syncView. What stands on the floor is the
// composition's: pass it as children, using the view's palletObjectsRef and
// coneObjectsRef for anything syncView moves.
export function DrivingStage({ attempt, view, profile, course, showColliders = false, children }) {
  return (
    // PCF shadows: R3F's default soft shadows are deprecated in three 0.184,
    // which renders them as PCF anyway and warns every frame.
    <Canvas
      shadows="percentage"
      dpr={[1, 1.35]}
      camera={{ position: [0, 2, -4], fov: 55 }}
      className={view.shot === 'first-person' ? 'driving-canvas-lookable' : undefined}
      // The scene's <Html> labels (pallet weights, markers) stack inside the
      // canvas, under the HUD and the module's panels.
      style={{ isolation: 'isolate' }}
    >
      <Suspense fallback={<DrivingLoadingPanel />}>
        <StageScene attempt={attempt} view={view} profile={profile} course={course} showColliders={showColliders}>
          {children}
        </StageScene>
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(EQUIPMENT_MODEL_URL)
