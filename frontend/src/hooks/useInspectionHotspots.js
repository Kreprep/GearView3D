import { useEffect, useState } from 'react'
import { getEquipmentHotspots, getWalkAroundHotspots } from '../lib/api'

const NO_HOTSPOTS = []
const IDLE = { hotspots: NO_HOTSPOTS, loading: false, error: null }

// The 3D markers a `walk-around` step shows. Forklift has its own
// WalkAroundHotspot rows, which carry the engine state each marker belongs to;
// every other equipment reuses the EquipmentHotspot rows already edited under
// Parts Identification, which have no state - so they show in every phase.
//
// Pages must hold off rendering the simulation shell until `loading` is false,
// the same rule useModuleCourses documents. `enabled` is false for a module
// with no walk-around step, which then never reports loading at all.
export function useInspectionHotspots(equipmentId, enabled = true) {
  const [loaded, setLoaded] = useState({ hotspots: NO_HOTSPOTS, loading: true, error: null })

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false
    const request = equipmentId === 'forklift' ? getWalkAroundHotspots() : getEquipmentHotspots(equipmentId)

    request
      .then((hotspots) => {
        if (!cancelled) setLoaded({ hotspots, loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ hotspots: NO_HOTSPOTS, loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [equipmentId, enabled])

  return enabled ? loaded : IDLE
}
