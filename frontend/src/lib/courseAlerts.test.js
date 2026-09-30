import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SPEED_LIMIT_KMH } from '../data/safetyThresholds.js'
import { ALERT_RULES, alertProblems, resolveAlerts, resolveSpeedLimitKmh, withAlertSwitch } from './courseAlerts.js'

const essential = ALERT_RULES.filter((rule) => rule.essential).map((rule) => rule.id)
const optional = ALERT_RULES.filter((rule) => !rule.essential).map((rule) => rule.id)

test('the essential set is the collisions, overload and the start interlock', () => {
  assert.deepEqual(essential, ['obstacle-ahead', 'obstacle-behind', 'tail-swing', 'overload', 'start-interlock'])
})

test('every rule is on for a course that stores nothing', () => {
  for (const course of [undefined, null, {}, { alerts: {} }]) {
    const alerts = resolveAlerts(course)
    assert.deepEqual(Object.keys(alerts), ALERT_RULES.map((rule) => rule.id))
    assert.ok(Object.values(alerts).every(Boolean))
  }
})

test('a stored false switches a non-essential rule off', () => {
  const alerts = resolveAlerts({ alerts: { overspeed: false, 'look-direction': false } })
  assert.equal(alerts.overspeed, false)
  assert.equal(alerts['look-direction'], false)
  assert.equal(alerts['turn-speed'], true)
})

test('a stored false on an essential rule is ignored', () => {
  const alerts = resolveAlerts({ alerts: Object.fromEntries(essential.map((id) => [id, false])) })
  for (const id of essential) assert.equal(alerts[id], true, id)
})

test('only an explicit false switches a rule off', () => {
  const alerts = resolveAlerts({ alerts: { overspeed: null, 'turn-speed': 0, 'seatbelt-off': 'off' } })
  assert.ok(alerts.overspeed && alerts['turn-speed'] && alerts['seatbelt-off'])
})

test('withAlertSwitch stores only the rules switched off', () => {
  const off = withAlertSwitch(undefined, 'overspeed', false)
  assert.deepEqual(off, { overspeed: false })
  assert.deepEqual(withAlertSwitch(off, 'turn-speed', false), { overspeed: false, 'turn-speed': false })
  // Switching the last one back on leaves nothing to store.
  assert.equal(withAlertSwitch(off, 'overspeed', true), undefined)
})

test('withAlertSwitch never stores an essential rule, and drops a stray one', () => {
  assert.equal(withAlertSwitch(undefined, 'overload', false), undefined)
  assert.deepEqual(withAlertSwitch({ overload: false, junk: false }, optional[0], false), { [optional[0]]: false })
})

test('the speed limit is the course\'s own, or the default', () => {
  assert.equal(resolveSpeedLimitKmh({}), DEFAULT_SPEED_LIMIT_KMH)
  assert.equal(resolveSpeedLimitKmh(null), DEFAULT_SPEED_LIMIT_KMH)
  assert.equal(resolveSpeedLimitKmh({ speedLimitKmh: 12 }), 12)
  for (const bad of [0, -5, '12', NaN, null]) assert.equal(resolveSpeedLimitKmh({ speedLimitKmh: bad }), DEFAULT_SPEED_LIMIT_KMH)
})

test('a speed limit that is not a positive number is a problem; blank is not', () => {
  assert.deepEqual(alertProblems({}), [])
  assert.deepEqual(alertProblems({ speedLimitKmh: null }), [])
  assert.deepEqual(alertProblems({ speedLimitKmh: 10 }), [])
  assert.equal(alertProblems({ speedLimitKmh: 0 }).length, 1)
  assert.equal(alertProblems({ speedLimitKmh: -3 }).length, 1)
})
