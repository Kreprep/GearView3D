import { useRef } from 'react'
import { listCourseItems, snapTo } from '../../lib/courseEdit'
import { RACK_FOOTPRINT } from '../../data/rackProfile'
import './CourseCanvas.css'

// Top-down blueprint of a driving course, drawn from the driver's point of
// view: +Z (forward) runs up the screen and +X runs to the left, because at
// heading 0 the forklift faces +Z and steering right turns it toward -X. That
// keeps left/right on this map the same as left/right in the simulation.

// Point-like markers are drawn at a constant screen size rather than scaled
// with the world, so a cone stays big enough to grab at any zoom.
const CONE_PX = 5
const PALLET_PX = 9
const START_PX = 9

function worldToScreen(bounds, pxPerUnit, x, z) {
  return {
    px: (bounds.maxX - x) * pxPerUnit,
    py: (bounds.maxZ - z) * pxPerUnit,
  }
}

function screenToWorld(bounds, pxPerUnit, px, py) {
  return {
    x: bounds.maxX - px / pxPerUnit,
    z: bounds.maxZ - py / pxPerUnit,
  }
}

// World rotation is around Y (counter-clockwise seen from above). Screen space
// is mirrored on both axes, which leaves the rotation direction unchanged, so
// the angle only has to be converted from radians to SVG degrees.
function rotationDegrees(rotation) {
  return ((rotation || 0) * 180) / Math.PI
}

function ItemShape({ item, pxPerUnit, selected }) {
  const { kind, entry } = item
  const className = `course-item course-item-${kind} ${selected ? 'is-selected' : ''}`

  switch (kind) {
    case 'cone':
      return <circle className={className} r={CONE_PX} />

    case 'wall': {
      const length = (entry.length || 3) * pxPerUnit
      const thickness = Math.max(3, 0.12 * pxPerUnit)
      return (
        <rect
          className={className}
          x={-thickness / 2}
          y={-length / 2}
          width={thickness}
          height={length}
          transform={`rotate(${rotationDegrees(entry.rotation)})`}
        />
      )
    }

    case 'vehicle':
      return (
        <rect
          className={className}
          x={-0.22 * pxPerUnit}
          y={-0.45 * pxPerUnit}
          width={0.44 * pxPerUnit}
          height={0.9 * pxPerUnit}
          transform={`rotate(${rotationDegrees(entry.rotation)})`}
        />
      )

    case 'pallet':
      return <rect className={className} x={-PALLET_PX} y={-PALLET_PX} width={PALLET_PX * 2} height={PALLET_PX * 2} />

    case 'rack':
    case 'rack-empty':
    case 'rack-loaded':
    case 'rack-spare': {
      const width = RACK_FOOTPRINT.halfWidth * 2 * pxPerUnit
      const depth = RACK_FOOTPRINT.halfDepth * 2 * pxPerUnit
      return (
        <rect
          className={className}
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          transform={`rotate(${rotationDegrees(entry.rotation)})`}
        />
      )
    }

    case 'checkpoint':
      if (entry.shape === 'line') {
        const halfWidth = (entry.halfWidth || 3) * pxPerUnit
        const depth = Math.max(4, (entry.lineDepth || 1.4) * pxPerUnit)
        return <rect className={className} x={-halfWidth} y={-depth / 2} width={halfWidth * 2} height={depth} />
      }
      return <circle className={className} r={Math.max(6, (entry.radius || 0.9) * pxPerUnit)} />

    case 'dropZone':
      return <circle className={className} r={Math.max(6, (entry.radius || 0.9) * pxPerUnit)} />

    case 'parkingBay': {
      const width = (entry.width || 0.45) * pxPerUnit
      const depth = (entry.depth || 1) * pxPerUnit
      return (
        <rect
          className={className}
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          transform={`rotate(${rotationDegrees(entry.heading)})`}
        />
      )
    }

    case 'start':
      return (
        <g className={className} transform={`rotate(${rotationDegrees(entry.heading)})`}>
          <circle r={START_PX} />
          <path d={`M 0 ${-START_PX * 2.2} L ${-START_PX * 0.7} ${-START_PX} L ${START_PX * 0.7} ${-START_PX} Z`} />
        </g>
      )

    default:
      return <circle className={className} r={CONE_PX} />
  }
}

