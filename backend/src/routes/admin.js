import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { publicUser, requireAdmin, requireAuth } from '../lib/auth.js'
import { buildAdminProgressReport } from '../lib/progressSummary.js'
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
  adminHotspot,
  defaultHotspotFor,
  editableHotspot,
  hotspotDraftFields,
} from '../lib/walkAroundHotspots.js'
import {
  adminEquipmentHotspot,
  editableEquipmentHotspot,
  hotspotDraftFields as equipmentHotspotDraftFields,
} from '../lib/equipmentHotspots.js'

const router = Router()

router.use(requireAuth, requireAdmin)

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
// this is just "does the module exist" - DB-driven so a module created for a
// new equipment is immediately usable.
async function isCourseCapableModuleSlug(moduleSlug) {
  if (!moduleSlug) return false
  const module = await prisma.module.findUnique({ where: { slug: moduleSlug } })
  return Boolean(module)
}

const partFields = ['label', 'category', 'position', 'functionText', 'inspectionReminder', 'safetyNote', 'relatedModule', 'checklist', 'sortOrder']
const partDetailFields = ['title', 'subtitle', 'image', 'description']
const moduleFields = ['title', 'fullTitle', 'subtitle', 'description', 'imageUrl', 'sortOrder']
// `content` is the hub/module-list copy overrides (frontend
// data/hubContent.js); it is stored whole, so the client sends the full object
// and blank keys mean "fall back to the coded default".
const equipmentFields = ['title', 'description', 'modelUrl', 'imageUrl', 'sortOrder', 'available', 'content', 'simConfig']
const checklistFields = ['text', 'sortOrder']
const quizFields = ['prompt', 'options', 'answer', 'sortOrder']
const partCategoryFields = ['label', 'sortOrder']

// Parts and part details follow the same rule as courses:
// the columns are what learners see and `draft` is the admin's pending edit as
// a whole payload. A draft merges over whatever is already pending, so editing
// one field twice never discards the other.
function mergedDraft(row, payload, fields) {
  return { ...(row.draft || pick(row, fields)), ...pick(payload, fields) }
}

function publishedFrom(row, fields) {
  if (!row?.draft) return null
  return { ...pick(row.draft, fields), draft: null }
}

// Options are stored as plain strings (`answer` is one of them). Rows written
// before the practice/quiz merge held { id, text, sortOrder } objects, so an
// editor still holding one of those is flattened rather than rejected.
function normalizeOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((option) => (typeof option === 'string' ? option : option?.text || ''))
    .filter(Boolean)
}

