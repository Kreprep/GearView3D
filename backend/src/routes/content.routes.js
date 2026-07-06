import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = express.Router()

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
    parts: parts.map((part) => ({
      id: part.id,
      label: part.label,
      functionText: part.functionText,
      safetyNote: part.safetyNote,
      position: [part.positionX, part.positionY, part.positionZ],
      checklist: part.checklist,
    })),
  })
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
