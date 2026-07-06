import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = express.Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const progress = await prisma.progress.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({ progress })
})

router.post('/', async (req, res) => {
  const { moduleSlug, completedSteps = [], progress = 0 } = req.body
  const module = await prisma.trainingModule.findUnique({ where: { slug: moduleSlug } })

  const saved = await prisma.progress.upsert({
    where: {
      userId_moduleSlug: {
        userId: req.user.id,
        moduleSlug,
      },
    },
    create: {
      userId: req.user.id,
      moduleId: module?.id,
      moduleSlug,
      completedSteps,
      progress,
    },
    update: {
      moduleId: module?.id,
      completedSteps,
      progress,
    },
  })

  res.json({ saved: true, progress: saved })
})

export default router