router.get('/content', async (req, res) => {
  const [
    equipment,
    modules,
    parts,
    partDetails,
    partCategories,
    checklists,
    quizQuestions,
    users,
    snapshots,
  ] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.module.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.part.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.partDetail.findMany(),
    prisma.partCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.checklistItem.findMany({ orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.quizQuestion.findMany({ orderBy: [{ equipmentId: 'asc' }, { context: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.progressSnapshot.findMany({ include: { user: true } }),
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
    localOnly: false,
    equipment,
    modules,
    parts,
    partDetails: Object.fromEntries(partDetails.map((detail) => [detail.id, detail])),
    partCategories,
    checklists,
    quizQuestions,
    users: users.map(publicUser),
    progress,
    activityLogs,
  })
})

router.post('/parts', async (req, res) => {
  const payload = req.body || {}
  if (!payload.label) {
    return res.status(400).json({ error: 'Part label is required' })
  }

  const part = await prisma.part.create({
    data: {
      id: payload.id || payload.label.toLowerCase().replaceAll(' ', '-'),
      position: payload.position || [0, 0, 0],
      checklist: payload.checklist || [],
      ...pick(payload, partFields),
      label: payload.label,
    },
  })
  res.json({ part })
})

// Saves a draft rather than writing the published columns; learners keep
// seeing the current part until Publish.
router.patch('/parts/:id', async (req, res) => {
  const current = await prisma.part.findUnique({ where: { id: req.params.id } })
  if (!current) return res.status(404).json({ error: 'Record not found' })

  const part = await prisma.part.update({
    where: { id: req.params.id },
    data: { draft: mergedDraft(current, req.body, partFields) },
  })
  res.json({ part })
})

router.post('/parts/:id/publish', async (req, res) => {
  const current = await prisma.part.findUnique({ where: { id: req.params.id } })
  const data = publishedFrom(current, partFields)
  if (!data) return res.status(400).json({ error: 'There is no draft to publish' })

  const part = await prisma.part.update({ where: { id: req.params.id }, data })
  res.json({ part })
})

router.post('/parts/:id/revert', async (req, res) => {
  const part = await prisma.part.update({ where: { id: req.params.id }, data: { draft: null } })
  res.json({ part })
})

router.delete('/parts/:id', async (req, res) => {
  await prisma.part.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Upsert, because detail entries can be edited for hotspots that were never
// seeded (for example a part the admin just created). A row created here starts
// with its draft already filled in, so nothing reaches learners until Publish.
router.patch('/part-details/:id', async (req, res) => {
  const current = await prisma.partDetail.findUnique({ where: { id: req.params.id } })
  const draft = mergedDraft(current || {}, req.body, partDetailFields)

  const detail = await prisma.partDetail.upsert({
    where: { id: req.params.id },
    update: { draft },
    create: { id: req.params.id, title: '', draft },
  })
  res.json({ detail })
})

router.post('/part-details/:id/publish', async (req, res) => {
  const current = await prisma.partDetail.findUnique({ where: { id: req.params.id } })
  const data = publishedFrom(current, partDetailFields)
  if (!data) return res.status(400).json({ error: 'There is no draft to publish' })

  const detail = await prisma.partDetail.update({ where: { id: req.params.id }, data })
  res.json({ detail })
})

router.post('/part-details/:id/revert', async (req, res) => {
  const detail = await prisma.partDetail.update({ where: { id: req.params.id }, data: { draft: null } })
  res.json({ detail })
})

// Category rows are a short list of labels with no learner-visible body text,
// so they save immediately rather than through a draft.
router.post('/part-categories', async (req, res) => {
  const payload = req.body || {}
  if (!payload.label) {
    return res.status(400).json({ error: 'Category label is required' })
  }

  const last = await prisma.partCategory.findFirst({ orderBy: { sortOrder: 'desc' } })
  const category = await prisma.partCategory.create({
    data: {
      id: payload.id || payload.label,
      label: payload.label,
      sortOrder: (last?.sortOrder || 0) + 1,
    },
  })
  res.json({ category })
})

router.patch('/part-categories/:id', async (req, res) => {
  const category = await prisma.partCategory.update({
    where: { id: req.params.id },
    data: pick(req.body, partCategoryFields),
  })
  res.json({ category })
})

router.delete('/part-categories/:id', async (req, res) => {
  const inUse = await prisma.part.count({ where: { category: req.params.id } })
  if (inUse) {
    return res.status(400).json({ error: `${inUse} part(s) still use this category` })
  }

  await prisma.partCategory.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Equipment rows are content too: an admin can add one and build its modules,
// hotspots and quizzes without a code change or a seed edit.
router.post('/equipment', async (req, res) => {
  const payload = req.body || {}
  const title = String(payload.title || '').trim()
  if (!title) return res.status(400).json({ error: 'Equipment title is required' })

  const idBase = String(payload.id || title)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  let id = idBase || 'equipment'
  let suffix = 2
  while (await prisma.equipment.findUnique({ where: { id } })) {
    id = `${idBase}-${suffix++}`
  }

  const last = await prisma.equipment.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })
  const equipment = await prisma.equipment.create({
    data: {
      id,
      title,
      description: payload.description || '',
      modelUrl: payload.modelUrl || '',
      imageUrl: payload.imageUrl || '',
      sortOrder: (last?.sortOrder || 0) + 1,
      // New equipment starts hidden: the catalogue card stays "Coming Soon"
      // until an admin has given it content and ticked Available.
      available: payload.available === true,
    },
  })
  res.json({ equipment })
})

// Refused while the equipment still owns content, so deleting one is never a
// silent cascade through a learner's modules.
router.delete('/equipment/:id', async (req, res) => {
  const [modules, hotspots, quizQuestions] = await Promise.all([
    prisma.module.count({ where: { equipmentId: req.params.id } }),
    prisma.equipmentHotspot.count({ where: { equipmentId: req.params.id } }),
    prisma.quizQuestion.count({ where: { equipmentId: req.params.id } }),
  ])

  if (modules || hotspots || quizQuestions) {
    return res.status(400).json({
      error: `Delete this equipment's content first: ${modules} module(s), ${hotspots} hotspot(s), ${quizQuestions} quiz question(s).`,
    })
  }

  await prisma.equipment.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

router.patch('/equipment/:id', async (req, res) => {
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

  const equipment = await prisma.equipment.update({ where: { id: req.params.id }, data })
  res.json({ equipment })
})

// A module created here starts with one briefing step, so the Module Editor
// (and the learner page) has something to show instead of an empty shell -
// the same shape prisma/seed.js gives a new equipment's starter module.
router.post('/modules', async (req, res) => {
  const payload = req.body || {}
  const title = String(payload.title || '').trim()
  const equipmentId = payload.equipmentId

  if (!title) return res.status(400).json({ error: 'Module title is required' })
  if (!equipmentId) return res.status(400).json({ error: 'equipmentId is required' })
  if (!(await prisma.equipment.findUnique({ where: { id: equipmentId } }))) {
    return res.status(400).json({ error: 'Unknown equipment' })
  }

  const slugBase = `${equipmentId}-${title}`
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  let slug = slugBase || `${equipmentId}-module`
  let suffix = 2
  while (await prisma.module.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${suffix++}`
  }

  // Module.id is a plain Int (it mirrors the seeded module numbering rather
  // than being generated), so a new row takes the next one.
  const [lastId, lastOrder] = await Promise.all([
    prisma.module.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }),
    prisma.module.findFirst({ where: { equipmentId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }),
  ])

  const module = await prisma.module.create({
    data: {
      id: (lastId?.id || 0) + 1,
      slug,
      equipmentId,
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

// Whole-list reorder for one equipment's modules; ids not in the list are
// left alone. Mirrors /courses/reorder.
router.post('/modules/reorder', async (req, res) => {
  const { equipmentId, ids } = req.body || {}
  if (!equipmentId || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'equipmentId and ids are required' })
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.module.update({ where: { id: Number(id) }, data: { sortOrder: index + 1 } }),
    ),
  )

  const modules = await prisma.module.findMany({ where: { equipmentId }, orderBy: { sortOrder: 'asc' } })
  res.json({ modules })
})

router.patch('/modules/:id', async (req, res) => {
  const module = await prisma.module.update({
    where: { id: Number(req.params.id) },
    data: pick(req.body, moduleFields),
  })
  res.json({ module })
})

// ChecklistItem and QuizQuestion cascade with the FK; Course rows reference the
// module by slug rather than by relation, so they are removed here.
router.delete('/modules/:id', async (req, res) => {
  const module = await prisma.module.findUnique({ where: { id: Number(req.params.id) } })
  if (!module) return res.status(404).json({ error: 'Record not found' })

  await prisma.course.deleteMany({ where: { moduleSlug: module.slug } })
  await prisma.module.delete({ where: { id: module.id } })
  res.json({ deleted: true })
})

// --- Users ------------------------------------------------------------------
// Learner/admin accounts save immediately, no draft/publish - there's nothing
// for a learner to see ahead of time, just an account that works or doesn't.

router.post('/users', async (req, res) => {
  const payload = req.body || {}
  const email = String(payload.email || '').trim().toLowerCase()
  const role = payload.role === 'ADMIN' ? 'ADMIN' : 'TRAINEE'

  if (!email || !payload.fullName?.trim() || !payload.password) {
    return res.status(400).json({ error: 'Email, full name, and password are required' })
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
router.patch('/users/:id', async (req, res) => {
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
    const role = payload.role === 'ADMIN' ? 'ADMIN' : 'TRAINEE'
    if (req.params.id === req.user.id && role !== 'ADMIN') {
      return res.status(400).json({ error: 'You cannot change your own role' })
    }
    data.role = role
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
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }

  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

router.post('/checklist-items', async (req, res) => {
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

router.patch('/checklist-items/:id', async (req, res) => {
  const item = await prisma.checklistItem.update({
    where: { id: req.params.id },
    data: pick(req.body, checklistFields),
  })
  res.json({ item })
})

router.delete('/checklist-items/:id', async (req, res) => {
  await prisma.checklistItem.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Quiz questions, module and parts alike - one table, one editor. A parts
// question carries `equipmentId` and no module; a module question is scoped by
// `moduleId` and inherits that module's equipment.
router.post('/quiz-questions', async (req, res) => {
  const payload = req.body || {}
  if (!payload.prompt?.trim()) {
    return res.status(400).json({ error: 'Question prompt is required' })
  }

  const context = payload.context === 'parts' ? 'parts' : 'module'
  let equipmentId = payload.equipmentId
  let moduleId = null

  if (context === 'module') {
    const module = payload.moduleId
      ? await prisma.module.findUnique({ where: { id: Number(payload.moduleId) } })
      : null
    if (!module) return res.status(400).json({ error: 'Unknown module' })
    moduleId = module.id
    equipmentId = module.equipmentId
  } else if (!equipmentId) {
    return res.status(400).json({ error: 'equipmentId is required for a parts quiz question' })
  }

  const last = await prisma.quizQuestion.findFirst({
    where: { context, ...(moduleId ? { moduleId } : { equipmentId }) },
    orderBy: { sortOrder: 'desc' },
  })

  const question = await prisma.quizQuestion.create({
    data: {
      id: payload.id || `${context === 'parts' ? `${equipmentId}-parts` : moduleId}-question-${Date.now()}`,
      equipmentId,
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

router.patch('/quiz-questions/:id', async (req, res) => {
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

router.delete('/quiz-questions/:id', async (req, res) => {
  await prisma.quizQuestion.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// --- Driving course editor -------------------------------------------------
// Courses are kept out of GET /content on purpose: the geometry blobs are large
// and only the Courses tab needs them.

router.get('/courses', async (req, res) => {
  const rows = await prisma.course.findMany({ orderBy: [{ moduleSlug: 'asc' }, { sortOrder: 'asc' }] })
  res.json({ courses: rows.map(adminCourse), creatableKinds: CREATABLE_KINDS })
})

router.post('/courses', async (req, res) => {
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
  const slug = (payload.id || payload.title).trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
router.put('/courses/:id', async (req, res) => {
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

router.post('/courses/:id/publish', async (req, res) => {
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
router.post('/courses/:id/revert', async (req, res) => {
  const course = await prisma.course.update({ where: { id: req.params.id }, data: { draft: null } })
  res.json({ course: adminCourse(course) })
})

// Built-in courses only: restores the seeded baseline and clears any draft.
router.post('/courses/:id/reset', async (req, res) => {
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
router.post('/courses/reorder', async (req, res) => {
  const { moduleSlug, ids } = req.body || {}
  if (!(await isCourseCapableModuleSlug(moduleSlug)) || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'moduleSlug and ids are required' })
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.course.update({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  )

  const rows = await prisma.course.findMany({ where: { moduleSlug }, orderBy: { sortOrder: 'asc' } })
  res.json({ courses: rows.map(adminCourse) })
})

// Learner progress entries for a deleted step are left in place, not pruned, so
// re-adding the course restores completion (see lib/simulationProgress.js).
router.delete('/courses/:id', async (req, res) => {
  await prisma.course.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// --- Walk-around hotspot editor --------------------------------------------
// Module 1's 3D inspection hotspots, placed/dragged on the model in the admin
// dashboard. Same draft/publish/builtIn shape as courses, above.

router.get('/walkaround-hotspots', async (req, res) => {
  const rows = await prisma.walkAroundHotspot.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json({ hotspots: rows.map(adminHotspot) })
})

router.post('/walkaround-hotspots', async (req, res) => {
  const payload = req.body || {}
  if (!payload.label?.trim()) {
    return res.status(400).json({ error: 'Hotspot label is required' })
  }

  const id = (payload.id || payload.label).trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!id) {
    return res.status(400).json({ error: 'Hotspot id could not be derived from the label' })
  }
  if (await prisma.walkAroundHotspot.findUnique({ where: { id } })) {
    return res.status(409).json({ error: `A hotspot with id "${id}" already exists` })
  }

  const last = await prisma.walkAroundHotspot.findFirst({ orderBy: { sortOrder: 'desc' } })

  // Created unpublished: a new hotspot has no position worth showing a learner
  // until the admin places it, so it must not reach them before first publish.
  const hotspot = await prisma.walkAroundHotspot.create({
    data: {
      id,
      label: payload.label.trim(),
      position: payload.position || [0, 0.3, 0],
      state: payload.state || 'engine-off',
      category: payload.category || '',
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
router.put('/walkaround-hotspots/:id', async (req, res) => {
  const row = await prisma.walkAroundHotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })

  const draft = { ...editableHotspot(row), ...pick(req.body, hotspotDraftFields) }
  const hotspot = await prisma.walkAroundHotspot.update({
    where: { id: row.id },
    data: {
      draft,
      ...(typeof req.body?.sortOrder === 'number' ? { sortOrder: req.body.sortOrder } : {}),
    },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

router.post('/walkaround-hotspots/:id/publish', async (req, res) => {
  const row = await prisma.walkAroundHotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })
  if (!row.draft) return res.status(400).json({ error: 'There is no draft to publish' })

  const hotspot = await prisma.walkAroundHotspot.update({
    where: { id: row.id },
    data: { ...pick(row.draft, hotspotDraftFields), draft: null, published: true },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

router.post('/walkaround-hotspots/:id/revert', async (req, res) => {
  const hotspot = await prisma.walkAroundHotspot.update({
    where: { id: req.params.id },
    data: { draft: null },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

// Built-in hotspots only: restores the seeded position/text and clears any draft.
router.post('/walkaround-hotspots/:id/reset', async (req, res) => {
  const row = await prisma.walkAroundHotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })

  const defaults = defaultHotspotFor(row.id)
  if (!row.builtIn || !defaults) {
    return res.status(400).json({ error: 'This hotspot has no built-in default to reset to' })
  }

  const hotspot = await prisma.walkAroundHotspot.update({
    where: { id: row.id },
    data: {
      label: defaults.label,
      position: defaults.position,
      state: defaults.state,
      category: defaults.category,
      inspect: defaults.inspect,
      safeFeedback: defaults.safeFeedback,
      unsafeFeedback: defaults.unsafeFeedback,
      unsafeScenarios: defaults.unsafeScenarios || [],
      draft: null,
      published: true,
    },
  })
  res.json({ hotspot: adminHotspot(hotspot) })
})

// Whole-list reorder; ids not in the list are left alone.
router.post('/walkaround-hotspots/reorder', async (req, res) => {
  const { ids } = req.body || {}
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids is required' })
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.walkAroundHotspot.update({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  )

  const rows = await prisma.walkAroundHotspot.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json({ hotspots: rows.map(adminHotspot) })
})

router.delete('/walkaround-hotspots/:id', async (req, res) => {
  await prisma.walkAroundHotspot.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// --- Equipment hotspot editor -----------------------------------------------
// The generic per-equipment hotspot system (Hotspot Identification page) that
// any equipment other than Forklift uses instead of the Parts/PartDetail and
// WalkAroundHotspot tables above. `?equipment=` scopes list/reorder to one
// equipment; creation requires it in the body so a new row always belongs to
// exactly one equipment.

router.get('/equipment-hotspots', async (req, res) => {
  const where = req.query.equipment ? { equipmentId: req.query.equipment } : {}
  const rows = await prisma.equipmentHotspot.findMany({ where, orderBy: { sortOrder: 'asc' } })
  res.json({ hotspots: rows.map(adminEquipmentHotspot) })
})

router.post('/equipment-hotspots', async (req, res) => {
  const payload = req.body || {}
  if (!payload.equipmentId) {
    return res.status(400).json({ error: 'equipmentId is required' })
  }
  if (!payload.label?.trim()) {
    return res.status(400).json({ error: 'Hotspot label is required' })
  }

  const id = `${payload.equipmentId}-${(payload.id || payload.label).trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  if (await prisma.equipmentHotspot.findUnique({ where: { id } })) {
    return res.status(409).json({ error: `A hotspot with id "${id}" already exists` })
  }

  const last = await prisma.equipmentHotspot.findFirst({
    where: { equipmentId: payload.equipmentId },
    orderBy: { sortOrder: 'desc' },
  })

  // Created unpublished: a new hotspot has no position worth showing a learner
  // until the admin places it, so it must not reach them before first publish.
  const hotspot = await prisma.equipmentHotspot.create({
    data: {
      id,
      equipmentId: payload.equipmentId,
      label: payload.label.trim(),
      position: payload.position || [0, 0.3, 0],
      category: payload.category || '',
      description: payload.description || '',
      sortOrder: (last?.sortOrder || 0) + 1,
      published: false,
    },
  })
  res.json({ hotspot: adminEquipmentHotspot(hotspot) })
})

// Saves an edit as a draft; learners keep seeing the published position/text
// until Publish.
router.put('/equipment-hotspots/:id', async (req, res) => {
  const row = await prisma.equipmentHotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })

  const draft = { ...editableEquipmentHotspot(row), ...pick(req.body, equipmentHotspotDraftFields) }
  const hotspot = await prisma.equipmentHotspot.update({
    where: { id: row.id },
    data: {
      draft,
      ...(typeof req.body?.sortOrder === 'number' ? { sortOrder: req.body.sortOrder } : {}),
    },
  })
  res.json({ hotspot: adminEquipmentHotspot(hotspot) })
})

router.post('/equipment-hotspots/:id/publish', async (req, res) => {
  const row = await prisma.equipmentHotspot.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Hotspot not found' })
  if (!row.draft) return res.status(400).json({ error: 'There is no draft to publish' })

  const hotspot = await prisma.equipmentHotspot.update({
    where: { id: row.id },
    data: { ...pick(row.draft, equipmentHotspotDraftFields), draft: null, published: true },
  })
  res.json({ hotspot: adminEquipmentHotspot(hotspot) })
})

router.post('/equipment-hotspots/:id/revert', async (req, res) => {
  const hotspot = await prisma.equipmentHotspot.update({
    where: { id: req.params.id },
    data: { draft: null },
  })
  res.json({ hotspot: adminEquipmentHotspot(hotspot) })
})

// Whole-list reorder for one equipment; ids not in the list are left alone.
router.post('/equipment-hotspots/reorder', async (req, res) => {
  const { equipmentId, ids } = req.body || {}
  if (!equipmentId || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'equipmentId and ids are required' })
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.equipmentHotspot.update({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  )

  const rows = await prisma.equipmentHotspot.findMany({ where: { equipmentId }, orderBy: { sortOrder: 'asc' } })
  res.json({ hotspots: rows.map(adminEquipmentHotspot) })
})

router.delete('/equipment-hotspots/:id', async (req, res) => {
  await prisma.equipmentHotspot.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

export default router
