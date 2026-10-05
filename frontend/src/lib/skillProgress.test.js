import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateSkill,
  evaluateSkills,
  evidenceStatus,
  isEvidenceMet,
  latestSignoffEvents,
  normalizeEvidence,
  skillsPercentage,
} from './skillProgress.js'
import { SKILL_DEFAULTS } from '../data/skillDefaults.js'

const MODULE = 'load-handling'

// A progress document with just the parts each test sets.
function progress({ simulations = {}, quizzes = {}, parts = {} } = {}) {
  return { version: 1, checklists: {}, parts: { viewedPartIds: [], quizAttempts: [], ...parts }, quizzes, simulations }
}

function completedRun({ violations = {}, dangers = {} } = {}) {
  return { completedAt: '2026-10-01T00:00:00.000Z', violations, dangers, fails: 0, bestViolations: 0, failsSinceCompletion: 0 }
}

function drivingProgress(stepId, run, complete = true) {
  return progress({
    simulations: { [MODULE]: { stepsComplete: { [stepId]: complete }, attemptStats: { [stepId]: run } } },
  })
}

describe('step-complete', () => {
  const rule = { type: 'step-complete', module: MODULE, stepId: 'driving-course' }

  test('met once the step is complete', () => {
    assert.equal(isEvidenceMet(rule, progress({ simulations: { [MODULE]: { stepsComplete: { 'driving-course': true } } } })), true)
  })

  test('not met while it is not, or in another module', () => {
    assert.equal(isEvidenceMet(rule, progress()), false)
    assert.equal(isEvidenceMet(rule, progress({ simulations: { [MODULE]: { stepsComplete: { 'driving-course': false } } } })), false)
    assert.equal(isEvidenceMet(rule, progress({ simulations: { other: { stepsComplete: { 'driving-course': true } } } })), false)
  })

  test('a missing or empty document is not an error', () => {
    assert.equal(isEvidenceMet(rule, null), false)
    assert.equal(isEvidenceMet(rule, {}), false)
  })
})

describe('clean-run', () => {
  const anyRule = { type: 'clean-run', module: MODULE, stepId: 'driving-course', rules: ['forks-not-inserted'], severity: 'any' }
  const dangerAll = { type: 'clean-run', module: MODULE, stepId: 'driving-course', rules: [], severity: 'danger' }

  test('met by a completed run with none of the named signs', () => {
    const run = completedRun({ violations: { overspeed: 2 } })
    assert.equal(isEvidenceMet(anyRule, drivingProgress('driving-course', run)), true)
  })

  test('not met when the latest completion raised a named sign', () => {
    const run = completedRun({ violations: { 'forks-not-inserted': 1 } })
    assert.equal(isEvidenceMet(anyRule, drivingProgress('driving-course', run)), false)
  })

  test('severity danger counts only danger-level signs, of every rule when none are named', () => {
    assert.equal(isEvidenceMet(dangerAll, drivingProgress('driving-course', completedRun({ violations: { overspeed: 3 } }))), true)
    const dangerous = completedRun({ violations: { 'obstacle-ahead': 1 }, dangers: { 'obstacle-ahead': 1 } })
    assert.equal(isEvidenceMet(dangerAll, drivingProgress('driving-course', dangerous)), false)
  })

  test('needs a completion: failed attempts alone, or a step not complete, are not a clean run', () => {
    const failedOnly = { failsSinceCompletion: 2 }
    assert.equal(isEvidenceMet(anyRule, drivingProgress('driving-course', failedOnly)), false)
    assert.equal(isEvidenceMet(anyRule, drivingProgress('driving-course', completedRun(), false)), false)
  })
})

describe('quiz-score', () => {
  const moduleRule = { type: 'quiz-score', module: MODULE, min: 80 }
  const partsRule = { type: 'quiz-score', context: 'parts', min: 80 }

  test('reads the latest module attempt, not the best', () => {
    const passed = progress({ quizzes: { [MODULE]: [{ percentage: 80 }, { percentage: 40 }] } })
    const slipped = progress({ quizzes: { [MODULE]: [{ percentage: 60 }, { percentage: 100 }] } })
    assert.equal(isEvidenceMet(moduleRule, passed), true)
    assert.equal(isEvidenceMet(moduleRule, slipped), false)
    assert.equal(isEvidenceMet(moduleRule, progress()), false)
  })

  test('reads the parts quiz, including an older stored shape', () => {
    assert.equal(isEvidenceMet(partsRule, progress({ parts: { quizAttempts: [{ percentage: 90 }] } })), true)
    const legacy = { version: 1, parts: { viewedPartIds: [], practiceAttempts: [{ percentage: 85 }] } }
    assert.equal(isEvidenceMet(partsRule, legacy), true)
    assert.equal(isEvidenceMet(partsRule, progress({ parts: { quizAttempts: [{ percentage: 79 }] } })), false)
  })
})

