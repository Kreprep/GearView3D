// The normalised operator input every input source writes and the sim steps
// read (docs/revisions/post-defense-plan.md, section 3.4). Analog values are
// 0..1 or -1..1, so a keyboard, a wheel and the on-screen dashboard all look
// the same to the simulation.
//
// Pure, no browser APIs: sources adapt their device into this shape, and
// mergeControls() combines them.

export const DIRECTIONS = ['F', 'N', 'R']

export function neutralControls() {
  return {
    throttle: 0, // 0..1
    brake: 0, // 0..1
    inching: 0, // 0..1, the IC forklift's inching pedal (a wheel's clutch pedal)
    steer: 0, // -1 (full right) .. 1 (full left), same sign as the old turnInput
    direction: 'N', // direction lever: 'F' | 'N' | 'R'
    lift: 0, // -1 (lower) .. 1 (raise)
    tilt: 0, // -1 (back, toward the operator) .. 1 (forward), same sign as the mast tilt angle
    horn: false,
    parkingBrake: false,
    seatbelt: false,
    // Set by a source whose direction is a physical lever (a shifter or the
    // dashboard). An explicit lever beats the keyboard's automatic direction.
    explicitDirection: false,
    // A physical steering wheel's real rotation (radians, + anticlockwise as
    // the operator sees it), so the cab's wheel can show it. null when no
    // wheel is steering.
    steeringWheelAngle: null,
  }
}

const ANALOG_KEYS = ['throttle', 'brake', 'inching', 'steer', 'lift', 'tilt']
const BOOLEAN_KEYS = ['horn', 'parkingBrake', 'seatbelt']

// Combine every source's reading into one. For analog values the largest
// magnitude wins (a keyboard tap does not cancel a half-pressed pedal, and
// vice versa). Booleans are OR-ed. Direction comes from the first explicit
// lever if there is one, otherwise from the first source that is not in N, so
// list a shifter before the dashboard. The steering wheel's angle comes from
// the first source that has one.
export function mergeControls(readings) {
  const merged = neutralControls()
  let leverDirection = null
  let autoDirection = null

  for (const reading of readings) {
    if (!reading) continue
    for (const key of ANALOG_KEYS) {
      const value = reading[key]
      if (typeof value === 'number' && Math.abs(value) > Math.abs(merged[key])) merged[key] = value
    }
    for (const key of BOOLEAN_KEYS) {
      if (reading[key]) merged[key] = true
    }
    if (merged.steeringWheelAngle === null && typeof reading.steeringWheelAngle === 'number') {
      merged.steeringWheelAngle = reading.steeringWheelAngle
    }
    if (DIRECTIONS.includes(reading.direction)) {
      if (reading.explicitDirection) {
        if (leverDirection == null) leverDirection = reading.direction
      } else if (autoDirection == null && reading.direction !== 'N') {
        autoDirection = reading.direction
      }
    }
  }

  merged.direction = leverDirection ?? autoDirection ?? 'N'
  merged.explicitDirection = leverDirection != null
  return merged
}

// The keysUsed adapter. Free-practice courses grade `keysUsed` (the old
// keyboard letters) in their completionCode, so every source has to keep
// producing them: analog input past a small threshold counts as the key that
// would have done the same thing.
export const LEGACY_KEY_THRESHOLD = 0.2

export function legacyKeysFromControls(controls) {
  const keys = []
  const past = (value) => value > LEGACY_KEY_THRESHOLD
  if (past(controls.throttle) && controls.direction === 'F') keys.push('w')
  if (past(controls.steer)) keys.push('a')
  if (past(controls.brake) || (past(controls.throttle) && controls.direction === 'R')) keys.push('s')
  if (past(-controls.steer)) keys.push('d')
  if (past(controls.lift)) keys.push('r')
  if (past(-controls.lift)) keys.push('f')
  if (past(-controls.tilt)) keys.push('t')
  if (past(controls.tilt)) keys.push('g')
  return keys
}

// Rising-edge tracker over the legacy letters: reports a letter once when it
// becomes active, again only after it has been released. `extra` is letters a
// source reports directly (the keyboard's own presses, including a tap too
// short to land in any sim step).
export function createKeyActiveTracker() {
  let active = new Set()
  return {
    update(controls, extra = []) {
      const now = new Set([...legacyKeysFromControls(controls), ...extra])
      const fresh = [...now].filter((key) => !active.has(key))
      active = now
      return fresh
    },
  }
}
