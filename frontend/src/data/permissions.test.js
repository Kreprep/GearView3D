import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  can,
  canActOnRole,
  canOpenDashboard,
  normalizeRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
} from './permissions.js'

// The matrix of plan 3.7, written out rather than derived from the file under
// test: a permission granted or taken away by accident fails here.
const MATRIX = {
  'content.edit': { ADMIN: true, INSTRUCTOR: true, TRAINEE: false },
  'equipment.edit': { ADMIN: true, INSTRUCTOR: true, TRAINEE: false },
  'users.view': { ADMIN: true, INSTRUCTOR: true, TRAINEE: false },
  'users.manage': { ADMIN: true, INSTRUCTOR: false, TRAINEE: false },
  'progress.view': { ADMIN: true, INSTRUCTOR: true, TRAINEE: false },
  'progress.reset': { ADMIN: true, INSTRUCTOR: true, TRAINEE: false },
  'skills.signoff': { ADMIN: true, INSTRUCTOR: true, TRAINEE: false },
}

test('can() answers the plan 3.7 matrix for every role and permission', () => {
  assert.deepEqual([...PERMISSIONS].sort(), Object.keys(MATRIX).sort())
  for (const [permission, byRole] of Object.entries(MATRIX)) {
    for (const role of ROLES) {
      assert.equal(can({ role }, permission), byRole[role], `${role} ${permission}`)
    }
  }
})

test('every permission a role holds is a known one', () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), [...ROLES].sort())
  for (const granted of Object.values(ROLE_PERMISSIONS)) {
    for (const permission of granted) assert.ok(PERMISSIONS.includes(permission), permission)
  }
})

test('no user, no role or an unknown role may do nothing', () => {
  for (const permission of PERMISSIONS) {
    assert.equal(can(null, permission), false)
    assert.equal(can(undefined, permission), false)
    assert.equal(can({}, permission), false)
    assert.equal(can({ role: 'SUPERUSER' }, permission), false)
    assert.equal(can({ role: 'admin' }, permission), false, 'roles are case-sensitive')
  }
  assert.equal(can({ role: 'ADMIN' }, 'no.such.permission'), false)
})

test('the dashboard opens for admins and instructors only', () => {
  assert.equal(canOpenDashboard({ role: 'ADMIN' }), true)
  assert.equal(canOpenDashboard({ role: 'INSTRUCTOR' }), true)
  assert.equal(canOpenDashboard({ role: 'TRAINEE' }), false)
  assert.equal(canOpenDashboard(null), false)
})

test('an instructor reaches trainees only; an admin reaches everyone', () => {
  const instructor = { role: 'INSTRUCTOR' }
  assert.equal(canActOnRole(instructor, 'TRAINEE'), true)
  assert.equal(canActOnRole(instructor, 'INSTRUCTOR'), false)
  assert.equal(canActOnRole(instructor, 'ADMIN'), false)
  for (const role of ROLES) assert.equal(canActOnRole({ role: 'ADMIN' }, role), true)
  for (const role of ROLES) assert.equal(canActOnRole({ role: 'TRAINEE' }, role), false)
  assert.equal(canActOnRole(null, 'TRAINEE'), false)
})

test('normalizeRole reads anything unknown as a trainee', () => {
  assert.equal(normalizeRole('INSTRUCTOR'), 'INSTRUCTOR')
  assert.equal(normalizeRole('SUPERUSER'), 'TRAINEE')
  assert.equal(normalizeRole(undefined), 'TRAINEE')
})
