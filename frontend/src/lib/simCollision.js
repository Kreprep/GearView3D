// 2D oriented-box collision helpers for the driving simulation.
//
// Everything the course can collide with is an axis-aligned box rotated about
// Y: the vehicle body, walls, parked vehicles, pallets and racks. This module
// is the one place that maths lives, so the frame loop in
// DrivingSimulationViewer reads as rules rather than trigonometry.
//
// A "rect" is `{ x, z, rotation, halfX, halfZ }` in world units, where
// `rotation` is the yaw in radians, local +Z is the object's forward axis and
// local +X is its right axis. That is the same transform the viewer already
// used inline for both its cone test and its wall test:
//
//   localX = dx * cos(rot) - dz * sin(rot)
//   localZ = dx * sin(rot) + dz * cos(rot)
//
// For the vehicle, `rotation` is its heading: at heading 0 it faces +Z, so
// forwardX = sin(h) and forwardZ = cos(h), which the formulas above reduce to.
//
// No three.js here on purpose - lib/courseGoals.js imports this to validate a
// course, and that file also runs inside the Node backend process.
import { clamp } from './math.js'

// A point in the rect's local frame.
export function toRectLocal(px, pz, rect) {
  const dx = px - rect.x
  const dz = pz - rect.z
  const cos = Math.cos(rect.rotation || 0)
  const sin = Math.sin(rect.rotation || 0)
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }
}

export function pointInOrientedRect(px, pz, rect, margin = 0) {
  const local = toRectLocal(px, pz, rect)
  return Math.abs(local.x) <= rect.halfX + margin && Math.abs(local.z) <= rect.halfZ + margin
}

// Shortest distance from a point to the rect's surface, 0 when inside. Used
// for the cone test, where the cone is a circle rather than a box.
export function distanceToOrientedRect(px, pz, rect) {
  const local = toRectLocal(px, pz, rect)
  const edgeX = local.x - clamp(local.x, -rect.halfX, rect.halfX)
  const edgeZ = local.z - clamp(local.z, -rect.halfZ, rect.halfZ)
  return Math.hypot(edgeX, edgeZ)
}

// The rect's four corners in world space.
function rectCorners(rect) {
  const cos = Math.cos(rect.rotation || 0)
  const sin = Math.sin(rect.rotation || 0)
  // Inverse of toRectLocal: world = centre + localX * right + localZ * forward.
  const rightX = cos
  const rightZ = -sin
  const forwardX = sin
  const forwardZ = cos
  const corners = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lx = sx * rect.halfX
      const lz = sz * rect.halfZ
      corners.push([rect.x + lx * rightX + lz * forwardX, rect.z + lx * rightZ + lz * forwardZ])
    }
  }
  return corners
}

function projectionRange(corners, axisX, axisZ) {
  let min = Infinity
  let max = -Infinity
  for (const [cx, cz] of corners) {
    const projection = cx * axisX + cz * axisZ
    if (projection < min) min = projection
    if (projection > max) max = projection
  }
  return { min, max }
}

function rectAxes(rect) {
  const cos = Math.cos(rect.rotation || 0)
  const sin = Math.sin(rect.rotation || 0)
  return [
    [cos, -sin], // local +X (right)
    [sin, cos], // local +Z (forward)
  ]
}

// Separating-axis test over the four box normals, returning the minimum
// translation that would push `a` out of `b` - or null when they are apart.
// `{ depth, axisX, axisZ }` points away from `b`.
export function orientedRectOverlap(a, b, margin = 0) {
  const cornersA = rectCorners(a)
  const cornersB = rectCorners(b)
  let best = null

  for (const [axisX, axisZ] of [...rectAxes(a), ...rectAxes(b)]) {
    const rangeA = projectionRange(cornersA, axisX, axisZ)
    const rangeB = projectionRange(cornersB, axisX, axisZ)
    const overlap = Math.min(rangeA.max, rangeB.max) - Math.max(rangeA.min, rangeB.min) + margin
    if (overlap <= 0) return null
    if (!best || overlap < best.depth) {
      // Orient the axis so it points from b's centre toward a's.
      const centreDelta = (a.x - b.x) * axisX + (a.z - b.z) * axisZ
      const sign = centreDelta < 0 ? -1 : 1
      best = { depth: overlap, axisX: axisX * sign, axisZ: axisZ * sign }
    }
  }

  return best
}

export function orientedRectsOverlap(a, b, margin = 0) {
  return orientedRectOverlap(a, b, margin) !== null
}
