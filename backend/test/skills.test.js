// The Skills Checklist's routes (plan 4.8): what a learner reads of their own
// skills, what staff read of a trainee's, the sign-off trail's rules, and
// that a trainee cannot write a sign-off through any endpoint. Needs
// PostgreSQL (see helpers/testDatabase.js).
import { bearer, ids, loadFixtures, prisma } from './helpers/fixtures.js'
import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'
import adminRouter from '../src/routes/admin.js'
import authRouter from '../src/routes/auth.js'
import contentRouter from '../src/routes/content.js'
import progressRouter from '../src/routes/progress.js'

const app = createApp()

function call(method, url, userId, body) {
  let pending = request(app)[method](url)
  if (userId) pending = pending.set('Authorization', bearer(userId))
  return body === undefined ? pending : pending.send(body)
}

const signOff = (actor, target, skillId, note) =>
  call('post', `/api/admin/users/${target}/skills/${skillId}/signoff`, actor, note === undefined ? {} : { note })
const revoke = (actor, target, skillId, note) =>
  call('post', `/api/admin/users/${target}/skills/${skillId}/revoke`, actor, note === undefined ? {} : { note })
const staffView = (actor, target) => call('get', `/api/admin/users/${target}/skills`, actor)
const ownSkills = (userId) => call('get', '/api/progress/skills', userId)

const resultFor = (body, skillId) => body.results.find((result) => result.skillId === skillId)

// The trainee completes the fixture step, which is the fixture skill's one
// piece of evidence.
function completeFixtureStep(userId) {
  return prisma.progressSnapshot.upsert({
    where: { userId },
    update: {},
    create: { userId, data: { simulations: { [ids.moduleSlug]: { stepsComplete: { [ids.course]: true } } } } },
  })
}

beforeEach(loadFixtures)
after(() => prisma.$disconnect())

describe('the catalogue', () => {
  test('any signed-in user reads it, with the module links by slug; signed out is a 401', async () => {
    for (const userId of [ids.admin, ids.instructor, ids.trainee]) {
      const response = await call('get', '/api/content/skills', userId)
      assert.equal(response.status, 200)
      const skill = response.body.find((entry) => entry.id === ids.skill)
      assert.deepEqual(skill.modules, [{ moduleId: ids.moduleId, moduleSlug: ids.moduleSlug, relation: 'teaches' }])
      // With the titles it names beside it, for the page to describe it by.
      assert.deepEqual(skill.evidence, [
        { type: 'step-complete', module: ids.moduleSlug, stepId: ids.course, moduleTitle: 'Fixture module', stepTitle: 'Fixture step' },
      ])
    }
    assert.equal((await call('get', '/api/content/skills', null)).status, 401)
  })
})

describe("a learner's own skills", () => {
  test('are judged from their progress', async () => {
    let { body } = await ownSkills(ids.trainee)
    assert.equal(resultFor(body, ids.skill).status, 'not-started')

    await completeFixtureStep(ids.trainee)
    ;({ body } = await ownSkills(ids.trainee))
    const result = resultFor(body, ids.skill)
    assert.equal(result.status, 'demonstrated')
    assert.deepEqual(result.evidence.map((item) => item.met), [true])
  })

  test('show a sign-off as its stamp, without the note', async () => {
    const { body } = await ownSkills(ids.otherTrainee)
    const result = resultFor(body, ids.builtInSkill)
    assert.equal(result.status, 'signed-off')
    assert.deepEqual(Object.keys(result.signoff).sort(), ['actorName', 'actorRemoved', 'createdAt'])
    assert.equal(result.signoff.actorName, ids.admin)
    assert.ok(!JSON.stringify(body).includes('Seen in the yard'))
  })

  test('signed out is a 401', async () => {
    assert.equal((await ownSkills(null)).status, 401)
  })
})

