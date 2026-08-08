import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getProgressSummary,
  getStoredProgress,
  markPartViewed,
  resetStoredProgress,
  setChecklistProgress,
  setSimulationProgress,
  subscribeToProgress,
} from '../lib/progressService'

export function useProgress() {
  const [progress, setProgress] = useState(() => getStoredProgress())

  useEffect(() => {
    return subscribeToProgress(() => {
      setProgress(getStoredProgress())
    })
  }, [])

  const summary = useMemo(() => getProgressSummary(progress), [progress])

  const updateChecklist = useCallback((moduleSlug, completedItems) => {
    setProgress(setChecklistProgress(moduleSlug, completedItems))
  }, [])

  const viewPart = useCallback((partId) => {
    setProgress(markPartViewed(partId))
  }, [])

  const updateSimulation = useCallback((moduleSlug, simulationProgress) => {
    setProgress(setSimulationProgress(moduleSlug, simulationProgress))
  }, [])

  const resetProgress = useCallback(() => {
    resetStoredProgress()
    setProgress(getStoredProgress())
  }, [])

  return {
    progress,
    summary,
    updateChecklist,
    viewPart,
    updateSimulation,
    resetProgress,
  }
}
