// What each role may do. The one place a role is turned into a decision: the
// API's requirePermission() (backend/src/lib/auth.js) and the dashboard both
// read it, so nothing else compares `user.role` against a role name.
//
// Pure and backend-importable, like the rest of data/: no React, no browser
// APIs, no Prisma.
//
// A permission says what a role may do, not to whom. Instructors hold
// `users.view`, `progress.view` and `progress.reset` for trainees only; that
// reach is `canActOnRole()` below, and the API applies it to every row it
// sends and every account it changes.

export const ROLES = ['ADMIN', 'INSTRUCTOR', 'TRAINEE']

export const PERMISSIONS = [
  // Modules, steps, hotspots, part categories, checklist items, quiz questions.
  'content.edit',
  // Equipment Settings: title and artwork, hub copy, the vehicle profile.
  'equipment.edit',
  // See the accounts list.
  'users.view',
  // Create accounts, edit a name, email, password or role, delete. Admin only
  // (decided 2026-09-29).
  'users.manage',
  // See scores, reports and the activity log.
  'progress.view',
  // Clear a learner's saved progress.
  'progress.reset',
  // Sign a skill off or revoke it (the Phase 9 skills checklist).
  'skills.signoff',
]

export const ROLE_PERMISSIONS = {
  ADMIN: ['content.edit', 'equipment.edit', 'users.view', 'users.manage', 'progress.view', 'progress.reset', 'skills.signoff'],
  INSTRUCTOR: ['content.edit', 'equipment.edit', 'users.view', 'progress.view', 'progress.reset', 'skills.signoff'],
  TRAINEE: [],
}

// `user` is anything with a `role`: the signed-in user on either side. A
// missing user or a role this file does not list may do nothing.
export function can(user, permission) {
  return Boolean(user && ROLE_PERMISSIONS[user.role]?.includes(permission))
}

export function canAny(user, permissions) {
  return permissions.some((permission) => can(user, permission))
}

// The permissions that open the admin dashboard: every one that has a screen
// there. `skills.signoff` does not need to: the sign-off controls are in
// Reports, which is progress.view, and every role holding one holds both.
export const DASHBOARD_PERMISSIONS = ['content.edit', 'equipment.edit', 'users.view', 'progress.view']

export function canOpenDashboard(user) {
  return canAny(user, DASHBOARD_PERMISSIONS)
}

// Whose accounts a role's users.view / progress.view / progress.reset reach.
// An instructor's stop at trainees: they neither see nor reset an admin or
// another instructor (decided 2026-10-01).
const ROLE_REACH = {
  ADMIN: ROLES,
  INSTRUCTOR: ['TRAINEE'],
  TRAINEE: [],
}

export function rolesWithinReach(user) {
  return ROLE_REACH[user?.role] || []
}

export function canActOnRole(user, targetRole) {
  return rolesWithinReach(user).includes(targetRole)
}

// Anything else, an unknown or missing value included, is a trainee: the role
// with no permissions.
export function normalizeRole(role) {
  return ROLES.includes(role) ? role : 'TRAINEE'
}

// English names for the admin dashboard, whose chrome is not translated. The
// learner header translates its own (`header.role.*`).
export const ROLE_LABELS = {
  ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  TRAINEE: 'Trainee',
}
