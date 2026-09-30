import { rollRateOver, stabilityMargins } from '../physics/stability.js'
import { TIP_ONSET_SECONDS, TIP_ROLL_MARGIN } from './constants.js'
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
// The fall is not this step's. At the onset it hands the truck to the physics
// engine (stepPhysics makes it a dynamic body on the next step), turning at
// the rate the overturning moment has built up while the truck was past the
// point of tipping.
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
  stability.tipRate = margins.tipping ? stability.tipRate + margins.tipAcceleration * dt : 0

  if (stability.unstableFor >= TIP_ONSET_SECONDS) {
    const sideways = margins.tipping !== 'forward'
    tip.active = true
    tip.axis = margins.tipping
    // Forward, the load's weight on the forks carries the truck over by
    // itself. Sideways, what throws it is the tyres' grip in the turn, which
    // a falling body no longer has, so it starts with at least the rate that
    // carries it over its outer wheels, with its load or without it.
    const edge = toMetres(world.halfWidth)
    const rateOver = Math.max(rollRateOver(edge, margins.centreOfGravityHeight), rollRateOver(edge, world.stability.cgHeight))
    tip.rate = sideways ? Math.max(stability.tipRate, rateOver * TIP_ROLL_MARGIN) : stability.tipRate
    tip.yawRate = frame.yawRate
    // Lifting more than the chart allows is the overload the course teaches;
    // anything else that puts the truck over is a tip-over.
    triggerFail(state, holding && state.load?.overCapacity && failConditions.overload ? 'overload' : 'tip-over')
  }
}
