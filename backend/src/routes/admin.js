import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { publicUser, requireAdmin, requireAuth } from '../lib/auth.js'
import { buildAdminProgressReport } from '../lib/progressSummary.js'

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
const moduleFields = ['title', 'subtitle', 'description', 'sortOrder']
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

export default router
