import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../lib/auth.js'
import { publishedCourse } from '../lib/courses.js'
import { publishedHotspot } from '../lib/walkAroundHotspots.js'
import {
  appendAttempt,
  buildAttempt,
  intoModuleQuiz,
  intoPartsPractice,
  scoreAnswers,
} from '../lib/grading.js'

const router = Router()

router.get('/equipment', async (req, res) => {
  const equipment = await prisma.equipment.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(equipment)
})

// `?equipment=` scopes to one equipment's modules (used by a hub page that
// lists only its own modules); omitted returns every module unfiltered, since
// slug is globally unique and callers that just look up one known module by
// slug (useModuleRecord, the assessment page) never needed a filter.
router.get('/modules', async (req, res) => {
  const where = req.query.equipment ? { equipmentId: req.query.equipment } : {}
  const modules = await prisma.module.findMany({ where, orderBy: { sortOrder: 'asc' } })
  res.json(modules)
})

// Every reader below selects columns explicitly so a pending `draft` cannot
// reach a learner - these tables hold the published row plus the admin's
// unpublished edit side by side.
router.get('/parts', async (req, res) => {
  const parts = await prisma.part.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      label: true,
      category: true,
      position: true,
      functionText: true,
      inspectionReminder: true,
      safetyNote: true,
      relatedModule: true,
      checklist: true,
      sortOrder: true,
    },
  })
  res.json(parts)
})

router.get('/part-categories', async (req, res) => {
  const categories = await prisma.partCategory.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(categories)
})

// `answer` is deliberately absent: the correct choice stays on the server until
// the learner submits, and the submit endpoint below does the scoring.
router.get('/practice-questions', async (req, res) => {
  const questions = await prisma.practiceQuestion.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, prompt: true, options: true, sortOrder: true },
  })
  res.json(questions)
})

router.post('/practice-questions/submit', requireAuth, async (req, res) => {
  const questions = await prisma.practiceQuestion.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, answer: true },
  })

  const scored = scoreAnswers(questions, req.body?.answers)
  const attempt = buildAttempt(scored)
  await appendAttempt(req.user.id, attempt, intoPartsPractice)

  res.json({ ...scored, attempt })
})

// Returned as an object keyed by id, matching the shape the frontend uses.
router.get('/part-details', async (req, res) => {
  const details = await prisma.partDetail.findMany({
    select: { id: true, title: true, subtitle: true, image: true, description: true },
  })
  res.json(Object.fromEntries(details.map((detail) => [detail.id, detail])))
})

// Returns the checklist texts for one module, in order.
// How many checklist items each module has, keyed by slug. Progress percentages
// are computed synchronously in the frontend, so it caches this rather than
// fetching a module's checklist just to count it.
router.get('/checklist-counts', async (req, res) => {
  const [modules, items] = await Promise.all([
    prisma.module.findMany({ select: { id: true, slug: true } }),
    prisma.checklistItem.groupBy({ by: ['moduleId'], _count: { _all: true } }),
  ])

  const counts = {}
  for (const module of modules) {
    counts[module.slug] = items.find((item) => item.moduleId === module.id)?._count._all || 0
  }
  res.json(counts)
})

router.get('/checklists/:moduleSlug', async (req, res) => {
  const module = await prisma.module.findUnique({ where: { slug: req.params.moduleSlug } })
  if (!module) {
    return res.json([])
  }

  const items = await prisma.checklistItem.findMany({
    where: { moduleId: module.id },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(items.map((item) => item.text))
})

// Quiz questions for one module. `options` is stored as { id, text, sortOrder }
// objects but ModuleQuiz compares plain strings against `answer`, so the text is
// flattened here.
router.get('/quizzes/:moduleSlug', async (req, res) => {
  const module = await prisma.module.findUnique({ where: { slug: req.params.moduleSlug } })
  if (!module) {
    return res.json([])
  }

  const questions = await prisma.quizQuestion.findMany({
    where: { moduleId: module.id },
    orderBy: { sortOrder: 'asc' },
  })

  // As with the practice quiz, `answer` is withheld until submission.
  res.json(questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    options: (question.options || [])
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((option) => option.text),
  })))
})

router.post('/quizzes/:moduleSlug/submit', requireAuth, async (req, res) => {
  const module = await prisma.module.findUnique({ where: { slug: req.params.moduleSlug } })
  if (!module) {
    return res.status(404).json({ error: 'Unknown module' })
  }

  const questions = await prisma.quizQuestion.findMany({
    where: { moduleId: module.id },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, answer: true },
  })

  const scored = scoreAnswers(questions, req.body?.answers)
  const attempt = buildAttempt(scored)
  await appendAttempt(req.user.id, attempt, intoModuleQuiz(req.params.moduleSlug))

  res.json({ ...scored, attempt })
})

// Published driving-simulation steps for one module, in step order. Unpublished
// courses are withheld so a course being built in the dashboard never appears
// mid-edit in a learner's module.
router.get('/courses/:moduleSlug', async (req, res) => {
  const rows = await prisma.course.findMany({
    where: { moduleSlug: req.params.moduleSlug, published: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(rows.map(publishedCourse))
})

// Module 1's 3D inspection hotspots. Unpublished ones (still being placed in
// the admin editor) are withheld the same way unpublished courses are.
router.get('/walkaround-hotspots', async (req, res) => {
  const rows = await prisma.walkAroundHotspot.findMany({
    where: { published: true },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(rows.map(publishedHotspot))
})

export default router
