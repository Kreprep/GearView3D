import { useEffect, useMemo, useState } from 'react'
import { getModuleCourses } from '../lib/api'
import { mergeModuleSteps } from '../lib/moduleSteps'

const NO_COURSES = []

// Loads a module's published driving courses and merges them with the module's
// hardcoded bespoke steps. Pages should hold off rendering the simulation shell
// until `loading` is false: completion percentage is computed against the graded
// step list, so grading a partial list would persist a wrong percentage.
export function useModuleCourses(moduleSlug) {
  // One state object tagged with the slug it belongs to, so a slug change reads
  // as loading without a synchronous setState in the effect body.
  const [loaded, setLoaded] = useState({ slug: null, courses: NO_COURSES, error: null })

  useEffect(() => {
    let cancelled = false

    getModuleCourses(moduleSlug)
      .then((rows) => {
        if (!cancelled) setLoaded({ slug: moduleSlug, courses: rows, error: null })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ slug: moduleSlug, courses: NO_COURSES, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [moduleSlug])

  const fresh = loaded.slug === moduleSlug
  const courses = fresh ? loaded.courses : NO_COURSES

  const steps = useMemo(() => mergeModuleSteps(moduleSlug, courses), [moduleSlug, courses])
  const courseById = useMemo(
    () => Object.fromEntries(courses.map((entry) => [entry.id, entry.course])),
    [courses],
  )

  return { steps, courseById, loading: !fresh, error: fresh ? loaded.error : null }
}
