import '../test-helpers/browserGlobals.js'
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getEquipment, loginUser, setAuthToken } from './api.js'

// The shim's dispatchEvent is a no-op; count the session-expired events here.
let expiredEvents = 0
window.dispatchEvent = (event) => {
  if (event.type === 'gearview-session-expired') expiredEvents += 1
}

function respondWith(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

beforeEach(() => {
  expiredEvents = 0
  setAuthToken(null)
})

test('a 401 on the token in use ends the session once, however many requests were in flight', async () => {
  setAuthToken('dead-token')
  globalThis.fetch = async () => respondWith(401, { error: 'Session expired' })

  const results = await Promise.allSettled([getEquipment(), getEquipment(), getEquipment()])

  assert.ok(results.every((result) => result.status === 'rejected'))
  assert.equal(results[0].reason.message, 'Session expired')
  assert.equal(expiredEvents, 1)
})

test('a 401 with no token - the login form - does not end a session', async () => {
  globalThis.fetch = async () => respondWith(401, { error: 'Invalid email or password' })

  await assert.rejects(loginUser({ email: 'a@b.c', password: 'wrong' }), /Invalid email or password/)
  assert.equal(expiredEvents, 0)
})

test('a 401 that lands after the learner signed back in is about the old token', async () => {
  setAuthToken('old-token')
  let respond
  globalThis.fetch = () => new Promise((resolve) => { respond = resolve })

  const pending = getEquipment()
  setAuthToken('new-token')
  respond(respondWith(401, { error: 'Session expired' }))

  await assert.rejects(pending, /Session expired/)
  assert.equal(expiredEvents, 0)
})

test('a 403 is a permission answer, not a dead session', async () => {
  setAuthToken('live-token')
  globalThis.fetch = async () => respondWith(403, { error: 'Admin access required' })

  await assert.rejects(getEquipment(), /Admin access required/)
  assert.equal(expiredEvents, 0)
})