describe('signing off and revoking', () => {
  test('an instructor signs off a trainee, revokes it with a note, and the history shows both, newest first', async () => {
    await completeFixtureStep(ids.trainee)

    const signed = await signOff(ids.instructor, ids.trainee, ids.skill)
    assert.equal(signed.status, 200, JSON.stringify(signed.body))
    assert.equal(signed.body.event.evidenceStatus, 'demonstrated')
    assert.equal(resultFor((await ownSkills(ids.trainee)).body, ids.skill).status, 'signed-off')

    const revoked = await revoke(ids.instructor, ids.trainee, ids.skill, 'Hit the rack on the next run')
    assert.equal(revoked.status, 200)

    const { body } = await staffView(ids.instructor, ids.trainee)
    assert.deepEqual(body.history.map((event) => event.action), ['revoke', 'signoff'])
    assert.equal(body.history[0].note, 'Hit the rack on the next run')
    assert.equal(body.history[0].actorName, ids.instructor)
    assert.equal(resultFor(body, ids.skill).status, 'demonstrated', 'a revoke puts it back on the evidence')
  })

  test('only ever inserts: nothing in the trail changes', async () => {
    const before = await prisma.skillSignoffEvent.findMany({ orderBy: { id: 'asc' } })
    await revoke(ids.admin, ids.otherTrainee, ids.builtInSkill, 'Refresher needed')
    await signOff(ids.admin, ids.otherTrainee, ids.builtInSkill, 'Refresher done')
    const afterwards = await prisma.skillSignoffEvent.findMany({ orderBy: { createdAt: 'asc' } })
    assert.equal(afterwards.length, before.length + 2)
    assert.deepEqual(afterwards[0], before[0])
  })

  test('a revoke needs a note', async () => {
    const response = await revoke(ids.admin, ids.otherTrainee, ids.builtInSkill, '   ')
    assert.equal(response.status, 400)
    assert.equal(await prisma.skillSignoffEvent.count(), 1)
  })

  test('evidence not yet met can be signed off, with a note saying why', async () => {
    assert.equal((await signOff(ids.instructor, ids.trainee, ids.skill)).status, 400)
    const response = await signOff(ids.instructor, ids.trainee, ids.skill, 'Watched them do it at the yard')
    assert.equal(response.status, 200)
    assert.equal(response.body.event.evidenceStatus, 'not-started')
  })

  test('signing off twice, or revoking what is not signed off, is a 409', async () => {
    assert.equal((await signOff(ids.admin, ids.otherTrainee, ids.builtInSkill, 'Again')).status, 409)
    assert.equal((await revoke(ids.admin, ids.trainee, ids.skill, 'Nothing to revoke')).status, 409)
  })

  test('an unknown skill or account is a 404', async () => {
    assert.equal((await signOff(ids.admin, ids.trainee, 'no-such-skill', 'x')).status, 404)
    assert.equal((await signOff(ids.admin, 'no-such-user', ids.skill, 'x')).status, 404)
  })

  test('an over-long note is refused', async () => {
    assert.equal((await signOff(ids.admin, ids.trainee, ids.skill, 'x'.repeat(1001))).status, 400)
  })
})

describe('whose skills each role reaches', () => {
  const cases = [
    ['INSTRUCTOR', ids.instructor, 'a trainee', ids.trainee, 200],
    ['INSTRUCTOR', ids.instructor, 'an admin', ids.admin, 403],
    ['INSTRUCTOR', ids.instructor, 'another instructor', ids.otherInstructor, 403],
    ['INSTRUCTOR', ids.instructor, 'themselves', ids.instructor, 403],
    ['ADMIN', ids.admin, 'an instructor', ids.instructor, 200],
    ['ADMIN', ids.admin, 'another admin', ids.otherAdmin, 200],
    ['ADMIN', ids.admin, 'themselves', ids.admin, 403],
  ]

  for (const [role, actor, label, target, expected] of cases) {
    test(`${role} signing off ${label}: ${expected}`, async () => {
      const response = await signOff(actor, target, ids.skill, 'Observed')
      assert.equal(response.status, expected)
      assert.equal(await prisma.skillSignoffEvent.count({ where: { userId: target } }), expected === 200 ? 1 : 0)
    })
  }

  test('an instructor cannot read an admin\'s or another instructor\'s skills', async () => {
    assert.equal((await staffView(ids.instructor, ids.admin)).status, 403)
    assert.equal((await staffView(ids.instructor, ids.otherInstructor)).status, 403)
    assert.equal((await staffView(ids.admin, ids.otherInstructor)).status, 200)
  })
})

