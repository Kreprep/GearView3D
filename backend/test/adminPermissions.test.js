// Every /api/admin route, called by every role and signed out, against the
// permission matrix (frontend/src/data/permissions.js, plan 3.7 and 4.7):
// 401 only when signed out, 403 when the role lacks the permission, 200 when
// it has it. Needs PostgreSQL (see helpers/testDatabase.js).
import { bearer, ids, loadFixtures, prisma } from './helpers/fixtures.js'
import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'
import adminRouter from '../src/routes/admin.js'

const app = createApp()

const STAFF = ['ADMIN', 'INSTRUCTOR']
const ADMIN_ONLY = ['ADMIN']
const DASHBOARD = ['content.edit', 'equipment.edit', 'users.view', 'progress.view']

// One row per route: the permission its guard must ask for, who may call it,
// and a request that succeeds for someone who may.
const routes = [
  { method: 'get', path: '/content', permissions: DASHBOARD, allowed: STAFF },

  { method: 'get', path: '/hotspots', permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/hotspots', permissions: ['content.edit'], allowed: STAFF, body: { label: 'New marker' } },
  { method: 'put', path: '/hotspots/:id', url: `/hotspots/${ids.hotspot}`, permissions: ['content.edit'], allowed: STAFF, body: { label: 'Moved' } },
  { method: 'post', path: '/hotspots/:id/publish', url: `/hotspots/${ids.hotspot}/publish`, permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/hotspots/:id/revert', url: `/hotspots/${ids.hotspot}/revert`, permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/hotspots/:id/reset', url: `/hotspots/${ids.builtInHotspot}/reset`, permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/hotspots/reorder', permissions: ['content.edit'], allowed: STAFF, body: { ids: [ids.hotspot, ids.builtInHotspot] } },
  { method: 'delete', path: '/hotspots/:id', url: `/hotspots/${ids.hotspot}`, permissions: ['content.edit'], allowed: STAFF },

  { method: 'post', path: '/hotspot-categories', permissions: ['content.edit'], allowed: STAFF, body: { label: 'New category' } },
  { method: 'patch', path: '/hotspot-categories/:id', url: `/hotspot-categories/${ids.category}`, permissions: ['content.edit'], allowed: STAFF, body: { label: 'Renamed' } },
  { method: 'delete', path: '/hotspot-categories/:id', url: `/hotspot-categories/${ids.category}`, permissions: ['content.edit'], allowed: STAFF },

  { method: 'patch', path: '/equipment', permissions: ['equipment.edit'], allowed: STAFF, body: { title: 'Counterbalance forklift' } },

  { method: 'post', path: '/modules', permissions: ['content.edit'], allowed: STAFF, body: { title: 'New module' } },
  { method: 'post', path: '/modules/reorder', permissions: ['content.edit'], allowed: STAFF, body: { ids: [ids.moduleId] } },
  { method: 'patch', path: '/modules/:id', url: `/modules/${ids.moduleId}`, permissions: ['content.edit'], allowed: STAFF, body: { title: 'Renamed' } },
  { method: 'delete', path: '/modules/:id', url: `/modules/${ids.moduleId}`, permissions: ['content.edit'], allowed: STAFF },

  {
    method: 'post',
    path: '/users',
    permissions: ['users.manage'],
    allowed: ADMIN_ONLY,
    body: { email: 'new@test.local', fullName: 'New Account', password: 'long-enough', role: 'INSTRUCTOR' },
  },
  { method: 'patch', path: '/users/:id', url: `/users/${ids.otherTrainee}`, permissions: ['users.manage'], allowed: ADMIN_ONLY, body: { fullName: 'Renamed' } },
  { method: 'delete', path: '/users/:id', url: `/users/${ids.otherTrainee}`, permissions: ['users.manage'], allowed: ADMIN_ONLY },
  { method: 'post', path: '/users/:id/progress/reset', url: `/users/${ids.otherTrainee}/progress/reset`, permissions: ['progress.reset'], allowed: STAFF },

  { method: 'post', path: '/checklist-items', permissions: ['content.edit'], allowed: STAFF, body: { moduleId: ids.moduleId, text: 'Check the chains' } },
  { method: 'patch', path: '/checklist-items/:id', url: `/checklist-items/${ids.checklistItem}`, permissions: ['content.edit'], allowed: STAFF, body: { text: 'Edited' } },
  { method: 'delete', path: '/checklist-items/:id', url: `/checklist-items/${ids.checklistItem}`, permissions: ['content.edit'], allowed: STAFF },

  {
    method: 'post',
    path: '/quiz-questions',
    permissions: ['content.edit'],
    allowed: STAFF,
    body: { context: 'parts', prompt: 'New question?', options: ['A', 'B'], answer: 'A' },
  },
  { method: 'patch', path: '/quiz-questions/:id', url: `/quiz-questions/${ids.partsQuestion}`, permissions: ['content.edit'], allowed: STAFF, body: { prompt: 'Edited?' } },
  { method: 'delete', path: '/quiz-questions/:id', url: `/quiz-questions/${ids.partsQuestion}`, permissions: ['content.edit'], allowed: STAFF },

  { method: 'get', path: '/courses', permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/courses', permissions: ['content.edit'], allowed: STAFF, body: { moduleSlug: ids.moduleSlug, kind: 'briefing', title: 'New step' } },
  { method: 'put', path: '/courses/:id', url: `/courses/${ids.course}`, permissions: ['content.edit'], allowed: STAFF, body: { title: 'Edited step' } },
  { method: 'post', path: '/courses/:id/publish', url: `/courses/${ids.course}/publish`, permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/courses/:id/revert', url: `/courses/${ids.course}/revert`, permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/courses/:id/reset', url: `/courses/${ids.builtInCourse}/reset`, permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/courses/reorder', permissions: ['content.edit'], allowed: STAFF, body: { moduleSlug: ids.moduleSlug, ids: [ids.course] } },
  { method: 'delete', path: '/courses/:id', url: `/courses/${ids.course}`, permissions: ['content.edit'], allowed: STAFF },

  { method: 'get', path: '/skills', permissions: ['content.edit'], allowed: STAFF },
  { method: 'post', path: '/skills', permissions: ['content.edit'], allowed: STAFF, body: { title: 'New skill' } },
  { method: 'post', path: '/skills/reorder', permissions: ['content.edit'], allowed: STAFF, body: { ids: [ids.skill, ids.builtInSkill] } },
  { method: 'patch', path: '/skills/:id', url: `/skills/${ids.skill}`, permissions: ['content.edit'], allowed: STAFF, body: { title: 'Renamed skill' } },
  { method: 'post', path: '/skills/:id/reset', url: `/skills/${ids.builtInSkill}/reset`, permissions: ['content.edit'], allowed: STAFF },
  { method: 'delete', path: '/skills/:id', url: `/skills/${ids.skill}`, permissions: ['content.edit'], allowed: STAFF },
  {
    method: 'put',
    path: '/modules/:id/skills',
    url: `/modules/${ids.moduleId}/skills`,
    permissions: ['content.edit'],
    allowed: STAFF,
    body: { links: [{ skillId: ids.skill, relation: 'requires' }] },
  },
  { method: 'get', path: '/users/:id/skills', url: `/users/${ids.otherTrainee}/skills`, permissions: ['progress.view'], allowed: STAFF },
  {
    method: 'post',
    path: '/users/:id/skills/:skillId/signoff',
    url: `/users/${ids.otherTrainee}/skills/${ids.skill}/signoff`,
    permissions: ['skills.signoff'],
    allowed: STAFF,
    body: { note: 'Seen in hands-on training' },
  },
  {
    method: 'post',
    path: '/users/:id/skills/:skillId/revoke',
    url: `/users/${ids.otherTrainee}/skills/${ids.builtInSkill}/revoke`,
    permissions: ['skills.signoff'],
    allowed: STAFF,
    body: { note: 'Drove into the rack on the next run' },
  },
]

const callers = [
  { label: 'signed out', userId: null, role: null },
  { label: 'ADMIN', userId: ids.admin, role: 'ADMIN' },
  { label: 'INSTRUCTOR', userId: ids.instructor, role: 'INSTRUCTOR' },
  { label: 'TRAINEE', userId: ids.trainee, role: 'TRAINEE' },
]

function call(method, url, userId, body) {
  let pending = request(app)[method](`/api/admin${url}`)
  if (userId) pending = pending.set('Authorization', bearer(userId))
  return body === undefined ? pending : pending.send(body)
}

after(() => prisma.$disconnect())

describe('the admin router', () => {
  // Read off the router itself, so a route added without a guard, or without
  // a row above, fails here rather than shipping open.
  const registered = adminRouter.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => ({
        key: `${method.toUpperCase()} ${layer.route.path}`,
        guard: layer.route.stack.find((entry) => entry.handle.permissions)?.handle,
      })),
    )

  test('every route is in the matrix, and every row is a route', () => {
    const tested = routes.map(({ method, path }) => `${method.toUpperCase()} ${path}`).sort()
    assert.deepEqual(registered.map(({ key }) => key).sort(), tested)
  })

  test('every route asks for the permission the matrix names', () => {
    for (const { key, guard } of registered) {
      const row = routes.find(({ method, path }) => `${method.toUpperCase()} ${path}` === key)
      assert.ok(guard, `${key} has no permission guard`)
      assert.deepEqual(guard.permissions, row.permissions, key)
    }
  })
})

for (const route of routes) {
  const url = route.url || route.path
  describe(`${route.method.toUpperCase()} /api/admin${route.path}`, () => {
    beforeEach(loadFixtures)

    for (const caller of callers) {
      const expected = !caller.role ? 401 : route.allowed.includes(caller.role) ? 200 : 403
      test(`${caller.label}: ${expected}`, async () => {
        const response = await call(route.method, url, caller.userId, route.body)
        assert.equal(response.status, expected, JSON.stringify(response.body))
      })
    }
  })
}

describe('what GET /content sends each role', () => {
  beforeEach(async () => {
    await loadFixtures()
    await prisma.progressSnapshot.createMany({
      data: [ids.admin, ids.instructor, ids.trainee].map((userId) => ({
        userId,
        data: { quizzes: { [ids.moduleSlug]: [{ id: `attempt-${userId}`, percentage: 50, attemptedAt: new Date().toISOString() }] } },
      })),
    })
  })

  test('an admin sees every account and every account\'s scores', async () => {
    const { body } = await call('get', '/content', ids.admin)
    assert.equal(body.users.length, 6)
    assert.deepEqual(new Set(body.progress.map((row) => row.user.id)), new Set([ids.admin, ids.instructor, ids.trainee]))
    assert.equal(body.quizQuestions.length, 2)
  })

  test('an instructor sees trainees only, in the user list, the reports and the activity log', async () => {
    const { body } = await call('get', '/content', ids.instructor)
    assert.deepEqual(body.users.map((user) => user.id).sort(), [ids.otherTrainee, ids.trainee].sort())
    assert.deepEqual(new Set(body.progress.map((row) => row.user.id)), new Set([ids.trainee]))
    assert.deepEqual(body.activityLogs.map((entry) => entry.user.id), [ids.trainee])
    // Content editing is theirs, answer keys included.
    assert.equal(body.quizQuestions.length, 2)
  })

  test('no password hash is sent', async () => {
    const { body } = await call('get', '/content', ids.admin)
    assert.ok(body.users.every((user) => !('passwordHash' in user)))
  })
})

describe('whose progress each role may reset', () => {
  beforeEach(loadFixtures)

  const cases = [
    ['INSTRUCTOR', ids.instructor, 'a trainee', ids.trainee, 200],
    ['INSTRUCTOR', ids.instructor, 'an admin', ids.admin, 403],
    ['INSTRUCTOR', ids.instructor, 'another instructor', ids.otherInstructor, 403],
    ['INSTRUCTOR', ids.instructor, 'themselves', ids.instructor, 403],
    ['ADMIN', ids.admin, 'a trainee', ids.trainee, 200],
    ['ADMIN', ids.admin, 'an instructor', ids.instructor, 200],
    ['ADMIN', ids.admin, 'another admin', ids.otherAdmin, 200],
    ['ADMIN', ids.admin, 'themselves', ids.admin, 200],
  ]

  for (const [role, actor, label, target, expected] of cases) {
    test(`${role} resetting ${label}: ${expected}`, async () => {
      await prisma.progressSnapshot.create({ data: { userId: target, data: { quizzes: { keep: [] } } } })
      const response = await call('post', `/users/${target}/progress/reset`, actor)
      assert.equal(response.status, expected)

      const snapshot = await prisma.progressSnapshot.findUnique({ where: { userId: target } })
      if (expected === 200) {
        assert.equal(snapshot.revision, 1)
        assert.deepEqual(snapshot.data.quizzes, {})
      } else {
        assert.equal(snapshot.revision, 0, 'a refused reset changes nothing')
        assert.deepEqual(snapshot.data, { quizzes: { keep: [] } })
      }
    })
  }

  test('an account that does not exist is a 404', async () => {
    const response = await call('post', '/users/no-such-user/progress/reset', ids.admin)
    assert.equal(response.status, 404)
  })
})

describe('what an instructor still cannot do through users.manage', () => {
  beforeEach(loadFixtures)

  test('change their own role', async () => {
    const response = await call('patch', `/users/${ids.instructor}`, ids.instructor, { role: 'ADMIN' })
    assert.equal(response.status, 403)
    const user = await prisma.user.findUnique({ where: { id: ids.instructor } })
    assert.equal(user.role, 'INSTRUCTOR')
  })

  test('change a trainee\'s password', async () => {
    const response = await call('patch', `/users/${ids.trainee}`, ids.instructor, { password: 'taken-over-1' })
    assert.equal(response.status, 403)
    const user = await prisma.user.findUnique({ where: { id: ids.trainee } })
    assert.equal(user.passwordHash, 'unused')
  })
})

describe('roles on the user routes', () => {
  beforeEach(loadFixtures)

  test('an admin can make an account an instructor', async () => {
    const response = await call('patch', `/users/${ids.trainee}`, ids.admin, { role: 'INSTRUCTOR' })
    assert.equal(response.status, 200)
    assert.equal(response.body.user.role, 'INSTRUCTOR')
  })

  test('an unknown role is refused, not read as a trainee', async () => {
    const response = await call('patch', `/users/${ids.instructor}`, ids.admin, { role: 'SUPERUSER' })
    assert.equal(response.status, 400)
    const user = await prisma.user.findUnique({ where: { id: ids.instructor } })
    assert.equal(user.role, 'INSTRUCTOR')
  })

  test('nobody changes their own role', async () => {
    const response = await call('patch', `/users/${ids.admin}`, ids.admin, { role: 'TRAINEE' })
    assert.equal(response.status, 400)
  })

  test('a role taken away applies to the next request, whatever the token says', async () => {
    await prisma.user.update({ where: { id: ids.instructor }, data: { role: 'TRAINEE' } })
    const response = await call('get', '/content', ids.instructor)
    assert.equal(response.status, 403)
  })
})
