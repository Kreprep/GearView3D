import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, Float32BufferAttribute, OrthographicCamera, Vector3 } from 'three'
import { useT } from '../../i18n'
import { useTelemetry } from '../../hooks/useTelemetry'
import { PROXIMITY_BANDS, PROXIMITY_SECTORS, proximityBand } from '../../lib/driving/proximity'
import { m } from '../../lib/driving/units'
import './ProximityInset.css'

// The top-down proximity inset (docs/revisions/post-defense-plan.md, section
// 4.1): a heading-up bird's-eye view around the truck, like a car's parking
// camera, drawn as a second pass of the same scene into a corner of the same
// canvas (one WebGL context), with the nearest obstacle per sector
// (lib/driving/proximity.js) read out around its edge.
//
//   <ProximityRings />        in the truck's group: distance rings and the
//                             truck's outline, on a layer only the inset
//                             camera sees, so they never show in the main view
//   <InsetRenderer />         takes over rendering: main camera, then inset
//   <ProximityInsetFrame />   the HTML frame the inset is drawn into, and the
//                             sector readings. Its box decides where the
//                             inset goes, so CSS alone places it.

export const INSET_LAYER = 1
// Half the inset's side, in scene units (1 unit is about 4 m), and how far
// ahead of the truck's origin it is centred, so there is as much room in
// front of the fork tips as behind the counterweight.
const INSET_HALF_SIZE = 1
const INSET_AHEAD = 0.18
const INSET_HEIGHT = 5
const INSET_CLEAR_COLOR = new Color('#0b1220')

const RING_COLORS = { danger: '#ef4444', caution: '#f59e0b', notice: '#38bdf8' }
const RING_SEGMENTS = 8 // per rounded corner

// The outline of the truck's footprint (body plus forks, as one box: the
// tines are narrower, which the rings round off) grown outward by
// `distance`, with rounded corners: every point on it is `distance` from the
// box. Points in the truck's local frame, on the ground.
function offsetOutlinePoints(halfWidth, rearZ, frontZ, distance) {
  const points = []
  const corners = [
    [halfWidth, frontZ, 0],
    [-halfWidth, frontZ, Math.PI / 2],
    [-halfWidth, rearZ, Math.PI],
    [halfWidth, rearZ, (3 * Math.PI) / 2],
  ]
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= RING_SEGMENTS; i += 1) {
      const angle = start + (i / RING_SEGMENTS) * (Math.PI / 2)
      // +X is the truck's left, +Z its front.
      points.push(cx + Math.cos(angle) * distance, 0, cz + Math.sin(angle) * distance)
    }
  }
  return points
}

function lineGeometry(points) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  return geometry
}

const onInsetLayer = (object) => object?.layers.set(INSET_LAYER)

export function ProximityRings({ world }) {
  const { halfWidth, halfLength, geometry: rig } = world
  const shapes = useMemo(() => {
    const rearZ = -halfLength
    const frontZ = rig.forkTipOffset
    return {
      outline: lineGeometry(offsetOutlinePoints(halfWidth, rearZ, frontZ, 0)),
      rings: Object.entries(PROXIMITY_BANDS).map(([band, distance]) => ({
        band,
        geometry: lineGeometry(offsetOutlinePoints(halfWidth, rearZ, frontZ, distance)),
      })),
    }
  }, [halfWidth, halfLength, rig.forkTipOffset])

  useEffect(
    () => () => {
      shapes.outline.dispose()
      shapes.rings.forEach(({ geometry }) => geometry.dispose())
    },
    [shapes],
  )

  return (
    <group position={[0, 0.012, 0]}>
      <lineLoop ref={onInsetLayer} geometry={shapes.outline}>
        <lineBasicMaterial color="#67e8f9" />
      </lineLoop>
      {shapes.rings.map(({ band, geometry }) => (
        <lineLoop key={band} ref={onInsetLayer} geometry={geometry}>
          <lineBasicMaterial color={RING_COLORS[band]} transparent opacity={0.85} />
        </lineLoop>
      ))}
    </group>
  )
}

