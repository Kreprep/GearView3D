import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = express.Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  }
}

function signToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: '8h' },
  )
}

router.post('/login', async (req, res) => {
  const credentials = loginSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { email: credentials.email } })

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(credentials.password, user.passwordHash)

  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  res.json({
    token: signToken(user),
    user: publicUser(user),
  })
})

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user })
})

export default router
