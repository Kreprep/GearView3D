import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = express.Router()

router.use(requireAuth)

router.get('/:moduleId', async (req, res) => {
  const moduleId = Number(req.params.moduleId)
  const module = await prisma.trainingModule.findFirst({
    where: Number.isFinite(moduleId) ? { id: moduleId } : { slug: req.params.moduleId },
    include: {
      quizQuestions: {
        orderBy: { sortOrder: 'asc' },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  })

  if (!module) {
    return res.status(404).json({ message: 'Module not found' })
  }

  res.json({
    moduleSlug: module.slug,
    questions: module.quizQuestions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => option.text),
    })),
  })
})

router.post('/:moduleId/attempt', async (req, res) => {
  const { score, total, answers = {} } = req.body
  const moduleId = Number(req.params.moduleId)
  const module = await prisma.trainingModule.findFirst({
    where: Number.isFinite(moduleId) ? { id: moduleId } : { slug: req.params.moduleId },
  })

  if (!module) {
    return res.status(404).json({ message: 'Module not found' })
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId: req.user.id,
      moduleSlug: module.slug,
      score,
      total,
      percentage: total ? Math.round((score / total) * 100) : 0,
      answers,
    },
  })

  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      action: 'quiz_attempt',
      detail: module.slug,
      metadata: { score, total },
    },
  })

  res.json({ saved: true, attempt })
})

export default router
