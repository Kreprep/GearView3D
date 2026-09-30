import { TINE } from '../../data/physicsProfile.js'
import { closestPointOnOrientedRect, forwardGap, forwardGapToCircle, rectRectClosest, toRectLocal } from '../simCollision.js'
import { CONE_RADIUS, PALLET_SOLID_MAX_Y } from './constants.js'
import { wallRectInto } from './stepCollision.js'
import { m, toMetres } from './units.js'

// How close things are to the truck, per sector (docs/revisions/
// post-defense-plan.md, section 4.1): the readout on the top-down proximity
// inset, and the input to the obstacle and tail-swing safety rules (4.5,
// safetySnapshot.js). Pure 2D over the same rects the collision steps use, so
// it runs headless like the rest of the sim.
//
// The truck's outline is its body footprint plus the forks, since the fork
// tips are what reaches an obstacle first going forward. Each obstacle counts
// once, in the sector of the truck's outline nearest to it:
//   front      the front face, the front corners and the forks
//   rear       the rear face
//   left/right the sides
//   rearLeft / rearRight   the rear corners and the rearmost quarter of each
//              side: where the tail swings when a rear-steer truck turns.
// At heading 0 the truck faces +Z and its left is +X (CLAUDE.md, CourseCanvas).

export const PROXIMITY_SECTORS = ['front', 'rear', 'left', 'right', 'rearLeft', 'rearRight']

// Anything further than this is not reported: the inset shows about 6 m
// around the truck.
export const PROXIMITY_RANGE = m(5)

// The inset's distance rings. A distance inside a ring takes its band.
export const PROXIMITY_BANDS = { danger: m(0.5), caution: m(1), notice: m(2) }

// Half the width across both tines' outer edges.
const FORKS_HALF_WIDTH = TINE.centreX + TINE.width / 2
const EDGE_EPSILON = 1e-6

export function proximityBand(distance) {
  if (distance == null) return 'clear'
  if (distance <= PROXIMITY_BANDS.danger) return 'danger'
  if (distance <= PROXIMITY_BANDS.caution) return 'caution'
  if (distance <= PROXIMITY_BANDS.notice) return 'notice'
  return 'clear'
}

// The truck's body and fork rects in world space.
export function truckOutline(state, world) {
  const { x, z, heading } = state.truck
  const { halfWidth, halfLength, geometry } = world
  const forkHalfZ = (geometry.forkTipOffset - halfLength) / 2
  const forkCentre = halfLength + forkHalfZ
  return {
    body: { x, z, rotation: heading, halfX: halfWidth, halfZ: halfLength },
    forks: {
      x: x + Math.sin(heading) * forkCentre,
      z: z + Math.cos(heading) * forkCentre,
      rotation: heading,
      halfX: FORKS_HALF_WIDTH,
      halfZ: forkHalfZ,
    },
  }
}

// Everything the truck can run into, as { kind, rect } or { kind, circle }.
function obstacles(state, world) {
  const found = []
  for (const wall of world.liveWalls) {
    found.push({ kind: wall.type === 'wall' ? 'wall' : 'vehicle', rect: wallRectInto({}, wall, world) })
  }
  for (const rack of world.rackColliders) found.push({ kind: 'rack', rect: rack, id: rack.id })
  for (const pallet of state.pallets) {
    if (pallet.state === 'carried' || pallet.position.y > PALLET_SOLID_MAX_Y) continue
    found.push({
      kind: 'pallet',
      rect: {
        x: pallet.position.x,
        z: pallet.position.z,
        rotation: pallet.rotation.y,
        halfX: pallet.footprint.halfWidth,
        halfZ: pallet.footprint.halfDepth,
      },
    })
  }
  for (const cone of world.liveCones) {
    found.push({ kind: 'cone', circle: { x: cone.position[0], z: cone.position[2], radius: CONE_RADIUS } })
  }
  return found
}

// Nearest point of one truck rect to an obstacle, in the same shape as
// rectRectClosest().
function closestTo(rect, obstacle) {
  if (obstacle.rect) return rectRectClosest(rect, obstacle.rect)
  const { x, z, radius } = obstacle.circle
  const point = closestPointOnOrientedRect(x, z, rect)
  const distance = Math.max(Math.hypot(x - point.x, z - point.z) - radius, 0)
  return { distance, x: point.x, z: point.z, otherX: x, otherZ: z }
}

