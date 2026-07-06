import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getProgressSummary,
  getStoredProgress,
  markPartViewed,
  recordPartsPracticeAttempt,
  recordQuizAttempt,
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

  const saveQuizAttempt = useCallback((moduleSlug, attempt) => {
    setProgress(recordQuizAttempt(moduleSlug, attempt))
  }, [])

  const savePartsPracticeAttempt = useCallback((attempt) => {
    setProgress(recordPartsPracticeAttempt(attempt))
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
    saveQuizAttempt,
    savePartsPracticeAttempt,
    updateSimulation,
    resetProgress,
  }
}
