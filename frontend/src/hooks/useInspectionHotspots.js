import { useEffect, useState } from 'react'
import { getHotspots } from '../lib/api'

const NO_HOTSPOTS = []
const IDLE = { hotspots: NO_HOTSPOTS, loading: false, error: null }

// The 3D markers a `walk-around` step shows: the hotspots on the walk-around
// surface. A marker carries the engine `state` it belongs to, or an empty one
// - which means it shows in every phase.
//
// Pages must hold off rendering the simulation shell until `loading` is false,
// the same rule useModuleCourses documents. `enabled` is false for a module
// with no walk-around step, which then never reports loading at all.
export function useInspectionHotspots(enabled = true) {
  const [loaded, setLoaded] = useState({ hotspots: NO_HOTSPOTS, loading: true, error: null })

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    getHotspots('walk-around')
      .then((hotspots) => {
        if (!cancelled) setLoaded({ hotspots, loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ hotspots: NO_HOTSPOTS, loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return enabled ? loaded : IDLE
}
