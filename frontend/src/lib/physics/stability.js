// The truck's stability, worked out analytically (docs/revisions/
// post-defense-plan.md, section 4.6). A counterbalance truck stands on a
// triangle: its two front wheels and the pivot of its rear axle. It tips
// forward when the load's moment about the front axle beats the truck's own,
// and sideways when the combined centre of gravity is thrown past a side of
// the triangle.
//
// Pure: kilograms, metres and metres per second squared in, margins out. The
// step that feeds it (lib/driving/stepStability.js) converts from scene units.
//
// The reference truck's unladen centre of gravity is not published, so its
// distance behind the front axle is derived from the rating, which is taken
// to mean: the rated load, at the rated load centre, carried in the travel
// position, is held with a reserve while the truck brakes at the rating
// deceleration.
//
//   restoring moment    M * d
//   overturning moment  W * (overhang + load centre) + (a / g) * (M * h + W * hl)
//   M * d = reserve * (overturning moment at the rating)
//
// with M the truck's mass, d its centre of gravity behind the front axle, h
// its height, W the load and hl the load's height. The figures are in
// data/vehicleProfile.js (STABILITY_DEFAULTS). The same rated load 15%
// heavier is past the reserve and tips; stability.test.js pins both.
//
// A course may rate its truck lower than the reference (course.capacityKg, its
// capacity plate). The truck is then that much lighter with the same
// proportions, so every margin depends on the load as a fraction of the
// rating.
import { STABILITY_DEFAULTS } from '../../data/vehicleProfile.js'

const GRAVITY = 9.81

// A truck with the given rated capacity, as the numbers stabilityMargins()
// reads.
export function stabilityModel(ratedCapacityKg = STABILITY_DEFAULTS.ratedCapacityKg, truck = STABILITY_DEFAULTS) {
  const massKg = truck.serviceWeightKg * (ratedCapacityKg / truck.ratedCapacityKg)
  const ratedMoment =
    ratedCapacityKg * (truck.frontOverhang + truck.ratedLoadCentre) +
    truck.ratingDecel * (massKg * truck.cgHeight + ratedCapacityKg * truck.travelLoadHeight)
  return {
    ratedCapacityKg,
    massKg,
    cgHeight: truck.cgHeight,
    cgBehindFrontAxle: (truck.ratingReserve * ratedMoment) / massKg,
    wheelbase: truck.wheelbase,
    halfTrack: truck.frontTrack / 2,
  }
}

/**
 * The stability margins of a truck (a stabilityModel()) carrying `load`, or
 * nothing when it is null:
 *   load.massKg
 *   load.forward   its centre of gravity ahead of the front axle, metres
 *   load.height    above the ground
 *   load.lateral   off the centreline, positive to the left
 * under `decel` (m/s^2 of braking: the inertia that throws the load forward)
 * and `lateralAccel` (m/s^2 toward the left, as in a left turn, which throws
 * the truck to the right).
 *
 * A margin is 1 with nothing acting and 0 at the point of tipping.
 * `tipping` is null, 'forward', 'left' or 'right', and `tipAcceleration` how
 * fast the truck is starting to rotate that way (rad/s^2): the moment left
 * over once the truck's own weight is beaten, over the inertia of truck and
 * load about the edge they turn on. `centreOfGravityHeight` is the combined
 * centre of gravity's height, in metres.
 */
export function stabilityMargins(model, load, { decel = 0, lateralAccel = 0 } = {}) {
  const loadKg = load?.massKg ?? 0
  const loadForward = load?.forward ?? 0
  const loadHeight = load?.height ?? 0
  const inertia = model.massKg * model.cgHeight + loadKg * loadHeight

  const restoring = model.massKg * model.cgBehindFrontAxle
  const overturning = loadKg * loadForward + (Math.max(decel, 0) / GRAVITY) * inertia
  const longitudinalMargin = 1 - overturning / restoring
  const aboutFrontAxle =
    model.massKg * (model.cgBehindFrontAxle ** 2 + model.cgHeight ** 2) + loadKg * (loadForward ** 2 + loadHeight ** 2)

  // The combined centre of gravity: how far ahead of the front axle, how
  // high, and how far off the centreline.
  const totalKg = model.massKg + loadKg
  const ahead = (loadKg * loadForward - model.massKg * model.cgBehindFrontAxle) / totalKg
  const height = inertia / totalKg
  const offset = (loadKg * (load?.lateral ?? 0)) / totalKg
  // The triangle is as wide as the front track at the front axle and narrows
  // to a point at the rear axle's pivot.
  const halfWidth = model.halfTrack * Math.min(Math.max((ahead + model.wheelbase) / model.wheelbase, 0), 1)
  const edgeSlope = Math.cos(Math.atan(model.halfTrack / model.wheelbase))
  // A left turn throws the truck to the right, so the right-hand edge is the
  // one to clear, and a centre of gravity off to the left is further from it.
  const towardRight = lateralAccel > 0
  const reach = (halfWidth + (towardRight ? offset : -offset)) * edgeSlope
  const demand = (Math.abs(lateralAccel) / GRAVITY) * height
  const lateralMargin = reach > 0 ? 1 - demand / reach : -Infinity

  let tipping = null
  let tipAcceleration = 0
  if (longitudinalMargin < 0 && longitudinalMargin <= lateralMargin) {
    tipping = 'forward'
    tipAcceleration = (GRAVITY * (overturning - restoring)) / aboutFrontAxle
  } else if (lateralMargin < 0) {
    tipping = towardRight ? 'right' : 'left'
    const arm = Math.max(reach, 0)
    tipAcceleration = (GRAVITY * (demand - arm)) / (height ** 2 + arm ** 2)
  }

  return { longitudinalMargin, lateralMargin, tipping, tipAcceleration, centreOfGravityHeight: height }
}

// The least roll rate (rad/s) that carries a body standing on the floor over
// onto its side: enough to lift a centre of gravity `height` up, and
// `edgeDistance` in from the edge it rolls on, to directly above that edge.
// Metres in.
//
// The stability triangle says when a truck starts to go over. What it then
// has to get past is its own outer wheels: a rear axle only swings so far
// before the truck is standing on the wheels of one side. So the edge that
// matters for whether it ends on its side is the body's, not the triangle's.
export function rollRateOver(edgeDistance, height) {
  const radius = Math.hypot(edgeDistance, height)
  return Math.sqrt(2 * GRAVITY * (radius - height)) / radius
}
