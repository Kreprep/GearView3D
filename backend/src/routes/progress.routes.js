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

router.post('/checklist', async (req, res) => {
  const { moduleSlug, completedItems = [], progress = 0 } = req.body
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
      completedSteps: completedItems,
      progress,
    },
    update: {
      moduleId: module?.id,
      completedSteps: completedItems,
      progress,
    },
  })

  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      action: 'checklist_updated',
      detail: moduleSlug,
      metadata: { completedItems, progress },
    },
  })

  res.json({ saved: true, progress: saved })
})

router.post('/part-viewed', async (req, res) => {
  const { partId } = req.body

  const saved = await prisma.userProgress.upsert({
    where: {
      userId_scope_scopeId: {
        userId: req.user.id,
        scope: 'part',
        scopeId: partId,
      },
    },
    create: {
      userId: req.user.id,
      scope: 'part',
      scopeId: partId,
      status: 'viewed',
      value: 100,
    },
    update: {
      status: 'viewed',
      value: 100,
    },
  })

  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      action: 'part_viewed',
      detail: partId,
    },
  })

  res.json({ saved: true, progress: saved })
})

router.post('/lesson-complete', async (req, res) => {
  const { lessonId } = req.body

  const saved = await prisma.userProgress.upsert({
    where: {
      userId_scope_scopeId: {
        userId: req.user.id,
        scope: 'lesson',
        scopeId: lessonId,
      },
    },
    create: {
      userId: req.user.id,
      scope: 'lesson',
      scopeId: lessonId,
      status: 'complete',
      value: 100,
    },
    update: {
      status: 'complete',
      value: 100,
    },
  })

  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      action: 'lesson_complete',
      detail: lessonId,
    },
  })

  res.json({ saved: true, progress: saved })
})

export default router
