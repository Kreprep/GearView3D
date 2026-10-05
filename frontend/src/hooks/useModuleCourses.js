import { useEffect, useMemo, useState } from 'react'
import { getModuleCourses } from '../lib/api'

const NO_STEPS = []

// Loads every published step of a module, in order. No module has a
// hardcoded step list: each row's `kind` tells the page how to render it
// (briefing / driving / walk-around / checklist / quiz / activity / summary)
// and `content` carries the payload.
//
// Pages must hold off rendering the simulation shell until `loading` is false:
// completion percentage is computed against the graded step list, so grading a
// partial list would persist a wrong percentage.
export function useModuleCourses(moduleSlug) {
  // One state object tagged with the slug it belongs to, so a slug change reads
  // as loading without a synchronous setState in the effect body.
  const [loaded, setLoaded] = useState({ slug: null, steps: NO_STEPS, error: null })

  useEffect(() => {
    let cancelled = false

    getModuleCourses(moduleSlug)
      .then((rows) => {
        if (!cancelled) setLoaded({ slug: moduleSlug, steps: rows, error: null })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ slug: moduleSlug, steps: NO_STEPS, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [moduleSlug])

  const fresh = loaded.slug === moduleSlug
  const steps = fresh ? loaded.steps : NO_STEPS

  const courseById = useMemo(
    () => Object.fromEntries(steps.filter((step) => step.course).map((step) => [step.id, step.course])),
    [steps],
  )
  const stepById = useMemo(() => Object.fromEntries(steps.map((step) => [step.id, step])), [steps])

  return { steps, stepById, courseById, loading: !fresh, error: fresh ? loaded.error : null }
}
