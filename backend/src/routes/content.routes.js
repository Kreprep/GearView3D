import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = express.Router()

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

router.get('/equipment', requireAuth, async (_req, res) => {
  const equipment = await prisma.equipment.findMany({
    where: { isActive: true },
    orderBy: { title: 'asc' },
  })

  res.json({ equipment })
})

router.get('/equipment/:equipmentId/modules', requireAuth, async (req, res) => {
  const modules = await prisma.trainingModule.findMany({
    where: { equipmentId: req.params.equipmentId },
    orderBy: { sortOrder: 'asc' },
  })

  res.json({ modules })
})

router.get('/equipment/:equipmentId/parts', requireAuth, async (req, res) => {
  const parts = await prisma.part.findMany({
    where: { equipmentId: req.params.equipmentId },
    orderBy: { label: 'asc' },
  })

  res.json({
    parts: parts.map(formatPart),
  })
})

router.get('/modules', requireAuth, async (_req, res) => {
  const modules = await prisma.trainingModule.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { lessons: { orderBy: { sortOrder: 'asc' } } },
  })

  res.json({ modules })
})

router.get('/modules/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  const module = await prisma.trainingModule.findFirst({
    where: Number.isFinite(id) ? { id } : { slug: req.params.id },
    include: {
      lessons: { orderBy: { sortOrder: 'asc' } },
      checklist: { orderBy: { sortOrder: 'asc' } },
      quizQuestions: { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!module) {
    return res.status(404).json({ message: 'Module not found' })
  }

  res.json({ module })
})

router.get('/lessons/:id', requireAuth, async (req, res) => {
  const lesson = await prisma.lesson.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
    include: {
      module: true,
      sections: { orderBy: { sortOrder: 'asc' } },
      checklist: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!lesson) {
    return res.status(404).json({ message: 'Lesson not found' })
  }

  res.json({ lesson })
})

router.get('/parts', requireAuth, async (_req, res) => {
  const parts = await prisma.part.findMany({
    orderBy: { label: 'asc' },
    include: { hotspots: true },
  })

  res.json({ parts: parts.map(formatPart) })
})

router.get('/parts/:id', requireAuth, async (req, res) => {
  const part = await prisma.part.findUnique({
    where: { id: req.params.id },
    include: { hotspots: true },
  })

  if (!part) {
    return res.status(404).json({ message: 'Part not found' })
  }

  res.json({ part: formatPart(part) })
})

router.get('/modules/:moduleSlug/checklist', requireAuth, async (req, res) => {
  const module = await prisma.trainingModule.findUnique({
    where: { slug: req.params.moduleSlug },
    include: { checklist: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!module) {
    return res.status(404).json({ message: 'Module not found' })
  }

  res.json({ checklist: module.checklist.map((item) => item.text) })
})

export default router
