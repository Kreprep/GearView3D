// Grades a `goalType: 'free'` driving step. Free courses have no checkpoints,
// pallet or bay to complete against, so completion is entirely up to the
// course's own `completionCode` - an admin-authored rule, required by
// validateCourse() for every free-goal course, evaluated in a sandboxed
// Worker (see freeCompletionWorker.js for why it runs off-thread instead of
// via a plain `new Function()` call on the page).
const WORKER_TIMEOUT_MS = 300

function runInWorker(code, context) {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./freeCompletionWorker.js', import.meta.url), { type: 'module' })
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      resolve(result)
    }

    const timer = setTimeout(() => {
      console.error('Custom completion code timed out')
      finish(false)
    }, WORKER_TIMEOUT_MS)

    worker.onmessage = (event) => {
      const { ok, result, error } = event.data || {}
      if (!ok) console.error('Custom completion code failed:', error)
      finish(ok ? result : false)
    }
    worker.onerror = (event) => {
      console.error('Custom completion code failed:', event.message)
      finish(false)
    }

    worker.postMessage({ code, context })
  })
}

// `course` is the flattened, learner-facing course object (goalType plus its
// `data` fields spread onto it - see backend/src/lib/courses.js publishedCourse).
// A published free-goal course always has `completionCode` (validateCourse
// requires it); a course without one (mid-edit, unpublished) never completes.
export function evaluateFreeCompletion(course, context) {
  const code = course?.completionCode
  if (!code) {
    console.error(`Free-goal course "${course?.id}" has no completionCode`)
    return Promise.resolve(false)
  }
  return runInWorker(code, context)
}
