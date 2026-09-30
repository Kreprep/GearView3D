import { Router } from 'express'
import { requireAuth } from '../lib/auth.js'
import { validateSimulations } from '../lib/walkAroundValidation.js'
import { parseBaseRevision, readProgress, withoutRevisionFields, writeProgress } from '../lib/progress.js'
import { evaluateUserSkills, learnerResults } from '../lib/skills.js'

const router = Router()

router.use(requireAuth)

// The signed-in user's progress document (same JSON shape the frontend keeps
// in localStorage) with the `revision` it is at, or null when they have no
// saved progress yet.
router.get('/', async (req, res) => {
  res.json(await readProgress(req.user.id))
})

// The signed-in learner's skills: per skill its status and the evidence met,
// judged by the same code as the instructor's view (lib/skills.js). A
// sign-off shows as its stamp only; the notes and the trail are staff's.
// There is no write here, and nothing in this router writes a sign-off: the
// document PUT below stores progress, and a sign-off is not progress.
router.get('/skills', async (req, res) => {
  const { results } = await evaluateUserSkills(req.user.id)
  res.json({ results: learnerResults(results) })
})

// Replaces the document. The body is the document plus `baseRevision`, the
// revision the client last read; a reset since then makes it stale, and the
// answer is 409 so the client drops its copy and re-reads. Never a 401: that
// would sign the learner out.
router.put('/', async (req, res) => {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Progress payload must be an object' })
  }

  const baseRevision = parseBaseRevision(body.baseRevision)
  const data = withoutRevisionFields(body)
  if (data.simulations) {
    data.simulations = await validateSimulations(data.simulations)
  }

  const result = await writeProgress(req.user.id, data, baseRevision)
  if (result.stale) {
    return res.status(409).json({ error: 'Your progress was reset. Reloading it.' })
  }

  res.json({ saved: true, revision: result.snapshot.revision, updatedAt: result.snapshot.updatedAt })
})

export default router
