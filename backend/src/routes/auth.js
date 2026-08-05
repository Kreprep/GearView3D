import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { publicUser, requireAuth, signToken } from '../lib/auth.js'

const router = Router()

router.post('/login', async (req, res) => {
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

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user))
})

export default router
