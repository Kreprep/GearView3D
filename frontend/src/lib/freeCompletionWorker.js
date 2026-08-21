// Runs an admin-authored free-goal completion rule off the main thread. This
// Worker has no DOM and no localStorage, so it cannot reach the page or the
// learner's JWT (gearview_token) - only the plain context object it is sent.
// Never load this worker with anything other than the code/context message
// shape below; see customCompletion.js for the caller side of the contract.
self.onmessage = (event) => {
  const { code, context } = event.data || {}
  try {
    const rule = new Function('context', code)
    self.postMessage({ ok: true, result: Boolean(rule(context)) })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) })
  }
}
