import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../lib/auth.js'
import { publishedCourse } from '../lib/courses.js'
import { findEquipment } from '../lib/equipment.js'
import { hotspotDetail, publishedHotspot } from '../lib/hotspots.js'
import { listSkills } from '../lib/skills.js'
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

// The one Equipment row: title, hub artwork, hub copy and driving overrides.
router.get('/equipment', async (req, res) => {
  const equipment = await findEquipment()
  if (!equipment) return res.status(404).json({ error: 'Equipment has not been seeded' })
  res.json(equipment)
})

router.get('/modules', async (req, res) => {
  const modules = await prisma.module.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(modules)
})

// The published hotspots, optionally narrowed to the surface that is asking:
//
//   GET /hotspots                      every marker
//   GET /hotspots?surface=parts        the Parts Identification markers
//   GET /hotspots?surface=walk-around  the inspection markers
//
// Unplaced rows (created but never published) are held back from learners the
// same way an unpublished course step is. `publishedHotspot` picks columns
// explicitly, so a pending `draft` cannot ride along.
router.get('/hotspots', async (req, res) => {
  const where = { published: true }
  if (req.query.surface === 'parts') where.inParts = true
  if (req.query.surface === 'walk-around') where.inWalkAround = true

  const rows = await prisma.hotspot.findMany({ where, orderBy: { sortOrder: 'asc' } })
  res.json(rows.map(publishedHotspot))
})

// The detail cards, as an object keyed by hotspot id - the shape the frontend
// has always consumed. Detail-only rows (a card with no marker) are included,
// which is the whole reason this is a separate call from /hotspots.
router.get('/hotspot-details', async (req, res) => {
  const rows = await prisma.hotspot.findMany({ where: { published: true } })
  res.json(Object.fromEntries(rows.map((row) => [row.id, hotspotDetail(row)])))
})

router.get('/hotspot-categories', async (req, res) => {
  const categories = await prisma.hotspotCategory.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(categories)
})

// The Skills Checklist catalogue, in order, each skill with its evidence rules
// and the modules that teach or require it. What a learner has shown of each
// is GET /api/progress/skills.
router.get('/skills', async (req, res) => {
  res.json(await listSkills())
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
//   GET /quizzes?module=<slug>     a module's quiz step
//   GET /quizzes?context=parts     the Parts Identification quiz
//
// `answer` is deliberately absent from the response: the correct choice stays
// on the server until the learner submits, and /quizzes/submit does the
// scoring.
async function quizScope(query = {}) {
  if (query.context === 'parts') {
    return { where: { context: 'parts' }, place: intoPartsQuiz() }
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
