// Cone-layout generators shared by the seeded courses in data/drivingCourse.js
// and the admin course editor's insert tools. Both produce plain cone arrays -
// the editor bakes generator output into the course's decorations list, so
// every cone stays individually movable and deletable afterwards.
//
// All coordinates are ground-plane world units; y is always 0.

function round(value) {
  return Math.round(value * 100) / 100
}

// Medium-density boundary cone line bounding one edge of a drivable corridor.
// `spacing` of ~2-2.5 world units (8-10m) reads as "medium" - tight enough to
// read as a wall of cones, loose enough not to be a solid line.
export function coneLine(x, zStart, zEnd, spacing = 2.4) {
  const cones = []
  for (let z = zStart; z <= zEnd + 1e-6; z += spacing) {
    cones.push({ type: 'cone', position: [round(x), 0, round(z)] })
  }
  return cones
}

// Classic single-file slalom: individual cones alternating left/right, like a
// real autocross layout. A point cone can't physically block a straight line,
// so pair these with slalomCheckpoints() - the forklift must swing over to
// clear each checkpoint in order, which is what forces the weave.
export function slalomCones(amplitude, zStart, spacing, count) {
  return Array.from({ length: count }, (_, i) => ({
    type: 'cone',
    position: [i % 2 === 0 ? amplitude : -amplitude, 0, round(zStart + i * spacing)],
  }))
}

export function slalomCheckpoints(amplitude, zStart, spacing, count, { radius = 0.6, idPrefix = 'slalom', labelPrefix = 'Slalom Gate' } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const x = (i % 2 === 0 ? amplitude : -amplitude) * 0.6
    const z = round(zStart + i * spacing)
    return {
      id: `${idPrefix}-${i + 1}`,
      type: 'pass',
      position: [x, 0, z],
      radius,
      label: `${labelPrefix} ${i + 1}`,
      completeMessage: `${labelPrefix} ${i + 1} clear - keep weaving through the cones.`,
    }
  })
}

// Dense cone corridor that follows a polyline path (waypoints as [x, z] world
// coordinates, in the order the course is driven), placing cones halfWidth to
// each side at ~spacing intervals along every leg - a narrow, winding "chute"
// that hugs the actual driving line instead of a fixed straight lane.
export function corridorCones(waypoints, halfWidth, spacing) {
  const cones = []

  for (let seg = 0; seg < waypoints.length - 1; seg += 1) {
    const [x1, z1] = waypoints[seg]
    const [x2, z2] = waypoints[seg + 1]
    const dx = x2 - x1
    const dz = z2 - z1
    const len = Math.hypot(dx, dz) || 1
    const steps = Math.max(Math.round(len / spacing), 1)
    const nx = -dz / len
    const nz = dx / len

    for (let i = seg === 0 ? 0 : 1; i <= steps; i += 1) {
      const t = i / steps
      const x = x1 + dx * t
      const z = z1 + dz * t
      cones.push({ type: 'cone', position: [round(x + nx * halfWidth), 0, round(z + nz * halfWidth)] })
      cones.push({ type: 'cone', position: [round(x - nx * halfWidth), 0, round(z - nz * halfWidth)] })
    }
  }

  return cones
}

// Cone-marked rectangular pocket (a cone at each corner) - the standard
// driving-test parallel-parking box layout.
export function coneBox({ x, z, width, depth }, margin = 0.15) {
  const halfW = width / 2 + margin
  const halfD = depth / 2 + margin
  return [
    { type: 'cone', position: [round(x - halfW), 0, round(z - halfD)] },
    { type: 'cone', position: [round(x + halfW), 0, round(z - halfD)] },
    { type: 'cone', position: [round(x - halfW), 0, round(z + halfD)] },
    { type: 'cone', position: [round(x + halfW), 0, round(z + halfD)] },
  ]
}

// Cone-marked bay open on one side (the entry) - three walls of cones like a
// driving-test reverse-parking box. `openSide` is the local +Z/-Z/+X/-X edge
// left clear for entry (heading 0 courses enter from -Z, so 'front' = -Z).
export function coneBay({ x, z, width, depth }, margin = 0.15, openSide = 'front') {
  const halfW = width / 2 + margin
  const halfD = depth / 2 + margin
  const left = round(x - halfW)
  const right = round(x + halfW)
  const front = round(z - halfD)
  const back = round(z + halfD)
  const mid = round((front + back) / 2)
  const cones = []

  if (openSide !== 'left') cones.push({ type: 'cone', position: [left, 0, front] }, { type: 'cone', position: [left, 0, mid] })
  if (openSide !== 'right') cones.push({ type: 'cone', position: [right, 0, front] }, { type: 'cone', position: [right, 0, mid] })
  if (openSide !== 'back') {
    cones.push(
      { type: 'cone', position: [left, 0, back] },
      { type: 'cone', position: [round((left + right) / 2), 0, back] },
      { type: 'cone', position: [right, 0, back] },
    )
  }

  return cones
}
