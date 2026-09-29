// Fixed-timestep driver (docs/revisions/post-defense-plan.md, section 3.3).
//
// The simulation always advances in SIM_DT steps, however fast the display
// refreshes, so a 144 Hz monitor and a 60 Hz one drive the same course the
// same way. Render time accumulates; each whole SIM_DT in the accumulator runs
// one step, and the leftover fraction is returned as `alpha` for the view to
// interpolate between the previous and current step's poses.
//
// A frame that arrives very late (a tab switch, a GC pause) runs at most
// MAX_STEPS steps and drops the rest, rather than spiralling into ever more
// catch-up work. Pure: the viewer calls advance() from useFrame, and tests
// call it with whatever frame deltas they like.

export const SIM_DT = 1 / 60
export const MAX_STEPS = 4

export function createSimLoop(onStep, { dt = SIM_DT, maxSteps = MAX_STEPS } = {}) {
  let accumulator = 0
  return {
    // Returns how many steps ran and the interpolation fraction (0..1).
    advance(frameDelta) {
      accumulator += Math.max(frameDelta, 0)
      let steps = 0
      while (accumulator >= dt && steps < maxSteps) {
        onStep(dt)
        accumulator -= dt
        steps += 1
      }
      if (accumulator >= dt) accumulator = 0
      return { steps, alpha: accumulator / dt }
    },
    reset() {
      accumulator = 0
    },
  }
}
