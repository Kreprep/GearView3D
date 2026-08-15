import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../lib/auth.js'
import { validateSimulations } from '../lib/walkAroundValidation.js'

const router = Router()

router.use(requireAuth)

// The signed-in user's progress document (same JSON shape the frontend keeps
// in localStorage), or null when they have no saved progress yet.
router.get('/', async (req, res) => {
  const snapshot = await prisma.progressSnapshot.findUnique({ where: { userId: req.user.id } })
  res.json(snapshot ? snapshot.data : null)
})

router.put('/', async (req, res) => {
  const data = req.body
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Progress payload must be an object' })
  }

  if (data.simulations) {
    data.simulations = await validateSimulations(data.simulations)
  }

  const snapshot = await prisma.progressSnapshot.upsert({
    where: { userId: req.user.id },
    update: { data },
    create: { userId: req.user.id, data },
  })

  res.json({ saved: true, updatedAt: snapshot.updatedAt })
})

export default router
