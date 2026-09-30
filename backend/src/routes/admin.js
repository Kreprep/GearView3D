import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { publicUser, requireAnyPermission, requireAuth, requirePermission } from '../lib/auth.js'
import { resetProgress } from '../lib/progress.js'
import {
  can,
  canActOnRole,
  DASHBOARD_PERMISSIONS,
  ROLES,
  rolesWithinReach,
} from '../../../frontend/src/data/permissions.js'
import { buildAdminProgressReport } from '../lib/progressSummary.js'
import { slugify, uniqueSlug } from '../lib/slug.js'
import { EQUIPMENT_ID, findEquipment } from '../lib/equipment.js'
import {
  adminCourse,
  courseDraftFields,
  CREATABLE_KINDS,
  defaultCourseFor,
  editableCourse,
  emptyCourseContent,
  emptyCourseGeometry,
  emptyWalkAroundData,
  validateCoursePayload,
} from '../lib/courses.js'
import {
  defaultSkillFor,
  evaluateUserSkills,
  findSkill,
  historyEvent,
  isSkillCategory,
  listSkills,
  recordSignoffEvent,
  skillFields,
  staffResults,
} from '../lib/skills.js'
import { normalizeEvidence, SKILL_RELATIONS } from '../../../frontend/src/lib/skillProgress.js'
import {
  adminHotspot,
  defaultHotspotFor,
  editableHotspot,
  hotspotDraftFields,
} from '../lib/hotspots.js'

const router = Router()

// Everyone here is signed in; what they may do is decided per route, by the
// guard each one names. There is no blanket role check: a route added without
// a guard fails test/adminPermissions.test.js.
router.use(requireAuth)

const canOpenDashboard = requireAnyPermission(DASHBOARD_PERMISSIONS)
const canEditContent = requirePermission('content.edit')
const canEditEquipment = requirePermission('equipment.edit')
const canManageUsers = requirePermission('users.manage')
const canResetProgress = requirePermission('progress.reset')
const canViewProgress = requirePermission('progress.view')
const canSignOffSkills = requirePermission('skills.signoff')

// Update payloads arrive as whole objects from the dashboard; keep only the
// columns each model actually owns.
function pick(source, keys) {
  const result = {}
  for (const key of keys) {
    if (source?.[key] !== undefined) {
      result[key] = source[key]
    }
  }
  return result
}

// Every module is course-backed now that walk-around checks are step rows, so
// this is just "does the module exist" - DB-driven so a module an admin just
// created is immediately usable.
async function isCourseCapableModuleSlug(moduleSlug) {
  if (!moduleSlug) return false
  const module = await prisma.module.findUnique({ where: { slug: moduleSlug } })
  return Boolean(module)
}

const moduleFields = ['title', 'fullTitle', 'subtitle', 'description', 'imageUrl', 'sortOrder']
// `content` is the hub/module-list copy overrides (frontend
// data/hubContent.js); it is stored whole, so the client sends the full object
// and blank keys mean "fall back to the coded default".
const equipmentFields = ['title', 'imageUrl', 'content', 'simConfig']
const checklistFields = ['text', 'sortOrder']
const quizFields = ['prompt', 'options', 'answer', 'sortOrder']
const hotspotCategoryFields = ['label', 'sortOrder']

// Options are stored as plain strings (`answer` is one of them).
function normalizeOptions(options = []) {
  return (Array.isArray(options) ? options : []).filter((option) => typeof option === 'string' && option)
}

