import { stabilityMargins } from '../physics/stability.js'
import { TIP_ONSET_SECONDS } from './constants.js'
import { triggerFail } from './stepFail.js'
import { toMetres } from './units.js'

// The truck's stability this step (lib/physics/stability.js), and the
// tip-over when it runs out. A tip-over is physics, so it fails the attempt
// whatever the course switched on: the truck goes over forward when the load
// (its weight, how far out and how high it is, and the braking) beats the
// truck's own moment about the front axle, and sideways when a turn throws
// the combined centre of gravity past a side of the stability triangle.
//
// The load is the pallet the forks alone are holding, read from its physics
// body: its centre of gravity is where it actually is, so a load out at the
// fork tips, tilted forward or raised high counts for what it is.
//
// Must run after stepPallet (which says what is carried).
export function stepStability(state, world, dt) {
  const { truck, pallets, frame, stability, tip } = state
  // A truck already going over is past judging. One that failed for another
  // reason is not: it can still tip as it brakes to a stop.
  if (tip.active) return

  const { geometry, failConditions } = world
  const { forwardX, forwardZ, prevSpeed, lateralAccel } = frame
  const carried = pallets[state.carriedIndex]
  const holding = carried && !carried.landed

  let load = null
  if (holding) {
    const dx = carried.com.x - truck.x
    const dz = carried.com.z - truck.z
    load = {
      massKg: carried.massKg,
      forward: toMetres(dx * forwardX + dz * forwardZ - geometry.frontAxleZ),
      height: toMetres(carried.com.y),
      // Left is +X at heading 0.
      lateral: toMetres(dx * forwardZ - dz * forwardX),
    }
  }

  // Slowing down throws the load forward whichever way the truck faces:
  // braking going forward, or pulling away in reverse.
  const decel = (prevSpeed - truck.speed) / dt
  const margins = stabilityMargins(world.stability, load, { decel: toMetres(decel), lateralAccel: toMetres(lateralAccel) })

  stability.longitudinalMargin = margins.longitudinalMargin
  stability.lateralMargin = margins.lateralMargin
  stability.tipping = margins.tipping
  stability.unstableFor = margins.tipping ? stability.unstableFor + dt : 0

  if (stability.unstableFor >= TIP_ONSET_SECONDS) {
    tip.active = true
    tip.axis = margins.tipping
    // Lifting more than the chart allows is the overload the course teaches;
    // anything else that puts the truck over is a tip-over.
    triggerFail(state, holding && state.load?.overCapacity && failConditions.overload ? 'overload' : 'tip-over')
  }
}
