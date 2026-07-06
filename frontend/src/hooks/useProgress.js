import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getProgressSummary,
  getStoredProgress,
  markPartViewed,
  recordPartsPracticeAttempt,
  recordQuizAttempt,
  resetStoredProgress,
  setChecklistProgress,
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
    resetProgress,
  }
}
