import { useEffect, useState } from 'react'
import { getWalkAroundHotspots } from '../lib/api'

const NO_HOTSPOTS = []

// Loads Module 1's published 3D inspection hotspots. Pages must hold off
// rendering the simulation shell until `loading` is false, the same rule
// useModuleCourses documents: completion percentage would otherwise be
// computed against a still-loading list.
export function useWalkAroundHotspots() {
  const [loaded, setLoaded] = useState({ hotspots: NO_HOTSPOTS, loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    getWalkAroundHotspots()
      .then((hotspots) => {
        if (!cancelled) setLoaded({ hotspots, loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ hotspots: NO_HOTSPOTS, loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return loaded
}