describe('parts-viewed', () => {
  const rule = { type: 'parts-viewed' }

  test('met when every published marker was viewed; extra ids do not matter', () => {
    const viewed = progress({ parts: { viewedPartIds: ['mast', 'forks', 'deleted-part'] } })
    assert.equal(isEvidenceMet(rule, viewed, { hotspotIds: ['mast', 'forks'] }), true)
    assert.equal(isEvidenceMet(rule, viewed, { hotspotIds: ['mast', 'forks', 'tires'] }), false)
  })

  test('not met when there are no markers to view', () => {
    assert.equal(isEvidenceMet(rule, progress({ parts: { viewedPartIds: ['mast'] } })), false)
  })
})

describe('caution-recovered', () => {
  const rule = { type: 'caution-recovered' }

  test('met by a completed run that raised a sign and never reached danger', () => {
    assert.equal(isEvidenceMet(rule, drivingProgress('turning-practice', completedRun({ violations: { 'turn-speed': 1 } }))), true)
  })

  test('not met by a clean run, a run that reached danger, or a failure', () => {
    assert.equal(isEvidenceMet(rule, drivingProgress('a', completedRun())), false)
    const dangerous = completedRun({ violations: { 'tail-swing': 1 }, dangers: { 'tail-swing': 1 } })
    assert.equal(isEvidenceMet(rule, drivingProgress('a', dangerous)), false)
    assert.equal(isEvidenceMet(rule, drivingProgress('a', { violations: { 'turn-speed': 1 }, failsSinceCompletion: 1 })), false)
  })
})

describe('mission-pass', () => {
  const rule = { type: 'mission-pass', module: MODULE, stepId: 'final-test' }
  const withMission = (mission) =>
    progress({ simulations: { [MODULE]: { attemptStats: { 'final-test': { failsSinceCompletion: 1, mission } } } } })

  test('met once the mission has been passed, whatever the latest run did', () => {
    assert.equal(isEvidenceMet(rule, withMission({ passedAt: 'T1', lastRun: { passed: false } })), true)
  })

  test('not met by finished runs that never passed, or with no runs at all', () => {
    assert.equal(isEvidenceMet(rule, withMission({ passedAt: null, lastRun: { passed: false } })), false)
    assert.equal(isEvidenceMet(rule, progress()), false)
    assert.equal(isEvidenceMet({ ...rule, stepId: 'other' }, withMission({ passedAt: 'T1' })), false)
  })
})

test('an unknown rule type is never met', () => {
  assert.equal(isEvidenceMet({ type: 'self-assessed' }, progress()), false)
})

describe('status', () => {
  const skill = {
    id: 'two-steps',
    evidence: [
      { type: 'step-complete', module: MODULE, stepId: 'a' },
      { type: 'step-complete', module: MODULE, stepId: 'b' },
    ],
  }
  const withSteps = (steps) => progress({ simulations: { [MODULE]: { stepsComplete: steps } } })

  test('not-started, in-progress and demonstrated follow the evidence met', () => {
    assert.equal(evaluateSkill(skill, withSteps({})).status, 'not-started')
    const halfway = evaluateSkill(skill, withSteps({ a: true }))
    assert.equal(halfway.status, 'in-progress')
    assert.deepEqual([halfway.met, halfway.total], [1, 2])
    assert.deepEqual(halfway.evidence.map((item) => item.met), [true, false])
    assert.equal(evaluateSkill(skill, withSteps({ a: true, b: true })).status, 'demonstrated')
  })

  test('a sign-off wins over the evidence, and keeps the evidence status beside it', () => {
    const signoff = { id: '1', skillId: skill.id, action: 'signoff', createdAt: '2026-10-01T01:00:00Z', actorName: 'J. Cruz' }
    const result = evaluateSkill(skill, withSteps({}), { latestEvent: signoff })
    assert.equal(result.status, 'signed-off')
    assert.equal(result.evidenceStatus, 'not-started')
    assert.equal(result.signoff.actorName, 'J. Cruz')
  })

  test('a revoke puts the skill back on its evidence', () => {
    const revoke = { id: '2', skillId: skill.id, action: 'revoke', createdAt: '2026-10-01T02:00:00Z' }
    const result = evaluateSkill(skill, withSteps({ a: true }), { latestEvent: revoke })
    assert.equal(result.status, 'in-progress')
    assert.equal(result.signoff, null)
  })

  test('a skill with no evidence rules is not-started until signed off', () => {
    assert.equal(evidenceStatus([]), 'not-started')
    assert.equal(evaluateSkill({ id: 'observed', evidence: [] }, progress()).status, 'not-started')
  })
})

