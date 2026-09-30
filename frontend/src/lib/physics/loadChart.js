// The truck's load chart (docs/revisions/post-defense-plan.md, section 4.6;
// TESDA CON834218 element 3, "loads are calculated based on load center").
//
// A truck is rated for a load whose centre of gravity sits at the rated load
// centre, measured from the fork face along the tines. A load carried further
// out has a longer lever over the front axle, so less of it may be lifted:
//
//   derated capacity = rated capacity x (rated load centre / actual load centre)
//
// A load closer in than the rated centre is not up-rated: the plate's figure
// is the most the truck lifts.
//
// Pure and backend-safe: numbers in, numbers out, in kilograms and metres.
import { STABILITY_DEFAULTS } from '../../data/vehicleProfile.js'

export const RATED_LOAD_CENTRE = STABILITY_DEFAULTS.ratedLoadCentre

export function deratedCapacityKg(ratedKg, loadCentre, ratedLoadCentre = RATED_LOAD_CENTRE) {
  if (!(loadCentre > ratedLoadCentre)) return ratedKg
  return (ratedKg * ratedLoadCentre) / loadCentre
}

// Whether a load of `loadKg` at `loadCentre` is more than the truck may lift.
export function isOverCapacity(loadKg, ratedKg, loadCentre, ratedLoadCentre = RATED_LOAD_CENTRE) {
  return loadKg > deratedCapacityKg(ratedKg, loadCentre, ratedLoadCentre)
}

// The chart as points for the dashboard's capacity plate: the capacity at
// each of `steps` + 1 load centres from `from` to `to` metres.
export function loadChartPoints(ratedKg, { from = 0.4, to = 1.4, steps = 20, ratedLoadCentre = RATED_LOAD_CENTRE } = {}) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const loadCentre = from + ((to - from) * index) / steps
    return { loadCentre, capacityKg: deratedCapacityKg(ratedKg, loadCentre, ratedLoadCentre) }
  })
}
