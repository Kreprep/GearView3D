import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PASS_RULES, passRulesProblems, resolvePassRules, scoreMission } from './missionScore.js'

const tally = (violations = {}, dangers = {}) => ({ violations, dangers })

describe('scoreMission with the stock rules (D-3)', () => {
  const rules = resolvePassRules()

  test('a clean run passes with 100', () => {
    const result = scoreMission(tally(), rules)
    assert.equal(result.passed, true)
    assert.equal(result.score, 100)
    assert.deepEqual(result.reasons, [])
    assert.deepEqual(result.rules, [])
  })

  test('three cautions still pass, 5 points each', () => {
    const result = scoreMission(tally({ overspeed: 2, 'turn-speed': 1 }), rules)
    assert.equal(result.passed, true)
    assert.equal(result.cautionCount, 3)
    assert.equal(result.score, 85)
  })

  test('a fourth caution fails, and says how many against how many allowed', () => {
    const result = scoreMission(tally({ overspeed: 4 }), rules)
    assert.equal(result.passed, false)
    assert.deepEqual(result.reasons, [{ type: 'cautions', count: 4, max: 3 }])
    assert.equal(result.score, 80)
  })

  test('a single danger fails, and costs 20', () => {
    const result = scoreMission(tally({ overload: 1 }, { overload: 1 }), rules)
    assert.equal(result.passed, false)
    assert.equal(result.dangerCount, 1)
    assert.equal(result.cautionCount, 0, 'a sign that came up at danger is not also a caution')
    assert.deepEqual(result.reasons, [{ type: 'dangers', count: 1 }])
    assert.equal(result.score, 80)
  })

  test('a caution that rose to danger counts once, as a danger', () => {
    // tallyAlert: the sign came up (a violation) and escalated (a danger).
    const result = scoreMission(tally({ 'obstacle-ahead': 1 }, { 'obstacle-ahead': 1 }), rules)
    assert.equal(result.cautionCount, 0)
    assert.equal(result.dangerCount, 1)
  })

  test('one caution on a rule that must be clean fails, and costs 10', () => {
    const result = scoreMission(tally({ 'look-direction': 1 }), rules)
    assert.equal(result.passed, false)
    assert.deepEqual(result.reasons, [{ type: 'clean-rule', ruleId: 'look-direction' }])
    assert.equal(result.score, 90)
    assert.deepEqual(result.rules, [{ id: 'look-direction', cautions: 1, dangers: 0, mustBeClean: true, penalty: 10 }])
  })

  test('the score never goes below 0; every reason is listed', () => {
    const result = scoreMission(tally({ overspeed: 30, 'forks-high-travel': 1 }, { 'tip-risk': 2 }), rules)
    assert.equal(result.score, 0)
    assert.deepEqual(result.reasons.map((reason) => reason.type), ['dangers', 'cautions', 'clean-rule'])
  })

  test('rows come in the rule table\'s order; hints and unknown ids are not counted', () => {
    const result = scoreMission(tally({ 'forks-high-travel': 1, 'obstacle-ahead': 1, 'release-load': 3, 'no-such-rule': 2 }), rules)
    assert.deepEqual(result.rules.map((row) => row.id), ['obstacle-ahead', 'forks-high-travel'])
  })

  test('a missing or partial tally is a clean one', () => {
    assert.equal(scoreMission(undefined, rules).score, 100)
    assert.equal(scoreMission({ violations: { overspeed: 1 } }, rules).score, 95)
  })
})

describe('resolvePassRules', () => {
  test('a course without pass rules gets the stock ones', () => {
    assert.deepEqual(resolvePassRules({}), { ...DEFAULT_PASS_RULES, cleanRules: [...DEFAULT_PASS_RULES.cleanRules] })
  })

  test('each valid key is the course\'s own; each invalid one falls back', () => {
    const rules = resolvePassRules({
      passRules: { maxCautions: 0, cleanRules: ['tail-swing', 'release-load', 'nope'], cautionPenalty: -1, dangerPenalty: 50 },
    })
    assert.equal(rules.maxCautions, 0)
    assert.deepEqual(rules.cleanRules, ['tail-swing'])
    assert.equal(rules.cautionPenalty, DEFAULT_PASS_RULES.cautionPenalty)
    assert.equal(rules.dangerPenalty, 50)
  })

  test('stricter rules fail what the stock ones pass', () => {
    const strict = resolvePassRules({ passRules: { maxCautions: 0 } })
    assert.equal(scoreMission(tally({ overspeed: 1 }), strict).passed, false)
  })
})

describe('passRulesProblems', () => {
  test('nothing stored, or the stock rules, is fine', () => {
    assert.deepEqual(passRulesProblems({}), [])
    assert.deepEqual(passRulesProblems({ passRules: { ...DEFAULT_PASS_RULES } }), [])
  })

  test('names what is wrong', () => {
    assert.equal(passRulesProblems({ passRules: { maxCautions: 1.5 } }).length, 1)
    assert.equal(passRulesProblems({ passRules: { dangerPenalty: 101 } }).length, 1)
    assert.equal(passRulesProblems({ passRules: { cleanRules: 'overspeed' } }).length, 1)
    assert.match(passRulesProblems({ passRules: { cleanRules: ['release-load'] } })[0], /not counted: release-load/)
    assert.equal(passRulesProblems({ passRules: [] }).length, 1)
  })

  test('a sign that must be clean cannot be switched off for the course', () => {
    const course = { alerts: { overspeed: false }, passRules: { cleanRules: ['overspeed'] } }
    assert.match(passRulesProblems(course)[0], /switched off for this course: overspeed/)
  })
})