describe('the trail outlives what it refers to', () => {
  test('a deleted actor reads as former staff, with the name they acted under', async () => {
    await prisma.user.delete({ where: { id: ids.admin } })
    const { body } = await staffView(ids.instructor, ids.otherTrainee)
    assert.equal(body.history.length, 1)
    assert.equal(body.history[0].actorRemoved, true)
    assert.equal(body.history[0].actorName, ids.admin)
    assert.equal(resultFor(body, ids.builtInSkill).status, 'signed-off')
  })

  test('a skill with sign-offs cannot be deleted; one without can', async () => {
    const refused = await call('delete', `/api/admin/skills/${ids.builtInSkill}`, ids.admin)
    assert.equal(refused.status, 409)
    assert.equal(await prisma.skillSignoffEvent.count(), 1)
    assert.equal((await call('delete', `/api/admin/skills/${ids.skill}`, ids.admin)).status, 200)
  })

  test('a progress reset leaves sign-offs alone', async () => {
    await prisma.progressSnapshot.create({ data: { userId: ids.otherTrainee, data: { quizzes: {} } } })
    const reset = await call('post', `/api/admin/users/${ids.otherTrainee}/progress/reset`, ids.instructor)
    assert.equal(reset.status, 200)

    assert.equal(await prisma.skillSignoffEvent.count({ where: { userId: ids.otherTrainee } }), 1)
    assert.equal(resultFor((await ownSkills(ids.otherTrainee)).body, ids.builtInSkill).status, 'signed-off')
  })
})

describe('the catalogue editor', () => {
  test('refuses evidence it cannot judge, and an unknown category', async () => {
    const bad = await call('patch', `/api/admin/skills/${ids.skill}`, ids.admin, {
      evidence: [{ type: 'clean-run', module: ids.moduleSlug, stepId: ids.course, rules: ['no-such-rule'] }],
    })
    assert.equal(bad.status, 400)
    assert.equal(bad.body.problems.length, 1)
    assert.equal((await call('patch', `/api/admin/skills/${ids.skill}`, ids.admin, { category: 'luck' })).status, 400)
  })

  test('stores evidence cleaned to the fields its type takes', async () => {
    const response = await call('patch', `/api/admin/skills/${ids.skill}`, ids.admin, {
      evidence: [{ type: 'quiz-score', module: ids.moduleSlug, min: '75', extra: 'dropped' }],
    })
    assert.equal(response.status, 200)
    assert.deepEqual((await prisma.skill.findUnique({ where: { id: ids.skill } })).evidence, [{ type: 'quiz-score', module: ids.moduleSlug, min: 75 }])
  })

  test('a new skill takes its id from the title, and a clash is a 409', async () => {
    const created = await call('post', '/api/admin/skills', ids.instructor, { title: 'Fixture skill' })
    assert.equal(created.status, 409)
    const other = await call('post', '/api/admin/skills', ids.instructor, { title: 'Read hand signals' })
    assert.equal(other.body.skill.id, 'read-hand-signals')
    assert.equal(other.body.skill.builtIn, false)
  })

  test('module links replace the module\'s set and are checked', async () => {
    const url = `/api/admin/modules/${ids.moduleId}/skills`
    assert.equal((await call('put', url, ids.admin, { links: [{ skillId: ids.skill, relation: 'maybe' }] })).status, 400)
    assert.equal((await call('put', url, ids.admin, { links: [{ skillId: 'nope', relation: 'teaches' }] })).status, 400)
    const twice = [{ skillId: ids.skill, relation: 'teaches' }, { skillId: ids.skill, relation: 'requires' }]
    assert.equal((await call('put', url, ids.admin, { links: twice })).status, 400)

    const response = await call('put', url, ids.admin, { links: [{ skillId: ids.builtInSkill, relation: 'teaches' }] })
    assert.equal(response.status, 200)
    const links = await prisma.moduleSkill.findMany({ where: { moduleId: ids.moduleId } })
    assert.deepEqual(links.map((link) => [link.skillId, link.relation]), [[ids.builtInSkill, 'teaches']])
  })

  test('reset restores a built-in skill\'s stock wording and keeps its place', async () => {
    await prisma.skill.update({ where: { id: ids.builtInSkill }, data: { title: 'Edited', sortOrder: 7 } })
    const { body } = await call('post', `/api/admin/skills/${ids.builtInSkill}/reset`, ids.admin)
    assert.notEqual(body.skill.title, 'Edited')
    assert.equal(body.skill.sortOrder, 7)
    assert.equal((await call('post', `/api/admin/skills/${ids.skill}/reset`, ids.admin)).status, 400)
  })
})