// Takes over R3F's render loop (a useFrame with a render priority): renders
// the main camera as usual, then the inset camera into the frame element's
// box with the scissor test. `poseRef` holds the truck pose syncView drew
// this frame. Shadows are not re-rendered for the second pass.
export function InsetRenderer({ enabled, frameRef, poseRef }) {
  const [pass] = useState(createInsetPass)

  useFrame((state) => {
    state.gl.render(state.scene, state.camera)
    if (enabled && frameRef.current && poseRef.current) pass.render(state, frameRef.current, poseRef.current)
  }, 1)

  return null
}

// The second pass, with its own orthographic camera and scratch objects.
function createInsetPass() {
  const camera = new OrthographicCamera(-INSET_HALF_SIZE, INSET_HALF_SIZE, INSET_HALF_SIZE, -INSET_HALF_SIZE, 0.1, 20)
  camera.layers.enable(INSET_LAYER)
  const centre = new Vector3()
  const savedClearColor = new Color()

  return {
    render({ gl, scene, size }, frame, pose) {
      // The frame element's box, in canvas pixels from the bottom left.
      const canvasBox = gl.domElement.getBoundingClientRect()
      const box = frame.getBoundingClientRect()
      const width = Math.min(box.right, canvasBox.right) - Math.max(box.left, canvasBox.left)
      const height = Math.min(box.bottom, canvasBox.bottom) - Math.max(box.top, canvasBox.top)
      if (width <= 1 || height <= 1) return
      const left = Math.max(box.left - canvasBox.left, 0)
      const bottom = Math.max(canvasBox.bottom - box.bottom, 0)

      // Heading-up: looking straight down with the truck's forward as the
      // camera's up, so the operator's left is the inset's left.
      const aspect = width / height
      camera.left = -INSET_HALF_SIZE * aspect
      camera.right = INSET_HALF_SIZE * aspect
      camera.updateProjectionMatrix()
      centre.set(pose.x + pose.forwardX * INSET_AHEAD, pose.y, pose.z + pose.forwardZ * INSET_AHEAD)
      camera.position.set(centre.x, centre.y + INSET_HEIGHT, centre.z)
      camera.up.set(pose.forwardX, 0, pose.forwardZ)
      camera.lookAt(centre)

      gl.getClearColor(savedClearColor)
      const savedClearAlpha = gl.getClearAlpha()
      const shadowAutoUpdate = gl.shadowMap.autoUpdate
      gl.shadowMap.autoUpdate = false
      gl.setClearColor(INSET_CLEAR_COLOR, 1)
      gl.setScissorTest(true)
      gl.setScissor(left, bottom, width, height)
      gl.setViewport(left, bottom, width, height)
      gl.render(scene, camera)
      gl.setScissorTest(false)
      gl.setViewport(0, 0, size.width, size.height)
      gl.setClearColor(savedClearColor, savedClearAlpha)
      gl.shadowMap.autoUpdate = shadowAutoUpdate
    },
  }
}

const SECTOR_FIELDS = Object.fromEntries(
  PROXIMITY_SECTORS.map((sector) => [sector, `proximity${sector[0].toUpperCase()}${sector.slice(1)}`]),
)
const wholeSnapshot = (snapshot) => snapshot
// Centimetres matter when docking, so readings under a metre get two decimals.
const formatMetres = (metres) => metres.toFixed(metres < 1 ? 2 : 1)

export function ProximityInsetFrame({ telemetry, frameRef }) {
  const t = useT()
  const snapshot = useTelemetry(telemetry, wholeSnapshot)

  const readings = PROXIMITY_SECTORS.map((sector) => {
    const metres = snapshot[SECTOR_FIELDS[sector]]
    return { sector, metres, band: proximityBand(metres == null ? null : m(metres)) }
  })
  const summary = readings
    .map(({ sector, metres }) =>
      t('driving.inset.sectorReading', {
        sector: t(`driving.inset.sector.${sector}`),
        reading: metres == null ? t('driving.inset.clear') : t('driving.inset.distance', { distance: formatMetres(metres) }),
      }),
    )
    .join(', ')

  return (
    <div className="proximity-inset" role="img" aria-label={`${t('driving.inset.label')}. ${summary}`}>
      <div ref={frameRef} className="proximity-inset-view" />
      {readings.map(({ sector, metres, band }) =>
        metres == null ? null : (
          <span key={sector} className={`proximity-reading ${sector} ${band}`} aria-hidden="true">
            {t('driving.inset.distance', { distance: formatMetres(metres) })}
          </span>
        ),
      )}
    </div>
  )
}