// Everything the dashboard opens with, for whoever may open it. What comes
// back depends on the caller: the answer keys need content.edit, the accounts
// users.view and the scores progress.view, and the last two only ever cover
// the roles within the caller's reach (an instructor's is trainees).
router.get('/content', canOpenDashboard, async (req, res) => {
  const reach = rolesWithinReach(req.user)

  const [
    equipment,
    modules,
    hotspotCategories,
    checklists,
    quizQuestions,
    users,
    snapshots,
    partsHotspotCount,
  ] = await Promise.all([
    findEquipment(),
    prisma.module.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.hotspotCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.checklistItem.findMany({ orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] }),
    can(req.user, 'content.edit')
      ? prisma.quizQuestion.findMany({ orderBy: [{ context: 'asc' }, { sortOrder: 'asc' }] })
      : [],
    can(req.user, 'users.view')
      ? prisma.user.findMany({ where: { role: { in: reach } }, orderBy: { createdAt: 'asc' } })
      : [],
    can(req.user, 'progress.view')
      ? prisma.progressSnapshot.findMany({ where: { user: { role: { in: reach } } }, include: { user: true } })
      : [],
    prisma.hotspot.count({ where: { published: true, inParts: true } }),
  ])

  const checklistTotals = {}
  for (const item of checklists) {
    const module = modules.find((entry) => entry.id === item.moduleId)
    if (module) {
      checklistTotals[module.slug] = (checklistTotals[module.slug] || 0) + 1
    }
  }

  const { progress, activityLogs } = buildAdminProgressReport(snapshots, modules, checklistTotals)

  res.json({
    equipment,
    modules,
    // Hotspots are not here: they carry position blobs and per-surface text
    // that only the hotspot editor needs, so it lists them itself the way the
    // Module Editor lists course rows. The count is what the training hub
    // decides "is there a parts page" from, so the Hub Content editor can show
    // the same default copy the hub will.
    partsHotspotCount,
    hotspotCategories,
    checklists,
    quizQuestions,
    users: users.map(publicUser),
    progress,
    activityLogs,
  })
})

// --- Hotspots ---------------------------------------------------------------
// One set of endpoints for every marker on the model, whichever surface shows
// it.
//
// Same draft/publish/builtIn shape as courses: an edit is a draft, learners
// keep seeing the published columns until Publish, and a `builtIn` row can be
// reset to its baseline in frontend/src/data/hotspotDefaults.js.

router.get('/hotspots', canEditContent, async (req, res) => {
  const rows = await prisma.hotspot.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json({ hotspots: rows.map(adminHotspot) })
})

