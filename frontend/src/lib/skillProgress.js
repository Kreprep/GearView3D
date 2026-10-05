// The Skills Checklist's judge (docs/revisions/post-defense-plan.md, 4.8):
// given a skill's evidence rules, a learner's progress document and their
// sign-off events, where does the skill stand?
//
//   not-started   no evidence item met yet
//   in-progress   some evidence items met, not all
//   demonstrated  every evidence item met (a skill needs at least one)
//   signed-off    the latest sign-off event for (learner, skill) is a sign-off,
//                 whatever the evidence says; a revoke puts it back on the
//                 evidence
//
// The one implementation: the learner's /training/skills page and the
// backend's instructor view (backend/src/routes) both call evaluateSkills(),
// so the two can never disagree. That is also why this file is pure and
// backend-safe like courseGoals.js: no React, no browser APIs, no Prisma, no
// i18n browser side.
//
// Evidence is read from the progress document, which the learner's browser
// writes (PUT /api/progress stores it as sent, apart from re-grading the
// walk-around steps). It is client-reported: good enough to show a learner
// where they stand and an instructor what to look at, not proof. The sign-off
// events are the trust anchor; they come from their own table, which only
// skills.signoff writes.

import { ALERT_RULE_IDS } from './courseAlerts.js'
import { migrateParts } from './migrateParts.js'
import { missionRecordFor, violationTotal } from './simulationProgress.js'

export const SKILL_CATEGORIES = ['knowledge', 'perceptual', 'motor', 'safety', 'procedural']
export const SKILL_RELATIONS = ['teaches', 'requires']
export const SKILL_STATUSES = ['not-started', 'in-progress', 'demonstrated', 'signed-off']
export const SIGNOFF_ACTIONS = ['signoff', 'revoke']

// The kinds of evidence rule, and the fields each one takes:
//
//   step-complete      { module, stepId }  the step is complete
//   clean-run          { module, stepId, rules, severity }  the latest
//                      completion of a driving step logged no sign for `rules`
//                      (every rule when empty); severity 'any' counts every
//                      sign, 'danger' only those at danger level
//   quiz-score         { module, min } or { context: 'parts', min }  the
//                      latest attempt scored at least `min` percent
//   parts-viewed       {}  every published parts marker viewed
//   caution-recovered  {}  some driving step was completed on a run that
//                      raised a sign without any reaching danger: warned,
//                      corrected, finished (decided 2026-10-01)
//   mission-pass       { module, stepId }  a mission step (the Final Driving
//                      Test) has been passed, on any run so far: a later
//                      failing retry does not undo it (decided 2026-10-05)
export const EVIDENCE_TYPES = ['step-complete', 'clean-run', 'quiz-score', 'parts-viewed', 'caution-recovered', 'mission-pass']
export const CLEAN_RUN_SEVERITIES = ['any', 'danger']

const isText = (value) => typeof value === 'string' && value.trim() !== ''

// --- Validation -------------------------------------------------------------

// One rule, cleaned to the fields its type takes, or a problem string.
function normalizeRule(rule, index) {
  const where = `Evidence ${index + 1}`
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return { problem: `${where} is not a rule` }
  if (!EVIDENCE_TYPES.includes(rule.type)) return { problem: `${where} has an unknown type` }

  switch (rule.type) {
    case 'step-complete':
    case 'mission-pass':
      if (!isText(rule.module) || !isText(rule.stepId)) return { problem: `${where} needs a module and a step` }
      return { rule: { type: rule.type, module: rule.module.trim(), stepId: rule.stepId.trim() } }

    case 'clean-run': {
      if (!isText(rule.module) || !isText(rule.stepId)) return { problem: `${where} needs a module and a step` }
      const rules = Array.isArray(rule.rules) ? rule.rules : []
      const unknown = rules.filter((id) => !ALERT_RULE_IDS.includes(id))
      if (unknown.length) return { problem: `${where} names unknown safety rules: ${unknown.join(', ')}` }
      const severity = rule.severity ?? 'any'
      if (!CLEAN_RUN_SEVERITIES.includes(severity)) return { problem: `${where} has an unknown severity` }
      return {
        rule: { type: rule.type, module: rule.module.trim(), stepId: rule.stepId.trim(), rules: [...new Set(rules)], severity },
      }
    }

    case 'quiz-score': {
      const min = Number(rule.min)
      if (!Number.isFinite(min) || min < 0 || min > 100) return { problem: `${where} needs a pass mark from 0 to 100` }
      if (rule.context === 'parts') return { rule: { type: rule.type, context: 'parts', min } }
      if (!isText(rule.module)) return { problem: `${where} needs a module or the parts quiz` }
      return { rule: { type: rule.type, module: rule.module.trim(), min } }
    }

    default:
      return { rule: { type: rule.type } }
  }
}

// A skill's evidence list as stored: every rule reduced to the fields its
// type takes. `problems` is empty when the list can be saved as is.
export function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return { evidence: [], problems: ['Evidence must be a list'] }

  const result = { evidence: [], problems: [] }
  evidence.forEach((entry, index) => {
    const { rule, problem } = normalizeRule(entry, index)
    if (problem) result.problems.push(problem)
    else result.evidence.push(rule)
  })
  return result
}

// --- Reading the progress document -----------------------------------------

