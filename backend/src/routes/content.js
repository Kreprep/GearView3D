import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../lib/auth.js'
import { publishedCourse } from '../lib/courses.js'
import { hotspotDetail, publishedHotspot } from '../lib/hotspots.js'
import {
  appendAttempt,
  buildAttempt,
  intoModuleQuiz,
  intoPartsQuiz,
  scoreAnswers,
} from '../lib/grading.js'

const router = Router()

// Every route here only ever renders behind the app's own login gate (see
// App.jsx), so there is no legitimate anonymous caller - and without this,
// module/quiz/checklist content was fetchable by anyone with the URL.
router.use(requireAuth)

// `moduleCount` rides along because the catalogue decides whether a card is
// clickable from whether the equipment actually has training behind it -
// modules, or a model for its identification page - rather than from a
// hardcoded allow-list.
router.get('/equipment', async (req, res) => {
  const [equipment, moduleCounts] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.module.groupBy({ by: ['equipmentId'], _count: { _all: true } }),
  ])

  res.json(equipment.map((row) => ({
    ...row,
    moduleCount: moduleCounts.find((entry) => entry.equipmentId === row.id)?._count._all || 0,
  })))
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

// One equipment's published hotspots, optionally narrowed to the surface that
// is asking:
//
//   GET /hotspots?equipment=forklift                 every marker it has
//   GET /hotspots?equipment=forklift&surface=parts   its Parts Identification markers
//   GET /hotspots?equipment=forklift&surface=walk-around   its inspection markers
//
// Unplaced rows (created but never published) are held back from learners the
// same way an unpublished course step is. `publishedHotspot` picks columns
// explicitly, so a pending `draft` cannot ride along.
router.get('/hotspots', async (req, res) => {
  const where = { published: true }
  if (req.query.equipment) where.equipmentId = req.query.equipment
  if (req.query.surface === 'parts') where.inParts = true
  if (req.query.surface === 'walk-around') where.inWalkAround = true

  const rows = await prisma.hotspot.findMany({ where, orderBy: { sortOrder: 'asc' } })
  res.json(rows.map(publishedHotspot))
})

// The detail cards, as an object keyed by hotspot id - the shape the frontend
// has always consumed. Detail-only rows (a card with no marker) are included,
// which is the whole reason this is a separate call from /hotspots.
router.get('/hotspot-details', async (req, res) => {
  const where = { published: true }
  if (req.query.equipment) where.equipmentId = req.query.equipment

  const rows = await prisma.hotspot.findMany({ where })
  res.json(Object.fromEntries(rows.map((row) => [row.id, hotspotDetail(row)])))
})

router.get('/hotspot-categories', async (req, res) => {
  const where = req.query.equipment ? { equipmentId: req.query.equipment } : {}
  const categories = await prisma.hotspotCategory.findMany({ where, orderBy: { sortOrder: 'asc' } })
  res.json(categories)
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
  res.json(items.map((item) => ({ id: item.id, text: item.text })))
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

router.post('/quizzes/submit', async (req, res) => {
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

export default router