function CourseCanvas({
  data,
  bounds,
  driveBounds,
  pxPerUnit,
  snap,
  tool,
  selectedKeys,
  onSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  onPlace,
}) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)

  const width = (bounds.maxX - bounds.minX) * pxPerUnit
  const height = (bounds.maxZ - bounds.minZ) * pxPerUnit
  const items = listCourseItems(data)

  const pointerWorld = (event) => {
    const rect = svgRef.current.getBoundingClientRect()
    return screenToWorld(bounds, pxPerUnit, event.clientX - rect.left, event.clientY - rect.top)
  }

  const handleBackgroundPointerDown = (event) => {
    if (event.button !== 0) return
    if (tool) {
      const { x, z } = pointerWorld(event)
      onPlace(tool, snapTo(x, snap), snapTo(z, snap))
      return
    }
    onSelect(null, false)
  }

  const handleItemPointerDown = (event, item) => {
    if (event.button !== 0 || tool) return
    event.stopPropagation()

    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    onSelect(item.key, additive)

    const { x, z } = pointerWorld(event)
    dragRef.current = { key: item.key, offsetX: item.x - x, offsetZ: item.z - z, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return

    if (!drag.moved) {
      drag.moved = true
      onMoveStart()
    }

    const { x, z } = pointerWorld(event)
    onMove(drag.key, snapTo(x + drag.offsetX, snap), snapTo(z + drag.offsetZ, snap))
  }

  const handlePointerUp = () => {
    if (dragRef.current?.moved) onMoveEnd()
    dragRef.current = null
  }

  // The box the vehicle is actually clamped to in the 3D scene - drawn as a
  // reference rectangle so placing an object outside it is visible before
  // Save, not just flagged by validateCourse() after the fact.
  const driveBoundsRect = driveBounds && (() => {
    const corner1 = worldToScreen(bounds, pxPerUnit, -driveBounds.halfWidth, driveBounds.maxZ)
    const corner2 = worldToScreen(bounds, pxPerUnit, driveBounds.halfWidth, driveBounds.minZ)
    return {
      x: Math.min(corner1.px, corner2.px),
      y: Math.min(corner1.py, corner2.py),
      width: Math.abs(corner2.px - corner1.px),
      height: Math.abs(corner2.py - corner1.py),
    }
  })()

  // One grid line per world unit, with a heavier line every 5.
  const gridLines = []
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    const { px } = worldToScreen(bounds, pxPerUnit, x, 0)
    gridLines.push(<line key={`x${x}`} className={x % 5 === 0 ? 'grid-major' : 'grid-minor'} x1={px} y1={0} x2={px} y2={height} />)
  }
  for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
    const { py } = worldToScreen(bounds, pxPerUnit, 0, z)
    gridLines.push(<line key={`z${z}`} className={z % 5 === 0 ? 'grid-major' : 'grid-minor'} x1={0} y1={py} x2={width} y2={py} />)
  }

  return (
    <div className="course-canvas-scroll">
      <svg
        ref={svgRef}
        className={`course-canvas ${tool ? 'is-placing' : ''}`}
        width={width}
        height={height}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <g className="course-grid">{gridLines}</g>
        {driveBoundsRect && <rect className="course-drive-bounds" {...driveBoundsRect} />}

        {items.map((item) => {
          const { px, py } = worldToScreen(bounds, pxPerUnit, item.x, item.z)
          return (
            <g
              key={item.key}
              transform={`translate(${px} ${py})`}
              onPointerDown={(event) => handleItemPointerDown(event, item)}
            >
              <ItemShape item={item} pxPerUnit={pxPerUnit} selected={selectedKeys.includes(item.key)} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default CourseCanvas