// Which sector of the truck a closest-point pair falls in. `point` is on the
// truck's outline, `other` on the obstacle, both in the body's local frame.
function sectorOf(point, other, halfX, halfZ) {
  if (point.z >= halfZ - EDGE_EPSILON) return 'front'
  const side = (value) => (value >= 0 ? 'Left' : 'Right')
  if (point.z <= -halfZ + EDGE_EPSILON) {
    // On the rear face. Straight behind reads rear; diagonally off a rear
    // corner (more beside than behind) is the corner's.
    const dx = other.x - point.x
    const dz = other.z - point.z
    const onCorner = Math.abs(point.x) >= halfX - EDGE_EPSILON
    return onCorner && Math.abs(dx) > Math.abs(dz) ? `rear${side(dx)}` : 'rear'
  }
  if (point.z < -halfZ / 2) return `rear${side(point.x)}`
  return side(point.x).toLowerCase()
}

// Nearest obstacle per sector: { [sector]: { distance, kind } | null }, with
// distances in scene units.
export function proximityReadout(state, world) {
  const readout = Object.fromEntries(PROXIMITY_SECTORS.map((sector) => [sector, null]))
  const { body, forks } = truckOutline(state, world)

  for (const obstacle of obstacles(state, world)) {
    const onBody = closestTo(body, obstacle)
    const onForks = closestTo(forks, obstacle)
    const nearest = onForks.distance < onBody.distance ? onForks : onBody
    if (nearest.distance > PROXIMITY_RANGE) continue

    const sector = sectorOf(
      toRectLocal(nearest.x, nearest.z, body),
      toRectLocal(nearest.otherX, nearest.otherZ, body),
      body.halfX,
      body.halfZ,
    )
    if (!readout[sector] || nearest.distance < readout[sector].distance) {
      readout[sector] = { distance: nearest.distance, kind: obstacle.kind }
    }
  }
  return readout
}

// The readout as flat numbers in metres (to the centimetre), so the
// telemetry store's shallow comparison sees an unchanged reading as
// unchanged.
export function proximityTelemetry(readout) {
  const flat = {}
  for (const sector of PROXIMITY_SECTORS) {
    const key = `proximity${sector[0].toUpperCase()}${sector.slice(1)}`
    const reading = readout[sector]
    flat[key] = reading ? Math.round(toMetres(reading.distance) * 100) / 100 : null
  }
  return flat
}

// What the truck would reach first driving straight on, ahead (`direction` 1)
// or behind (-1): { distance, kind }, or null when its path is clear. This is
// what the obstacle-ahead and obstacle-behind safety rules time the truck
// against (docs/revisions/post-defense-plan.md, section 4.5). Unlike the
// readout above it counts only what lies in the path the truck sweeps, its
// own width plus `margin` each side, so a cone beside the lane is not an
// obstacle ahead.
//
// Going forward the path starts at the fork tips, and three things in it are
// where the forks are meant to go, not obstacles (decided 2026-09-30):
// - a pallet on the floor: driving into it is how the forks engage;
// - racking is measured from the truck's body, since the forks reach into a
//   bay;
// - the rack the carried pallet is going to, which the truck has to nose up
//   to.
// Behind, everything counts.
export function pathClearance(state, world, direction, margin = 0) {
  const { body, forks } = truckOutline(state, world)
  const ahead = direction >= 0
  const bodyPath = ahead ? body : { ...body, rotation: body.rotation + Math.PI }
  // Body and forks as one rect, from the rear face to the fork tips: the
  // forks add their length to the front, which moves the centre half of it.
  const truckPath = ahead
    ? {
        ...body,
        x: body.x + Math.sin(body.rotation) * forks.halfZ,
        z: body.z + Math.cos(body.rotation) * forks.halfZ,
        halfZ: body.halfZ + forks.halfZ,
      }
    : bodyPath
  const targetRackId = ahead ? state.pallets[state.carriedIndex]?.def.targetRack ?? null : null

  let nearest = null
  for (const obstacle of obstacles(state, world)) {
    if (ahead && obstacle.kind === 'pallet') continue
    if (obstacle.kind === 'rack' && targetRackId !== null && obstacle.id === targetRackId) continue
    const path = obstacle.kind === 'rack' ? bodyPath : truckPath
    const distance = obstacle.rect ? forwardGap(path, obstacle.rect, margin) : forwardGapToCircle(path, obstacle.circle, margin)
    if (distance === null) continue
    if (!nearest || distance < nearest.distance) nearest = { distance, kind: obstacle.kind }
  }
  return nearest
}
