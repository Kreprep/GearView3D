import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { publicUser, requireAuth, signToken } from '../lib/auth.js'
import { authLimiter } from '../lib/rateLimit.js'

const router = Router()

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } })
  const passwordMatches = user && (await bcrypt.compare(String(password), user.passwordHash))

  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  res.json({ token: signToken(user), user: publicUser(user) })
})

// Self-service signup: email + password only. There is no email verification
// step (infrastructure for it is out of scope for this prototype), so the
// account is usable immediately. `fullName` is required by the schema but not
// collected here, so it is derived from the email's local part.
router.post('/signup', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: `An account with email "${email}" already exists` })
  }

  const fullName = email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

  const user = await prisma.user.create({
    data: {
      email,
      fullName: fullName || email,
      passwordHash: await bcrypt.hash(password, 10),
    },
  })

  res.json({ token: signToken(user), user: publicUser(user) })
})

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user))
})

export default router
