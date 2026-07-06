import express from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = express.Router()

router.use(requireAuth)
router.use(requireRole('ADMIN'))

function formatPart(part) {
  return {
    id: part.id,
    label: part.label,
    category: part.category,
    functionText: part.functionText,
    inspectionReminder: part.inspectionReminder,
    safetyNote: part.safetyNote,
    relatedModule: part.relatedModule,
    position: [part.positionX, part.positionY, part.positionZ],
    checklist: part.checklist,
  }
}

router.get('/content', async (_req, res) => {
  const [equipment, modules, parts, checklists, quizQuestions, users, progress, activityLogs] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { title: 'asc' } }),
    prisma.trainingModule.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.part.findMany({ orderBy: { label: 'asc' } }),
    prisma.checklistItem.findMany({ include: { module: true }, orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.quizQuestion.findMany({ include: { module: true, options: { orderBy: { sortOrder: 'asc' } } }, orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.user.findMany({ select: { id: true, email: true, fullName: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.progress.findMany({ include: { user: { select: { email: true, fullName: true } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.activityLog.findMany({ include: { user: { select: { email: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  res.json({
    backendOnline: true,
    equipment,
    modules,
    parts: parts.map(formatPart),
    checklists,
    quizQuestions,
    users,
    progress,
    activityLogs,
  })
})

router.put('/modules/:moduleId', async (req, res) => {
  const { title, subtitle, description } = req.body
  const module = await prisma.trainingModule.update({
    where: { id: Number(req.params.moduleId) },
    data: { title, subtitle, description },
  })

  res.json({ module })
})

router.post('/modules', async (req, res) => {
  const { id, slug, equipmentId = 'forklift', title, subtitle, description, sortOrder = 99 } = req.body
  const module = await prisma.trainingModule.create({
    data: { id: Number(id), slug, equipmentId, title, subtitle, description, sortOrder: Number(sortOrder) },
  })

  res.status(201).json({ module })
})

router.delete('/modules/:moduleId', async (req, res) => {
  await prisma.trainingModule.delete({ where: { id: Number(req.params.moduleId) } })
  res.json({ deleted: true })
})

router.post('/parts', async (req, res) => {
  const {
    id,
    label,
    category,
    functionText,
    inspectionReminder,
    safetyNote,
    relatedModule,
    checklist = [],
    position = [0, 0, 0],
  } = req.body

  const part = await prisma.part.create({
    data: {
      id,
      equipmentId: 'forklift',
      label,
      category,
      functionText,
      inspectionReminder,
      safetyNote,
      relatedModule,
      checklist,
      positionX: Number(position[0] || 0),
      positionY: Number(position[1] || 0),
      positionZ: Number(position[2] || 0),
    },
  })

  res.status(201).json({ part: formatPart(part) })
})

router.put('/parts/:partId', async (req, res) => {
  const { label, category, functionText, inspectionReminder, safetyNote, relatedModule } = req.body

  const part = await prisma.part.update({
    where: { id: req.params.partId },
    data: { label, category, functionText, inspectionReminder, safetyNote, relatedModule },
  })

  res.json({ part: formatPart(part) })
})

router.delete('/parts/:partId', async (req, res) => {
  await prisma.part.delete({ where: { id: req.params.partId } })
  res.json({ deleted: true })
})

router.put('/checklists/:itemId', async (req, res) => {
  const { text } = req.body
  const item = await prisma.checklistItem.update({
    where: { id: req.params.itemId },
    data: { text },
  })

  res.json({ item })
})

router.post('/checklists', async (req, res) => {
  const { moduleId, text, sortOrder = 99 } = req.body
  const item = await prisma.checklistItem.create({
    data: { moduleId: Number(moduleId), text, sortOrder: Number(sortOrder) },
  })

  res.status(201).json({ item })
})

router.delete('/checklists/:itemId', async (req, res) => {
  await prisma.checklistItem.delete({ where: { id: req.params.itemId } })
  res.json({ deleted: true })
})

router.put('/quizzes/:questionId', async (req, res) => {
  const { prompt, answer, options = [] } = req.body
  const question = await prisma.quizQuestion.update({
    where: { id: req.params.questionId },
    data: {
      prompt,
      answer,
      options: {
        deleteMany: {},
        create: options.map((text, index) => ({ text, sortOrder: index + 1 })),
      },
    },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })

  res.json({ question })
})

router.post('/quizzes', async (req, res) => {
  const { id, moduleId, prompt, answer, options = [], sortOrder = 99 } = req.body
  const question = await prisma.quizQuestion.create({
    data: {
      id,
      moduleId: Number(moduleId),
      prompt,
      answer,
      sortOrder: Number(sortOrder),
      options: { create: options.map((text, index) => ({ text, sortOrder: index + 1 })) },
    },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })

  res.status(201).json({ question })
})

router.delete('/quizzes/:questionId', async (req, res) => {
  await prisma.quizQuestion.delete({ where: { id: req.params.questionId } })
  res.json({ deleted: true })
})

export default router