function simulationOf(progress, moduleSlug) {
  const simulation = progress?.simulations?.[moduleSlug]
  return simulation && typeof simulation === 'object' ? simulation : {}
}

function isComplete(progress, moduleSlug, stepId) {
  return simulationOf(progress, moduleSlug).stepsComplete?.[stepId] === true
}

// The latest completion's record of a driving step, or null when it has none
// (a failed attempt alone writes an entry without `completedAt`).
function completedRun(progress, moduleSlug, stepId) {
  const stats = simulationOf(progress, moduleSlug).attemptStats?.[stepId]
  return stats?.completedAt ? stats : null
}

function countFor(counts, ruleIds) {
  if (!counts || typeof counts !== 'object') return 0
  const ids = ruleIds.length ? ruleIds : Object.keys(counts)
  return ids.reduce((sum, id) => sum + (Number(counts[id]) || 0), 0)
}

function latestQuizPercentage(progress, rule) {
  const attempts =
    rule.context === 'parts' ? migrateParts(progress?.parts).quizAttempts : progress?.quizzes?.[rule.module]
  const latest = Array.isArray(attempts) ? attempts[0] : null
  return typeof latest?.percentage === 'number' ? latest.percentage : null
}

function everyCompletedRun(progress) {
  const simulations = progress?.simulations && typeof progress.simulations === 'object' ? progress.simulations : {}
  return Object.values(simulations).flatMap((simulation) =>
    Object.values(simulation?.attemptStats || {}).filter((stats) => stats?.completedAt),
  )
}

// Whether one rule is met. `context.hotspotIds` is the published parts
// markers, which the caller has fetched; without them parts-viewed cannot be
// judged and is not met.
export function isEvidenceMet(rule, progress, context = {}) {
  switch (rule?.type) {
    case 'step-complete':
      return isComplete(progress, rule.module, rule.stepId)

    case 'clean-run': {
      const run = isComplete(progress, rule.module, rule.stepId) && completedRun(progress, rule.module, rule.stepId)
      if (!run) return false
      const counts = rule.severity === 'danger' ? run.dangers : run.violations
      return countFor(counts, rule.rules || []) === 0
    }

    case 'quiz-score': {
      const percentage = latestQuizPercentage(progress, rule)
      return percentage !== null && percentage >= rule.min
    }

    case 'parts-viewed': {
      const hotspotIds = context.hotspotIds || []
      if (!hotspotIds.length) return false
      const viewed = new Set(migrateParts(progress?.parts).viewedPartIds)
      return hotspotIds.every((id) => viewed.has(id))
    }

    case 'caution-recovered':
      return everyCompletedRun(progress).some(
        (run) => violationTotal(run.violations) > 0 && countFor(run.dangers, []) === 0,
      )

    case 'mission-pass':
      return Boolean(missionRecordFor(simulationOf(progress, rule.module), rule.stepId)?.passedAt)

    default:
      return false
  }
}

// --- Sign-offs --------------------------------------------------------------

function eventTime(event) {
  return new Date(event.createdAt).getTime()
}

// The latest event per skill, from one learner's events in any order. Ties on
// the timestamp go to the later id, which is how the table orders them too.
export function latestSignoffEvents(events = []) {
  const latest = {}
  for (const event of events) {
    const current = latest[event.skillId]
    if (
      !current ||
      eventTime(event) > eventTime(current) ||
      (eventTime(event) === eventTime(current) && String(event.id) > String(current.id))
    ) {
      latest[event.skillId] = event
    }
  }
  return latest
}

// --- Status -----------------------------------------------------------------

export function evidenceStatus(evidence) {
  const met = evidence.filter((item) => item.met).length
  if (evidence.length && met === evidence.length) return 'demonstrated'
  return met ? 'in-progress' : 'not-started'
}

// One skill for one learner. `latestEvent` is the latest sign-off event for
// the pair, or null. Returns
//   { skillId, status, evidenceStatus, evidence: [{ rule, met }], met, total, signoff }
// where `signoff` is the latest event while it is a sign-off, else null.
export function evaluateSkill(skill, progress, { hotspotIds = [], latestEvent = null } = {}) {
  const rules = Array.isArray(skill?.evidence) ? skill.evidence : []
  const evidence = rules.map((rule) => ({ rule, met: isEvidenceMet(rule, progress, { hotspotIds }) }))
  const fromEvidence = evidenceStatus(evidence)
  const signoff = latestEvent?.action === 'signoff' ? latestEvent : null

  return {
    skillId: skill.id,
    status: signoff ? 'signed-off' : fromEvidence,
    evidenceStatus: fromEvidence,
    evidence,
    met: evidence.filter((item) => item.met).length,
    total: evidence.length,
    signoff,
  }
}

// Every skill for one learner, in the order given. `events` is that
// learner's sign-off events, in any order.
export function evaluateSkills(skills, progress, { hotspotIds = [], events = [] } = {}) {
  const latest = latestSignoffEvents(events)
  return skills.map((skill) => evaluateSkill(skill, progress, { hotspotIds, latestEvent: latest[skill.id] || null }))
}

// The share of skills demonstrated or signed off, 0-100: the hub's bar.
export function skillsPercentage(results) {
  if (!results.length) return 0
  const done = results.filter((result) => result.status === 'demonstrated' || result.status === 'signed-off').length
  return Math.round((done / results.length) * 100)
}
