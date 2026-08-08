import { useEffect, useState } from 'react'
import { getTrainingModules } from '../lib/api'

// The module's DB row merged over its static definition in
// data/trainingModules.js.
//
// The row owns the fields the Modules admin tab edits (title, fullTitle,
// subtitle, description, imageUrl); everything else a page needs - the
// learning objectives, the syllabus card, the lesson text - has no column and
// still comes from the static definition. A blank column keeps the static
// value, so clearing a field in the dashboard does not blank the page.
export function useModuleRecord(moduleSlug, fallback) {
  const [row, setRow] = useState(null)

  useEffect(() => {
    let cancelled = false

    getTrainingModules()
      .then((modules) => {
        if (!cancelled) setRow(modules.find((module) => module.slug === moduleSlug) || null)
      })
      .catch(() => {
        if (!cancelled) setRow(null)
      })

    return () => {
      cancelled = true
    }
  }, [moduleSlug])

  if (!row) return fallback

  const merged = { ...fallback }
  for (const key of ['title', 'fullTitle', 'subtitle', 'description', 'imageUrl']) {
    if (row[key]) merged[key] = row[key]
  }
  return merged
}