router.post('/hotspots', canEditContent, async (req, res) => {
  const payload = req.body || {}
  if (!payload.label?.trim()) {
    return res.status(400).json({ error: 'Hotspot label is required' })
  }

  // Learner progress and walk-around step data reference the id bare, so it
  // is fixed at creation and a clash is refused rather than renamed.
  const id = slugify(payload.id || payload.label)
  if (!id) {
    return res.status(400).json({ error: 'Hotspot id could not be derived from the label' })
  }
  if (await prisma.hotspot.findUnique({ where: { id } })) {
    return res.status(409).json({ error: `A hotspot with id "${id}" already exists` })
  }

  const last = await prisma.hotspot.findFirst({ orderBy: { sortOrder: 'desc' } })

  // Created unpublished: a new hotspot has no position worth showing a learner
  // until the admin places it, so it must not reach them before first publish.
  const hotspot = await prisma.hotspot.create({
    data: {
      id,
      label: payload.label.trim(),
      position: payload.position === null ? null : payload.position || [0, 0.3, 0],
      inParts: payload.inParts !== false,
      inWalkAround: Boolean(payload.inWalkAround),
      title: payload.title || payload.label.trim(),
      subtitle: payload.subtitle || '',
      image: payload.image || '',
      description: payload.description || '',
      category: payload.category || '',
      functionText: payload.functionText || '',
      inspectionReminder: payload.inspectionReminder || '',
      safetyNote: payload.safetyNote || '',
      relatedModule: payload.relatedModule || '',
      checklist: payload.checklist || [],
      inspectCategory: payload.inspectCategory || '',
      state: payload.state || '',
      inspect: payload.inspect || '',
      safeFeedback: payload.safeFeedback || '',
      unsafeFeedback: payload.unsafeFeedback || '',
      unsafeScenarios: payload.unsafeScenarios || [],
      sortOrder: (last?.sortOrder || 0) + 1,
      published: false,
      builtIn: false,
    },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

// Saves an edit as a draft; learners keep seeing the published position/text
// until Publish.
router.put('/hotspots/:id', canEditContent, async (req, res) => {
  const row = await prisma.hotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })

  const draft = { ...editableHotspot(row), ...pick(req.body, hotspotDraftFields) }
  const hotspot = await prisma.hotspot.update({
    where: { id: row.id },
    data: {
      draft,
      ...(typeof req.body?.sortOrder === 'number' ? { sortOrder: req.body.sortOrder } : {}),
    },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

router.post('/hotspots/:id/publish', canEditContent, async (req, res) => {
  const row = await prisma.hotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })
  if (!row.draft) return res.status(400).json({ error: 'There is no draft to publish' })

  const hotspot = await prisma.hotspot.update({
    where: { id: row.id },
    data: { ...pick(row.draft, hotspotDraftFields), draft: null, published: true },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

router.post('/hotspots/:id/revert', canEditContent, async (req, res) => {
  const hotspot = await prisma.hotspot.update({
    where: { id: req.params.id },
    data: { draft: null },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

// Built-in hotspots only: restores the seeded content and clears any draft.
router.post('/hotspots/:id/reset', canEditContent, async (req, res) => {
  const row = await prisma.hotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })

  const defaults = defaultHotspotFor(row.id)
  if (!row.builtIn || !defaults) {
    return res.status(400).json({ error: 'This hotspot has no built-in default to reset to' })
  }

  const hotspot = await prisma.hotspot.update({
    where: { id: row.id },
    data: { ...pick(defaults, hotspotDraftFields), draft: null, published: true },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

// Whole-list reorder; ids not in the list are left alone.
router.post('/hotspots/reorder', canEditContent, async (req, res) => {
  const { ids } = req.body || {}
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids is required' })
  }

  // updateMany (not update) so an id deleted in another tab is skipped rather
  // than failing the whole transaction.
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.hotspot.updateMany({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  )

  const rows = await prisma.hotspot.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json({ hotspots: rows.map(adminHotspot) })
})

router.delete('/hotspots/:id', canEditContent, async (req, res) => {
  await prisma.hotspot.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Category rows are a short list of labels with no learner-visible body text,
// so they save immediately rather than through a draft.
router.post('/hotspot-categories', canEditContent, async (req, res) => {
  const payload = req.body || {}
  if (!payload.label) {
    return res.status(400).json({ error: 'Category label is required' })
  }

  const last = await prisma.hotspotCategory.findFirst({ orderBy: { sortOrder: 'desc' } })
  const category = await prisma.hotspotCategory.create({
    data: {
      id: payload.id || payload.label,
      label: payload.label,
      sortOrder: (last?.sortOrder || 0) + 1,
    },
  })
  res.json({ category })
})

router.patch('/hotspot-categories/:id', canEditContent, async (req, res) => {
  const category = await prisma.hotspotCategory.update({
    where: { id: req.params.id },
    data: pick(req.body, hotspotCategoryFields),
  })
  res.json({ category })
})

router.delete('/hotspot-categories/:id', canEditContent, async (req, res) => {
  const inUse = await prisma.hotspot.count({ where: { category: req.params.id } })
  if (inUse) {
    return res.status(400).json({ error: `${inUse} hotspot(s) still use this category` })
  }

  await prisma.hotspotCategory.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// The one Equipment row: title, hub artwork, hub copy and driving overrides.
router.patch('/equipment', canEditEquipment, async (req, res) => {
  const data = pick(req.body, equipmentFields)

  // Only overrides are stored: a key an admin cleared is dropped so the coded
  // default in data/hubContent.js applies again (and keeps applying when that
  // default is improved later).
  if ('content' in data) {
    const entries = Object.entries(data.content || {}).filter(
      ([, value]) => typeof value === 'string' && value.trim() !== '',
    )
    data.content = entries.length ? Object.fromEntries(entries.map(([key, value]) => [key, value.trim()])) : null
  }

  // Same rule for the vehicle profile (data/vehicleProfile.js): an empty
  // object means "everything is default", so the column goes back to null.
  if ('simConfig' in data) {
    const entries = Object.entries(data.simConfig || {}).filter(([, value]) => {
      if (value === null || value === undefined || value === '') return false
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') return Object.keys(value).length > 0
      return true
    })
    data.simConfig = entries.length ? Object.fromEntries(entries) : null
  }

  const equipment = await prisma.equipment.update({ where: { id: EQUIPMENT_ID }, data })
  res.json({ equipment })
})

// A module created here starts with one briefing step, so the Module Editor
// (and the learner page) has something to show instead of an empty shell.
router.post('/modules', canEditContent, async (req, res) => {
  const payload = req.body || {}
  const title = String(payload.title || '').trim()

  if (!title) return res.status(400).json({ error: 'Module title is required' })

  const slugBase = slugify(title) || 'module'
  const slug = await uniqueSlug(slugBase, (candidate) => prisma.module.findUnique({ where: { slug: candidate } }))

  // Module.id is a plain Int (it mirrors the seeded module numbering rather
  // than being generated), so a new row takes the next one.
  const [lastId, lastOrder] = await Promise.all([
    prisma.module.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }),
    prisma.module.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }),
  ])

  const module = await prisma.module.create({
    data: {
      id: (lastId?.id || 0) + 1,
      slug,
      title,
      fullTitle: payload.fullTitle || title,
      subtitle: payload.subtitle || '',
      description: payload.description || '',
      imageUrl: payload.imageUrl || '',
      sortOrder: (lastOrder?.sortOrder || 0) + 1,
    },
  })

  await prisma.course.create({
    data: {
      id: `${slug}-briefing`,
      moduleSlug: slug,
      sortOrder: 1,
      kind: 'briefing',
      title: 'Briefing',
      content: emptyCourseContent('briefing'),
      published: true,
      builtIn: false,
    },
  })

  res.json({ module })
})

// Whole-list reorder; ids not in the list are left alone. Mirrors
// /courses/reorder.
router.post('/modules/reorder', canEditContent, async (req, res) => {
  const { ids } = req.body || {}
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids is required' })
  }

  // updateMany (not update) so an id deleted in another tab is skipped rather
  // than failing the whole transaction.
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.module.updateMany({ where: { id: Number(id) }, data: { sortOrder: index + 1 } }),
    ),
  )

  const modules = await prisma.module.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json({ modules })
})

router.patch('/modules/:id', canEditContent, async (req, res) => {
  const module = await prisma.module.update({
    where: { id: Number(req.params.id) },
    data: pick(req.body, moduleFields),
  })
  res.json({ module })
})

// ChecklistItem and QuizQuestion cascade with the FK; Course rows reference the
// module by slug rather than by relation, so they are removed here.
router.delete('/modules/:id', canEditContent, async (req, res) => {
  const module = await prisma.module.findUnique({ where: { id: Number(req.params.id) } })
  if (!module) return res.status(404).json({ error: 'Record not found' })

  await prisma.course.deleteMany({ where: { moduleSlug: module.slug } })
  await prisma.module.delete({ where: { id: module.id } })
  res.json({ deleted: true })
})

// --- Users ------------------------------------------------------------------
// Accounts save immediately, no draft/publish - there's nothing for a learner
// to see ahead of time, just an account that works or doesn't.
//
// Creating, editing and deleting one is users.manage, which only an admin
// holds. An instructor sees the list (GET /content) and can reset a trainee's
// progress, below, and nothing else.

router.post('/users', canManageUsers, async (req, res) => {
  const payload = req.body || {}
  const email = String(payload.email || '').trim().toLowerCase()
  const role = payload.role ?? 'TRAINEE'

  if (!email || !payload.fullName?.trim() || !payload.password) {
    return res.status(400).json({ error: 'Email, full name, and password are required' })
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Unknown role' })
  }
  if (payload.password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: `An account with email "${email}" already exists` })
  }

  const user = await prisma.user.create({
    data: {
      email,
      fullName: payload.fullName.trim(),
      role,
      passwordHash: await bcrypt.hash(payload.password, 10),
    },
  })
  res.json({ user: publicUser(user) })
})

// `password` is optional: omit it to leave the account's password unchanged.
router.patch('/users/:id', canManageUsers, async (req, res) => {
  const payload = req.body || {}
  const data = {}

  if (payload.fullName !== undefined) {
    if (!payload.fullName.trim()) return res.status(400).json({ error: 'Full name is required' })
    data.fullName = payload.fullName.trim()
  }
  if (payload.email !== undefined) {
    const email = String(payload.email).trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'Email is required' })
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== req.params.id) {
      return res.status(409).json({ error: `An account with email "${email}" already exists` })
    }
    data.email = email
  }
  if (payload.role !== undefined) {
    if (!ROLES.includes(payload.role)) {
      return res.status(400).json({ error: 'Unknown role' })
    }
    if (req.params.id === req.user.id && payload.role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' })
    }
    data.role = payload.role
  }
  if (payload.password) {
    if (payload.password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    data.passwordHash = await bcrypt.hash(payload.password, 10)
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data })
  res.json({ user: publicUser(user) })
})

// An admin cannot delete their own account - the dashboard they're using to
// do it would disappear out from under them.
router.delete('/users/:id', canManageUsers, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }

  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Clears what a learner has saved, so they start the training again. The
// account is untouched, and so are skill sign-offs (Phase 9): those are an
// instructor's judgement with their own trail, in their own table, not part of
// the progress document.
//
// The target has to be within the caller's reach: an instructor resets
// trainees, never an admin or another instructor. The reset bumps the
// snapshot's revision, which is what stops a browser the learner is still
// signed in on from writing its copy straight back (lib/progress.js).
router.post('/users/:id/progress/reset', canResetProgress, async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target) return res.status(404).json({ error: 'Record not found' })
  if (!canActOnRole(req.user, target.role)) {
    return res.status(403).json({ error: 'You do not have permission to reset this account' })
  }

  const snapshot = await resetProgress(target.id)
  res.json({ reset: true, revision: snapshot.revision })
})

router.post('/checklist-items', canEditContent, async (req, res) => {
  const payload = req.body || {}
  const module = payload.moduleId
    ? await prisma.module.findUnique({ where: { id: Number(payload.moduleId) } })
    : null

  if (!module) return res.status(400).json({ error: 'Unknown module' })
  if (!payload.text?.trim()) return res.status(400).json({ error: 'Checklist item text is required' })

  const last = await prisma.checklistItem.findFirst({
    where: { moduleId: module.id },
    orderBy: { sortOrder: 'desc' },
  })

  const item = await prisma.checklistItem.create({
    data: {
      id: `${module.slug}-check-${Date.now()}`,
      moduleId: module.id,
      text: payload.text.trim(),
      sortOrder: (last?.sortOrder || 0) + 1,
    },
  })
  res.json({ item })
})

router.patch('/checklist-items/:id', canEditContent, async (req, res) => {
  const item = await prisma.checklistItem.update({
    where: { id: req.params.id },
    data: pick(req.body, checklistFields),
  })
  res.json({ item })
})

router.delete('/checklist-items/:id', canEditContent, async (req, res) => {
  await prisma.checklistItem.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Quiz questions, module and parts alike - one table, one editor. A parts
// question has no module; a module question is scoped by `moduleId`.
router.post('/quiz-questions', canEditContent, async (req, res) => {
  const payload = req.body || {}
  if (!payload.prompt?.trim()) {
    return res.status(400).json({ error: 'Question prompt is required' })
  }

  const context = payload.context === 'parts' ? 'parts' : 'module'
  let moduleId = null

  if (context === 'module') {
    const module = payload.moduleId
      ? await prisma.module.findUnique({ where: { id: Number(payload.moduleId) } })
      : null
    if (!module) return res.status(400).json({ error: 'Unknown module' })
    moduleId = module.id
  }

  const last = await prisma.quizQuestion.findFirst({
    where: { context, ...(moduleId ? { moduleId } : {}) },
    orderBy: { sortOrder: 'desc' },
  })

  const question = await prisma.quizQuestion.create({
    data: {
      id: payload.id || `${context === 'parts' ? 'parts' : moduleId}-question-${Date.now()}`,
      context,
      moduleId,
      prompt: payload.prompt.trim(),
      answer: payload.answer || '',
      options: normalizeOptions(payload.options),
      sortOrder: (last?.sortOrder || 0) + 1,
    },
  })
  res.json({ question })
})

router.patch('/quiz-questions/:id', canEditContent, async (req, res) => {
  const data = pick(req.body, quizFields)
  if (req.body?.options) {
    data.options = normalizeOptions(req.body.options)
  }
  const question = await prisma.quizQuestion.update({
    where: { id: req.params.id },
    data,
  })
  res.json({ question })
})

router.delete('/quiz-questions/:id', canEditContent, async (req, res) => {
  await prisma.quizQuestion.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// --- Driving course editor -------------------------------------------------
// Courses are kept out of GET /content on purpose: the geometry blobs are large
// and only the Courses tab needs them.

router.get('/courses', canEditContent, async (req, res) => {
  const where = req.query.module ? { moduleSlug: req.query.module } : {}
  const rows = await prisma.course.findMany({ where, orderBy: [{ moduleSlug: 'asc' }, { sortOrder: 'asc' }] })
  res.json({ courses: rows.map(adminCourse), creatableKinds: CREATABLE_KINDS })
})

router.post('/courses', canEditContent, async (req, res) => {
  const payload = req.body || {}
  const moduleSlug = payload.moduleSlug
  const kind = payload.kind || 'driving'

  if (!(await isCourseCapableModuleSlug(moduleSlug))) {
    return res.status(400).json({ error: 'Unknown module' })
  }
  if (!CREATABLE_KINDS.includes(kind)) {
    return res.status(400).json({ error: `Steps of kind "${kind}" cannot be created here` })
  }
  if (!payload.title?.trim()) {
    return res.status(400).json({ error: 'Step title is required' })
  }

  // Briefing and summary ids are namespaced by module because every module has
  // one; driving ids stay bare because learner progress is keyed on them.
  const slug = slugify(payload.id || payload.title)
  const id = kind === 'driving' ? slug : `${moduleSlug}-${slug}`
  if (!slug) {
    return res.status(400).json({ error: 'Step id could not be derived from the title' })
  }
  if (await prisma.course.findUnique({ where: { id } })) {
    return res.status(409).json({ error: `A step with id "${id}" already exists` })
  }

  const last = await prisma.course.findFirst({ where: { moduleSlug }, orderBy: { sortOrder: 'desc' } })

  // Created unpublished: a new step is empty until the admin fills it in, so it
  // must not reach learners before the first publish.
  const course = await prisma.course.create({
    data: {
      id,
      moduleSlug,
      sortOrder: (last?.sortOrder || 0) + 1,
      kind,
      title: payload.title.trim(),
      objective: payload.objective || '',
      instructions: payload.instructions || '',
      hint: payload.hint || '',
      goalType: kind === 'driving' ? payload.goalType || 'checkpoints' : 'free',
      data:
        kind === 'driving'
          ? payload.data || emptyCourseGeometry()
          : kind === 'walk-around'
            ? payload.data || emptyWalkAroundData(payload.phase)
            : null,
      content: payload.content || emptyCourseContent(kind),
      published: false,
      builtIn: false,
    },
  })
  res.json({ course: adminCourse(course) })
})

// Saves an edit as a draft. Invalid drafts are allowed - work in progress is
// only blocked at publish time.
router.put('/courses/:id', canEditContent, async (req, res) => {
  const row = await prisma.course.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Course not found' })

  const draft = { ...editableCourse(row), ...pick(req.body, courseDraftFields) }
  const course = await prisma.course.update({
    where: { id: row.id },
    data: {
      draft,
      ...(typeof req.body?.sortOrder === 'number' ? { sortOrder: req.body.sortOrder } : {}),
    },
  })
  res.json({ course: adminCourse(course), problems: validateCoursePayload(row.kind, draft) })
})

router.post('/courses/:id/publish', canEditContent, async (req, res) => {
  const row = await prisma.course.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Course not found' })

  const payload = editableCourse(row)
  const problems = validateCoursePayload(row.kind, payload)
  if (problems.length) {
    return res.status(400).json({ error: 'Course cannot be published', problems })
  }

  const course = await prisma.course.update({
    where: { id: row.id },
    data: { ...payload, draft: null, published: true },
  })
  res.json({ course: adminCourse(course) })
})

// Throws the pending draft away, leaving the published version in place.
router.post('/courses/:id/revert', canEditContent, async (req, res) => {
  const course = await prisma.course.update({ where: { id: req.params.id }, data: { draft: null } })
  res.json({ course: adminCourse(course) })
})

// Built-in courses only: restores the seeded baseline and clears any draft.
router.post('/courses/:id/reset', canEditContent, async (req, res) => {
  const row = await prisma.course.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Course not found' })

  const defaults = defaultCourseFor(row.id)
  if (!row.builtIn || !defaults) {
    return res.status(400).json({ error: 'This course has no built-in default to reset to' })
  }

  const course = await prisma.course.update({
    where: { id: row.id },
    data: {
      kind: defaults.kind,
      title: defaults.title,
      objective: defaults.objective,
      instructions: defaults.instructions,
      hint: defaults.hint,
      goalType: defaults.goalType,
      data: defaults.data,
      content: defaults.content,
      draft: null,
      published: true,
    },
  })
  res.json({ course: adminCourse(course) })
})

// Whole-list reorder for one module; ids not in the list are left alone.
router.post('/courses/reorder', canEditContent, async (req, res) => {
  const { moduleSlug, ids } = req.body || {}
  if (!(await isCourseCapableModuleSlug(moduleSlug)) || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'moduleSlug and ids are required' })
  }

  // updateMany (not update) so an id that doesn't belong to this module is
  // silently skipped rather than renumbering another module's steps.
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.course.updateMany({ where: { id, moduleSlug }, data: { sortOrder: index + 1 } }),
    ),
  )

  const rows = await prisma.course.findMany({ where: { moduleSlug }, orderBy: { sortOrder: 'asc' } })
  res.json({ courses: rows.map(adminCourse) })
})

// Learner progress entries for a deleted step are left in place, not pruned, so
// re-adding the course restores completion (see lib/simulationProgress.js).
router.delete('/courses/:id', canEditContent, async (req, res) => {
  await prisma.course.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// --- Skills checklist -------------------------------------------------------
// The catalogue and its module links are content (content.edit) and save
// immediately, like modules. A learner's skills and their sign-offs are not:
// reading them is progress.view and signing one off or revoking it is
// skills.signoff, both within the caller's reach (an instructor's is
// trainees), the same rule as the progress reset.

// A skill payload's editable fields, checked. Returns { data } or { error }.
function skillData(payload, { creating = false } = {}) {
  const data = pick(payload, skillFields)

  if ('title' in data || creating) {
    data.title = String(data.title ?? '').trim()
    if (!data.title) return { error: 'Skill title is required' }
  }
  for (const key of ['description', 'tesdaRef']) {
    if (key in data) data[key] = String(data[key] ?? '').trim()
  }
  if ('category' in data && !isSkillCategory(data.category)) return { error: 'Unknown skill category' }
  if ('sortOrder' in data && !Number.isInteger(data.sortOrder)) return { error: 'sortOrder must be a whole number' }
  if ('evidence' in data) {
    const { evidence, problems } = normalizeEvidence(data.evidence)
    if (problems.length) return { error: 'Skill evidence is not valid', problems }
    data.evidence = evidence
  }
  return { data }
}

function refuse(res, { error, problems }) {
  return res.status(400).json(problems ? { error, problems } : { error })
}

router.get('/skills', canEditContent, async (req, res) => {
  res.json({ skills: await listSkills() })
})

// The id is the slugified title and is fixed at creation, because sign-offs
// reference it; a clash is refused rather than renamed.
router.post('/skills', canEditContent, async (req, res) => {
  const payload = req.body || {}
  const checked = skillData({ category: 'knowledge', evidence: [], ...payload }, { creating: true })
  if (checked.error) return refuse(res, checked)

  const id = slugify(payload.id || checked.data.title)
  if (!id) return res.status(400).json({ error: 'Skill id could not be derived from the title' })
  if (await prisma.skill.findUnique({ where: { id } })) {
    return res.status(409).json({ error: `A skill with id "${id}" already exists` })
  }

  const last = await prisma.skill.findFirst({ orderBy: { sortOrder: 'desc' } })
  await prisma.skill.create({
    data: { ...checked.data, id, sortOrder: (last?.sortOrder || 0) + 1, builtIn: false },
  })
  res.json({ skill: await findSkill(id) })
})

// Whole-list reorder; ids not in the list are left alone.
router.post('/skills/reorder', canEditContent, async (req, res) => {
  const { ids } = req.body || {}
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids is required' })
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.skill.updateMany({ where: { id: String(id) }, data: { sortOrder: index + 1 } })),
  )
  res.json({ skills: await listSkills() })
})

router.patch('/skills/:id', canEditContent, async (req, res) => {
  const checked = skillData(req.body || {})
  if (checked.error) return refuse(res, checked)

  await prisma.skill.update({ where: { id: req.params.id }, data: checked.data })
  res.json({ skill: await findSkill(req.params.id) })
})

// Built-in skills only: restores the stock wording and evidence
// (data/skillDefaults.js). Its place in the list and its module links stay.
router.post('/skills/:id/reset', canEditContent, async (req, res) => {
  const row = await prisma.skill.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Skill not found' })

  const defaults = defaultSkillFor(row.id)
  if (!row.builtIn || !defaults) {
    return res.status(400).json({ error: 'This skill has no built-in default to reset to' })
  }

  const { id: _id, sortOrder: _sortOrder, ...data } = defaults
  await prisma.skill.update({ where: { id: row.id }, data })
  res.json({ skill: await findSkill(row.id) })
})

// A skill that has been signed off or revoked for anyone keeps its trail, so
// it cannot be deleted (the foreign key is Restrict as well); its module links
// go with it.
router.delete('/skills/:id', canEditContent, async (req, res) => {
  const events = await prisma.skillSignoffEvent.count({ where: { skillId: req.params.id } })
  if (events) {
    return res.status(409).json({ error: `This skill has ${events} sign-off record(s) and cannot be deleted` })
  }

  await prisma.skill.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Replaces one module's skill links: { links: [{ skillId, relation }] }, each
// skill at most once, relation 'teaches' or 'requires'.
router.put('/modules/:id/skills', canEditContent, async (req, res) => {
  const module = await prisma.module.findUnique({ where: { id: Number(req.params.id) } })
  if (!module) return res.status(404).json({ error: 'Record not found' })

  const links = req.body?.links
  if (!Array.isArray(links)) return res.status(400).json({ error: 'links is required' })
  if (links.some((link) => !SKILL_RELATIONS.includes(link?.relation) || typeof link?.skillId !== 'string')) {
    return res.status(400).json({ error: 'Each link needs a skill and a relation of teaches or requires' })
  }
  const skillIds = links.map((link) => link.skillId)
  if (new Set(skillIds).size !== skillIds.length) {
    return res.status(400).json({ error: 'A skill can be linked to a module once' })
  }
  if ((await prisma.skill.count({ where: { id: { in: skillIds } } })) !== skillIds.length) {
    return res.status(400).json({ error: 'Unknown skill' })
  }

  await prisma.$transaction([
    prisma.moduleSkill.deleteMany({ where: { moduleId: module.id } }),
    prisma.moduleSkill.createMany({
      data: links.map((link) => ({ moduleId: module.id, skillId: link.skillId, relation: link.relation })),
    }),
  ])
  res.json({ skills: await listSkills() })
})

// The learner an instructor or admin is acting on, when within their reach.
// Answers the request itself and returns null otherwise.
async function learnerWithinReach(req, res) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target) {
    res.status(404).json({ error: 'Record not found' })
    return null
  }
  if (!canActOnRole(req.user, target.role)) {
    res.status(403).json({ error: 'You do not have permission to see this account' })
    return null
  }
  return target
}

// One learner's skills: the catalogue, per skill the evidence and the current
// sign-off, and the whole trail, newest first, notes included.
router.get('/users/:id/skills', canViewProgress, async (req, res) => {
  const target = await learnerWithinReach(req, res)
  if (!target) return

  const { skills, results, events } = await evaluateUserSkills(target.id)
  res.json({ user: publicUser(target), skills, results: staffResults(results), history: events.map(historyEvent) })
})

const NOTE_LIMIT = 1000

// Signing off and revoking insert one event each and never change or remove
// one. Nobody signs off their own skills, whatever their role. A sign-off on
// evidence not yet demonstrated is allowed (the instructor may have seen the
// skill in hands-on training, decided 2026-10-01) but needs a note saying why;
// a revoke always needs one. The evidence status at that moment is recorded
// with the event.
function signoffRoute(action) {
  return async (req, res) => {
    const target = await learnerWithinReach(req, res)
    if (!target) return
    if (target.id === req.user.id) {
      return res.status(403).json({ error: 'You cannot sign off your own skills' })
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : ''
    if (note.length > NOTE_LIMIT) {
      return res.status(400).json({ error: `The note is too long (${NOTE_LIMIT} characters at most)` })
    }

    const { results } = await evaluateUserSkills(target.id)
    const result = results.find((entry) => entry.skillId === req.params.skillId)
    if (!result) return res.status(404).json({ error: 'Skill not found' })

    const signedOff = result.status === 'signed-off'
    if (action === 'signoff' && signedOff) return res.status(409).json({ error: 'This skill is already signed off' })
    if (action === 'revoke' && !signedOff) return res.status(409).json({ error: 'This skill is not signed off' })
    if (action === 'revoke' && !note) return res.status(400).json({ error: 'A revoke needs a note saying why' })
    if (action === 'signoff' && result.evidenceStatus !== 'demonstrated' && !note) {
      return res.status(400).json({ error: 'The evidence is not complete yet: add a note saying why you are signing it off' })
    }

    const event = await recordSignoffEvent({
      userId: target.id,
      skillId: result.skillId,
      actor: req.user,
      action,
      note,
      evidenceStatus: result.evidenceStatus,
    })
    res.json({ event: historyEvent(event) })
  }
}

router.post('/users/:id/skills/:skillId/signoff', canSignOffSkills, signoffRoute('signoff'))
router.post('/users/:id/skills/:skillId/revoke', canSignOffSkills, signoffRoute('revoke'))

export default router
