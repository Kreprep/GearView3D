import { Router } from 'express'
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
const moduleFields = ['title', 'fullTitle', 'subtitle', 'description', 'imageUrl', 'sortOrder']
const equipmentFields = ['title', 'description', 'modelUrl', 'imageUrl', 'sortOrder', 'available']
const checklistFields = ['text', 'sortOrder']
const practiceFields = ['prompt', 'options', 'answer', 'sortOrder']
const partCategoryFields = ['label', 'sortOrder']

// Parts, part details and practice questions follow the same rule as courses:
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

function quizOptions(questionId, options = []) {
  return options.map((option, index) => ({
    id: `${questionId}-option-${index + 1}`,
    text: typeof option === 'string' ? option : option.text,
    sortOrder: index + 1,
  }))
}

router.get('/content', async (req, res) => {
  const [
    equipment,
    modules,
    parts,
    partDetails,
    partCategories,
    practiceQuestions,
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
    prisma.practiceQuestion.findMany({ orderBy: { sortOrder: 'asc' } }),
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
    partCategories,
    practiceQuestions,
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

// Parts Identification practice quiz. Same draft/publish rule as parts.
router.post('/practice-questions', async (req, res) => {
  const payload = req.body || {}
  if (!payload.prompt) {
    return res.status(400).json({ error: 'Question prompt is required' })
  }

  const last = await prisma.practiceQuestion.findFirst({ orderBy: { sortOrder: 'desc' } })
  const question = await prisma.practiceQuestion.create({
    data: {
      id: payload.id || `question-${Date.now()}`,
      prompt: payload.prompt,
      options: payload.options || [],
      answer: payload.answer || '',
      sortOrder: (last?.sortOrder || 0) + 1,
    },
  })
  res.json({ question })
})

router.patch('/practice-questions/:id', async (req, res) => {
  const current = await prisma.practiceQuestion.findUnique({ where: { id: req.params.id } })
  if (!current) return res.status(404).json({ error: 'Record not found' })

  const question = await prisma.practiceQuestion.update({
    where: { id: req.params.id },
    data: { draft: mergedDraft(current, req.body, practiceFields) },
  })
  res.json({ question })
})

router.post('/practice-questions/:id/publish', async (req, res) => {
  const current = await prisma.practiceQuestion.findUnique({ where: { id: req.params.id } })
  const data = publishedFrom(current, practiceFields)
  if (!data) return res.status(400).json({ error: 'There is no draft to publish' })

  // An answer that is not one of the options would be unanswerable, so this is
  // checked at publish time rather than while the admin is still typing.
  if (!(data.options || []).includes(data.answer)) {
    return res.status(400).json({ error: 'The answer must be one of the options' })
  }

  const question = await prisma.practiceQuestion.update({ where: { id: req.params.id }, data })
  res.json({ question })
})

router.post('/practice-questions/:id/revert', async (req, res) => {
  const question = await prisma.practiceQuestion.update({
    where: { id: req.params.id },
    data: { draft: null },
  })
  res.json({ question })
})

router.delete('/practice-questions/:id', async (req, res) => {
  await prisma.practiceQuestion.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
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
  res.json({ courses: rows.map(adminCourse), creatableKinds: CREATABLE_KINDS })
})

router.post('/courses', async (req, res) => {
  const payload = req.body || {}
  const moduleSlug = payload.moduleSlug
  const kind = payload.kind || 'driving'

  if (!courseModuleSlugs.includes(moduleSlug)) {
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
      data: kind === 'driving' ? payload.data || emptyCourseGeometry() : null,
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