describe('sign-off events', () => {
  const events = [
    { id: 'a', skillId: 's', action: 'signoff', createdAt: '2026-10-01T01:00:00Z' },
    { id: 'c', skillId: 's', action: 'revoke', createdAt: '2026-10-01T03:00:00Z' },
    { id: 'b', skillId: 's', action: 'signoff', createdAt: '2026-10-01T02:00:00Z' },
    { id: 'd', skillId: 't', action: 'signoff', createdAt: '2026-10-01T01:00:00Z' },
  ]

  test('the latest event per skill decides, in whatever order they arrive', () => {
    const latest = latestSignoffEvents(events)
    assert.equal(latest.s.id, 'c')
    assert.equal(latest.t.id, 'd')
  })

  test('a timestamp tie goes to the later id', () => {
    const tied = [
      { id: 'y', skillId: 's', action: 'signoff', createdAt: '2026-10-01T01:00:00Z' },
      { id: 'x', skillId: 's', action: 'revoke', createdAt: '2026-10-01T01:00:00Z' },
    ]
    assert.equal(latestSignoffEvents(tied).s.id, 'y')
  })

  test('evaluateSkills pairs each skill with its own latest event', () => {
    const skills = [{ id: 's', evidence: [] }, { id: 't', evidence: [] }, { id: 'u', evidence: [] }]
    const results = evaluateSkills(skills, progress(), { events })
    assert.deepEqual(results.map((result) => result.status), ['not-started', 'signed-off', 'not-started'])
    assert.equal(skillsPercentage(results), 33)
    assert.equal(skillsPercentage([]), 0)
  })
})

describe('normalizeEvidence', () => {
  test('keeps only the fields each type takes', () => {
    const { evidence, problems } = normalizeEvidence([
      { type: 'step-complete', module: ' m ', stepId: 's', extra: true },
      { type: 'clean-run', module: 'm', stepId: 's', rules: ['overspeed', 'overspeed'] },
      { type: 'quiz-score', context: 'parts', module: 'ignored', min: '80' },
      { type: 'parts-viewed', module: 'ignored' },
      { type: 'mission-pass', module: 'm', stepId: ' s ', rules: ['ignored'] },
    ])
    assert.deepEqual(problems, [])
    assert.deepEqual(evidence, [
      { type: 'step-complete', module: 'm', stepId: 's' },
      { type: 'clean-run', module: 'm', stepId: 's', rules: ['overspeed'], severity: 'any' },
      { type: 'quiz-score', context: 'parts', min: 80 },
      { type: 'parts-viewed' },
      { type: 'mission-pass', module: 'm', stepId: 's' },
    ])
  })

  test('names what is wrong', () => {
    const { problems } = normalizeEvidence([
      { type: 'nope' },
      { type: 'step-complete', module: 'm' },
      { type: 'clean-run', module: 'm', stepId: 's', rules: ['no-such-rule'] },
      { type: 'clean-run', module: 'm', stepId: 's', severity: 'caution' },
      { type: 'quiz-score', module: 'm', min: 120 },
      { type: 'quiz-score', min: 50 },
      { type: 'mission-pass', module: 'm' },
      'text',
    ])
    assert.equal(problems.length, 8)
    assert.deepEqual(normalizeEvidence('not a list').problems, ['Evidence must be a list'])
  })

  test('every stock skill\'s evidence is valid as written', () => {
    for (const skill of SKILL_DEFAULTS) {
      const { evidence, problems } = normalizeEvidence(skill.evidence)
      assert.deepEqual(problems, [], skill.id)
      assert.deepEqual(evidence, skill.evidence, skill.id)
    }
  })
})

test('every stock skill points at a built-in module and step', async () => {
  const { moduleScenarioSteps } = await import('../data/moduleScenarios.js')
  for (const skill of SKILL_DEFAULTS) {
    for (const link of skill.modules) assert.ok(moduleScenarioSteps[link.module], `${skill.id}: ${link.module}`)
    for (const rule of skill.evidence.filter((entry) => entry.stepId)) {
      const steps = moduleScenarioSteps[rule.module] || []
      assert.ok(steps.some((step) => step.id === rule.stepId), `${skill.id}: ${rule.module}/${rule.stepId}`)
    }
  }
})
