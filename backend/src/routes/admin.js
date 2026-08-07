import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { publicUser, requireAdmin, requireAuth } from '../lib/auth.js'
import { buildAdminProgressReport } from '../lib/progressSummary.js'
import {
  adminCourse,
  bespokeStepIds,
  courseDraftFields,
  defaultCourseFor,
  editableCourse,
  emptyCourseGeometry,
  validateCoursePayload,
} from '../lib/courses.js'
import { courseModuleSlugs } from '../../../frontend/src/data/courseDefaults.js'

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

const partFields = ['label', 'category', 'position', 'functionText', 'inspectionReminder', 'safetyNote', 'relatedModule', 'checklist', 'sortOrder']
const partDetailFields = ['title', 'subtitle', 'image', 'description']
const moduleFields = ['title', 'subtitle', 'description', 'imageUrl', 'sortOrder']
const equipmentFields = ['title', 'description', 'modelUrl', 'imageUrl', 'sortOrder']
const checklistFields = ['text', 'sortOrder']

function quizOptions(questionId, options = []) {
  return options.map((option, index) => ({
    id: `${questionId}-option-${index + 1}`,
    text: typeof option === 'string' ? option : option.text,
    sortOrder: index + 1,
  }))
}

router.get('/content', async (req, res) => {
  const [equipment, modules, parts, partDetails, checklists, quizQuestions, users, snapshots] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.module.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.part.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.partDetail.findMany(),
    prisma.checklistItem.findMany({ orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.quizQuestion.findMany({ orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] }),
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

router.patch('/parts/:id', async (req, res) => {
  const part = await prisma.part.update({
    where: { id: req.params.id },
    data: pick(req.body, partFields),
  })
  res.json({ part })
})

router.delete('/parts/:id', async (req, res) => {
  await prisma.part.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// Upsert, because detail entries can be edited for hotspots that were never
// seeded (for example a part the admin just created).
router.patch('/part-details/:id', async (req, res) => {
  const data = pick(req.body, partDetailFields)
  const detail = await prisma.partDetail.upsert({
    where: { id: req.params.id },
    update: data,
    create: { id: req.params.id, title: data.title || req.params.id, ...data },
  })
  res.json({ detail })
})

router.patch('/equipment/:id', async (req, res) => {
  const equipment = await prisma.equipment.update({
    where: { id: req.params.id },
    data: pick(req.body, equipmentFields),
  })
  res.json({ equipment })
})

router.patch('/modules/:id', async (req, res) => {
  const module = await prisma.module.update({
    where: { id: Number(req.params.id) },
    data: pick(req.body, moduleFields),
  })
  res.json({ module })
})

router.delete('/modules/:id', async (req, res) => {
  await prisma.module.delete({ where: { id: Number(req.params.id) } })
  res.json({ deleted: true })
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

router.patch('/quiz-questions/:id', async (req, res) => {
  const data = pick(req.body, ['prompt', 'answer', 'sortOrder'])
  if (req.body?.options) {
    data.options = quizOptions(req.params.id, req.body.options)
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
  res.json({
    courses: rows.map(adminCourse),
    // So the dashboard can show where admin-created steps will slot in, and
    // refuse ids that would shadow a hardcoded step.
    bespokeSteps: Object.fromEntries(
      courseModuleSlugs.map((moduleSlug) => [moduleSlug, bespokeStepIds(moduleSlug)]),
    ),
  })
})

router.post('/courses', async (req, res) => {
  const payload = req.body || {}
  const moduleSlug = payload.moduleSlug

  if (!courseModuleSlugs.includes(moduleSlug)) {
    return res.status(400).json({ error: 'Unknown module' })
  }
  if (!payload.title?.trim()) {
    return res.status(400).json({ error: 'Course title is required' })
  }

  const id = (payload.id || payload.title).trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!id) {
    return res.status(400).json({ error: 'Course id could not be derived from the title' })
  }
  if (bespokeStepIds(moduleSlug).includes(id)) {
    return res.status(409).json({ error: `"${id}" is a built-in step of this module` })
  }
  if (await prisma.course.findUnique({ where: { id } })) {
    return res.status(409).json({ error: `A course with id "${id}" already exists` })
  }

  const last = await prisma.course.findFirst({ where: { moduleSlug }, orderBy: { sortOrder: 'desc' } })

  // Created unpublished: the geometry is empty until the admin places markers,
  // so it must not reach learners before the first publish.
  const course = await prisma.course.create({
    data: {
      id,
      moduleSlug,
      sortOrder: (last?.sortOrder || 0) + 1,
      title: payload.title.trim(),
      objective: payload.objective || '',
      instructions: payload.instructions || '',
      hint: payload.hint || '',
      goalType: payload.goalType || 'checkpoints',
      data: payload.data || emptyCourseGeometry(),
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
  res.json({ course: adminCourse(course), problems: validateCoursePayload(draft) })
})

router.post('/courses/:id/publish', async (req, res) => {
  const row = await prisma.course.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Course not found' })

  const payload = editableCourse(row)
  const problems = validateCoursePayload(payload)
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
      title: defaults.title,
      objective: defaults.objective,
      instructions: defaults.instructions,
      hint: defaults.hint,
      goalType: defaults.goalType,
      data: defaults.data,
      draft: null,
      published: true,
    },
  })
  res.json({ course: adminCourse(course) })
})

// Whole-list reorder for one module; ids not in the list are left alone.
router.post('/courses/reorder', async (req, res) => {
  const { moduleSlug, ids } = req.body || {}
  if (!courseModuleSlugs.includes(moduleSlug) || !Array.isArray(ids)) {
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

export default router
