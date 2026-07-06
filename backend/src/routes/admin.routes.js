import express from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = express.Router()

router.use(requireAuth)
router.use(requireRole('ADMIN'))

router.get('/content', async (_req, res) => {
  const [equipment, modules, parts] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { title: 'asc' } }),
    prisma.trainingModule.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.part.findMany({ orderBy: { label: 'asc' } }),
  ])

  res.json({
    backendOnline: true,
    equipment,
    modules,
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

router.put('/parts/:partId', async (req, res) => {
  const { label, functionText, safetyNote } = req.body

  const part = await prisma.part.update({
    where: { id: req.params.partId },
    data: { label, functionText, safetyNote },
  })

  res.json({
    part: {
      id: part.id,
      label: part.label,
      functionText: part.functionText,
      safetyNote: part.safetyNote,
      position: [part.positionX, part.positionY, part.positionZ],
      checklist: part.checklist,
    },
  })
})

export default router