// Plan 4.8, "done when": a trainee cannot write a sign-off through any
// endpoint. Every route the API has is called as the trainee, with a body
// forging a sign-off every way it could be spelt, and afterwards there is
// still exactly the one fixture event (for another trainee) and nothing of
// the trainee's is signed off.
describe('a trainee cannot write a sign-off through any endpoint', () => {
  const forged = {
    note: 'I signed myself off',
    action: 'signoff',
    userId: ids.trainee,
    skillId: ids.skill,
    actorId: ids.admin,
    actorName: 'An instructor',
    signoff: { actorName: 'An instructor', createdAt: new Date().toISOString() },
    skills: { [ids.skill]: { status: 'signed-off' } },
    skillSignoffs: [{ skillId: ids.skill, action: 'signoff' }],
    events: [{ skillId: ids.skill, action: 'signoff' }],
  }

  const routers = [
    ['/api/auth', authRouter],
    ['/api/content', contentRouter],
    ['/api/progress', progressRouter],
    ['/api/admin', adminRouter],
  ]
  const params = { id: ids.trainee, skillId: ids.skill, moduleSlug: ids.moduleSlug }
  const everyRoute = routers.flatMap(([base, router]) =>
    router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route.methods).map((method) => ({
          method,
          // The router's own '/' is the mount point itself.
          url: base + layer.route.path.replace(/:(\w+)/g, (_, name) => params[name]).replace(/^\/$/, ''),
        })),
      ),
  )

  test('reaches every route there is', () => {
    assert.ok(everyRoute.length > 50, `${everyRoute.length} routes`)
    assert.ok(everyRoute.some((route) => route.url.endsWith(`/users/${ids.trainee}/skills/${ids.skill}/signoff`)))
    assert.ok(everyRoute.some((route) => route.method === 'put' && route.url === '/api/progress'))
  })

  test('none of them writes one', async () => {
    await completeFixtureStep(ids.trainee)
    for (const { method, url } of everyRoute) {
      // Signing up would create an account, not a sign-off, and trips the
      // rate limiter for the next test file; it is not a route a signed-in
      // trainee's token reaches anyway.
      if (url === '/api/auth/signup' || url === '/api/auth/login') continue
      const response = await call(method, url, ids.trainee, method === 'get' ? undefined : forged)
      assert.ok(response.status !== 200 || !url.startsWith('/api/admin'), `${method} ${url}: ${response.status}`)
    }

    const events = await prisma.skillSignoffEvent.findMany()
    assert.deepEqual(events.map((event) => event.userId), [ids.otherTrainee])
    const { body } = await ownSkills(ids.trainee)
    assert.ok(body.results.every((result) => result.status !== 'signed-off'))
  })

  test('a forged sign-off in the progress document is stored as data and never read as one', async () => {
    const response = await call('put', '/api/progress', ids.trainee, {
      version: 1,
      simulations: {},
      ...forged,
      baseRevision: 0,
    })
    assert.equal(response.status, 200)

    const { body } = await ownSkills(ids.trainee)
    assert.equal(resultFor(body, ids.skill).status, 'not-started')
    assert.equal(resultFor(body, ids.skill).signoff, null)
    assert.equal(await prisma.skillSignoffEvent.count({ where: { userId: ids.trainee } }), 0)
  })
})
