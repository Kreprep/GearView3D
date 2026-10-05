// The Final Driving Test's scorecard (docs/modules/module-improvements-plan.md,
// section 3.6, decision D-3): given what the safety signs logged on a finished
// mission run and the course's pass rules, did the run pass, and what does it
// score?
//
//   pass   the mission was finished with no danger-level sign, no more than
//          `maxCautions` caution-level ones, and no sign at all for a rule in
//          `cleanRules`
//   score  100, less `cautionPenalty` per caution (`cleanRulePenalty` for a
//          rule that had to be clean) and `dangerPenalty` per danger, never
//          below 0. Shown beside the result; the pass is the rules', not a mark.
//
// A run's tally is lib/simulationProgress.js's `{ violations, dangers }`: a
// sign that came up is a violation, and one that was or rose to danger level
// is also a danger. So a rule's cautions are its violations less its dangers.
//
// Like the rest of the simulation evidence the run is reported by the
// learner's browser; the instructor's sign-off stays the trust anchor.
// Pure and backend-safe, like lib/courseGoals.js, which validates a course's
// pass rules through passRulesProblems(): no React, i18n catalog or browser
// APIs. The words are the caller's (i18n `mission.*`).

import { COUNTED_ALERT_RULE_IDS, resolveAlerts } from './courseAlerts.js'

// Decided 2026-10-05 (D-3). A course stores only the keys it changes.
export const DEFAULT_PASS_RULES = Object.freeze({
  maxCautions: 3,
  cleanRules: Object.freeze(['look-direction', 'forks-high-travel']),
  cautionPenalty: 5,
  cleanRulePenalty: 10,
  dangerPenalty: 20,
})

export const PASS_RULE_PENALTY_KEYS = ['cautionPenalty', 'cleanRulePenalty', 'dangerPenalty']

const isCount = (value) => Number.isInteger(value) && value >= 0
const isPenalty = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100

// A course's pass rules, every key resolved: its own where valid, else the
// default. Unknown and hint rules are dropped from `cleanRules`.
export function resolvePassRules(course) {
  const stored = course?.passRules || {}
  const rules = {
    maxCautions: isCount(stored.maxCautions) ? stored.maxCautions : DEFAULT_PASS_RULES.maxCautions,
    cleanRules: Array.isArray(stored.cleanRules)
      ? COUNTED_ALERT_RULE_IDS.filter((id) => stored.cleanRules.includes(id))
      : [...DEFAULT_PASS_RULES.cleanRules],
  }
  for (const key of PASS_RULE_PENALTY_KEYS) rules[key] = isPenalty(stored[key]) ? stored[key] : DEFAULT_PASS_RULES[key]
  return rules
}

// Problems with what a course stores, as sentences for the Course Editor and
// the publish check.
export function passRulesProblems(course) {
  const stored = course?.passRules
  if (stored == null) return []
  if (typeof stored !== 'object' || Array.isArray(stored)) return ['The pass rules are not readable.']

  const problems = []
  if (stored.maxCautions !== undefined && !isCount(stored.maxCautions)) {
    problems.push('The most cautions allowed must be a whole number, 0 or more.')
  }
  if (PASS_RULE_PENALTY_KEYS.some((key) => stored[key] !== undefined && !isPenalty(stored[key]))) {
    problems.push('Each penalty must be a number of points from 0 to 100.')
  }
  if (stored.cleanRules !== undefined) {
    if (!Array.isArray(stored.cleanRules)) {
      problems.push('The rules that must be clean are not a list.')
    } else {
      const unknown = stored.cleanRules.filter((id) => !COUNTED_ALERT_RULE_IDS.includes(id))
      if (unknown.length) problems.push(`The pass rules name signs that are not counted: ${unknown.join(', ')}.`)
      // A switched-off sign never comes up, so requiring it clean asks nothing.
      const alerts = resolveAlerts(course)
      const off = stored.cleanRules.filter((id) => COUNTED_ALERT_RULE_IDS.includes(id) && !alerts[id])
      if (off.length) problems.push(`A sign that must be clean is switched off for this course: ${off.join(', ')}.`)
    }
  }
  return problems
}

const count = (counts, id) => {
  const value = Number(counts?.[id])
  return Number.isFinite(value) && value > 0 ? value : 0
}

// One finished run, judged. `tally` is `{ violations, dangers }`; `rules` is
// resolvePassRules()'s. Returns
//   { passed, score, cautionCount, dangerCount,
//     rules: [{ id, cautions, dangers, mustBeClean, penalty }]  (rules that came up, in rule order)
//     reasons: [{ type: 'dangers', count } | { type: 'cautions', count, max } | { type: 'clean-rule', ruleId }] }
// where `reasons` is why it did not pass, empty when it did.
export function scoreMission(tally, rules = resolvePassRules()) {
  const rows = COUNTED_ALERT_RULE_IDS.map((id) => {
    const dangers = count(tally?.dangers, id)
    const cautions = Math.max(0, count(tally?.violations, id) - dangers)
    const mustBeClean = rules.cleanRules.includes(id)
    const penalty = cautions * (mustBeClean ? rules.cleanRulePenalty : rules.cautionPenalty) + dangers * rules.dangerPenalty
    return { id, cautions, dangers, mustBeClean, penalty }
  }).filter((row) => row.cautions || row.dangers)

  const cautionCount = rows.reduce((sum, row) => sum + row.cautions, 0)
  const dangerCount = rows.reduce((sum, row) => sum + row.dangers, 0)
  const reasons = []
  if (dangerCount) reasons.push({ type: 'dangers', count: dangerCount })
  if (cautionCount > rules.maxCautions) reasons.push({ type: 'cautions', count: cautionCount, max: rules.maxCautions })
  for (const row of rows) if (row.mustBeClean) reasons.push({ type: 'clean-rule', ruleId: row.id })

  const penalty = rows.reduce((sum, row) => sum + row.penalty, 0)
  return {
    passed: reasons.length === 0,
    score: Math.max(0, Math.round(100 - penalty)),
    cautionCount,
    dangerCount,
    rules: rows,
    reasons,
  }
}
