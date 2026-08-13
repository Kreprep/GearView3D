import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../lib/auth.js'
import { publishedCourse } from '../lib/courses.js'
import { publishedHotspot } from '../lib/walkAroundHotspots.js'
import { publishedEquipmentHotspot } from '../lib/equipmentHotspots.js'
import {
  appendAttempt,
  buildAttempt,
  intoModuleQuiz,
  intoPartsQuiz,
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

// One endpoint for every quiz, module and parts alike:
//
//   GET /quizzes?module=<slug>                 a module's quiz step
//   GET /quizzes?equipment=<id>&context=parts  that equipment's parts quiz
//
// `answer` is deliberately absent from the response: the correct choice stays
// on the server until the learner submits, and /quizzes/submit does the
// scoring.
async function quizScope(query = {}) {
  if (query.context === 'parts') {
    if (!query.equipment) return null
    return { where: { context: 'parts', equipmentId: query.equipment }, place: intoPartsQuiz(query.equipment) }
  }

  const module = await prisma.module.findUnique({ where: { slug: query.module || '' } })
  if (!module) return null
  return { where: { context: 'module', moduleId: module.id }, place: intoModuleQuiz(module.slug) }
}

router.get('/quizzes', async (req, res) => {
  const scope = await quizScope(req.query)
  if (!scope) return res.json([])

  const questions = await prisma.quizQuestion.findMany({
    where: scope.where,
    orderBy: { sortOrder: 'asc' },
    select: { id: true, prompt: true, options: true, sortOrder: true },
  })

  res.json(questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    options: question.options || [],
  })))
})

router.post('/quizzes/submit', requireAuth, async (req, res) => {
  const scope = await quizScope(req.body)
  if (!scope) return res.status(404).json({ error: 'Unknown quiz' })

  const questions = await prisma.quizQuestion.findMany({
    where: scope.where,
    orderBy: { sortOrder: 'asc' },
    select: { id: true, answer: true },
  })

  const scored = scoreAnswers(questions, req.body?.answers)
  const attempt = buildAttempt(scored)
  await appendAttempt(req.user.id, attempt, scope.place)

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

// The generic per-equipment Hotspot Identification page's data - every
// equipment other than Forklift uses this instead of /parts.
router.get('/equipment-hotspots', async (req, res) => {
  const rows = await prisma.equipmentHotspot.findMany({
    where: { published: true, ...(req.query.equipment ? { equipmentId: req.query.equipment } : {}) },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(rows.map(publishedEquipmentHotspot))
})

export default router
