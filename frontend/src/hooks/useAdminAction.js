import { useState } from 'react'

// The save/publish/revert/reset skeleton every admin editor (HotspotAdmin,
// CourseEditor, ModuleListAdmin, QuizAdmin, ChecklistAdmin) repeats: track a
// busy flag around one API call, report the error or success message via
// onMessage, and return the result (or null on failure) so the caller can
// chain a follow-up action off it (publish = saveDraft then publish, for
// instance).
//
// `onResult`, if given, runs once per successful call with the action's
// result and whatever options object `run` was called with - each editor
// defines it once to fold the server's response back into its own local
// state (e.g. `{ resync: true }` on revert/reset telling it to also replace
// its edit draft, not just the list entry).
export function useAdminAction(onMessage, onResult) {
  const [busy, setBusy] = useState(false)

  const run = async (action, message, options) => {
    setBusy(true)
    try {
      const result = await action()
      onResult?.(result, options)
      if (message) onMessage(message)
      return result
    } catch (err) {
      onMessage(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  return { busy, run }
}
