// Which safety rules a driving course has switched on (docs/revisions/
// post-defense-plan.md, section 4.5). The rules themselves, what each one
// watches for, are lib/driving/safetyRules.js; this is the list an admin
// switches them from, and the reader for what a course stores.
//
// A course stores only what it changed: `alerts` holds `{ ruleId: false }`
// for the rules it switched off, and `speedLimitKmh` its own speed limit.
// Essential rules (collisions, overload, tip risk, a shifting load, the start
// interlock) are always on:
// resolveAlerts() ignores a stored `false` on one, so a hand-edited row
// cannot silence them.
//
// Pure and backend-safe, like lib/courseGoals.js: no three.js, no browser
// APIs, no i18n catalog. The labels are the Course Editor's, which is English
// admin chrome; what a learner reads on a sign is translated (i18n safety.*).

import { DEFAULT_SPEED_LIMIT_KMH } from '../data/safetyThresholds.js'

// In the order the Course Editor lists them. sound-horn is a stretch goal
// that needs a course object of its own.
export const ALERT_RULES = [
  { id: 'obstacle-ahead', essential: true, label: 'Obstacle ahead' },
  { id: 'obstacle-behind', essential: true, label: 'Obstacle behind' },
  { id: 'tail-swing', essential: true, label: 'Tail swing near an obstacle' },
  { id: 'overload', essential: true, label: 'Load over the capacity for its load centre' },
  { id: 'tip-risk', essential: true, label: 'Close to tipping over' },
  { id: 'load-shifting', essential: true, label: 'Load sliding on the forks' },
  { id: 'start-interlock', essential: true, label: 'Start without seatbelt, parking brake or neutral' },
  { id: 'look-direction', essential: false, label: 'Reversing without looking behind (first-person)' },
  { id: 'overspeed', essential: false, label: 'Over the speed limit' },
  { id: 'turn-speed', essential: false, label: 'Turning too fast' },
  { id: 'direction-change-moving', essential: false, label: 'Changing direction while moving' },
  { id: 'forks-high-travel', essential: false, label: 'Travelling with the forks raised' },
  { id: 'mast-not-back', essential: false, label: 'Carrying a load with the mast not tilted back' },
  { id: 'tilt-forward-elevated', essential: false, label: 'Tilting a raised load forward' },
  { id: 'lifting-while-moving', essential: false, label: 'Lifting or lowering while travelling' },
  { id: 'forks-not-inserted', essential: false, label: 'Lifting with the forks partly inserted' },
  { id: 'parking-brake-on', essential: false, label: 'Driving against the parking brake' },
  { id: 'seatbelt-off', essential: false, label: 'Seatbelt unfastened with the engine running' },
  { id: 'forks-raised-parked', essential: false, label: 'Forks left raised when parked' },
  { id: 'release-load', essential: false, label: 'Hint: tilt the mast forward to set a load down (not counted)' },
]

export const ALERT_RULE_IDS = ALERT_RULES.map((rule) => rule.id)

// Every rule's switch for a course: { [ruleId]: boolean }. On unless the
// course stored `false` for a rule that may be switched off.
export function resolveAlerts(course) {
  const stored = course?.alerts || {}
  return Object.fromEntries(ALERT_RULES.map((rule) => [rule.id, rule.essential || stored[rule.id] !== false]))
}

// What the Course Editor writes back when an admin moves one switch: the
// `alerts` value with only the switched-off, non-essential rules in it, or
// undefined once none is left (the key then drops out of the stored row).
export function withAlertSwitch(alerts, ruleId, on) {
  const next = {}
  for (const rule of ALERT_RULES) {
    if (rule.essential) continue
    const enabled = rule.id === ruleId ? on : alerts?.[rule.id] !== false
    if (!enabled) next[rule.id] = false
  }
  return Object.keys(next).length ? next : undefined
}

// The keys of a course's data this file reads. A stock course sets one only
// where it differs from the default (data/drivingCourse.js).
export const COURSE_ALERT_KEYS = ['speedLimitKmh', 'alerts']

// The stock values of those keys that a stored course has no value for at
// all, laid into its data: what prisma/seed.js backfills into a built-in row
// seeded before the key existed, so a stock speed limit reaches a database
// that is already in use. A key the row has always wins, including one an
// admin blanked (the Course Editor stores null for a blank speed limit).
// Returns `data` itself when nothing is missing.
export function withMissingAlertDefaults(data, defaults) {
  if (!data || !defaults) return data
  const missing = COURSE_ALERT_KEYS.filter((key) => defaults[key] !== undefined && !(key in data))
  if (!missing.length) return data
  return { ...data, ...Object.fromEntries(missing.map((key) => [key, defaults[key]])) }
}

const validSpeedLimit = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

// The course's speed limit in km/h: its own, or the default.
export function resolveSpeedLimitKmh(course) {
  return validSpeedLimit(course?.speedLimitKmh) ? course.speedLimitKmh : DEFAULT_SPEED_LIMIT_KMH
}

// Problems with what a course stores, for validateCourse().
export function alertProblems(course) {
  const limit = course?.speedLimitKmh
  if (limit != null && !validSpeedLimit(limit)) return ['The speed limit must be a number above zero, or blank for the default.']
  return []
}
