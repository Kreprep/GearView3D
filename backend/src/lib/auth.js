import jwt from 'jsonwebtoken'
import { prisma } from './prisma.js'

const TOKEN_LIFETIME = '7d'

function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Copy backend/.env.example to backend/.env and fill it in.')
  }
  return secret
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret(), { expiresIn: TOKEN_LIFETIME })
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  }
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' })
  }

  // Read before the try, so a missing JWT_SECRET is a 500 rather than every
  // token reading as invalid.
  const secret = jwtSecret()

  let payload
  try {
    payload = jwt.verify(token, secret)
  } catch (error) {
    // Told apart because the causes differ: an expired token is TOKEN_LIFETIME
    // running out, while one refused before then was signed with a JWT_SECRET
    // the server no longer has.
    const message = error.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token'
    return res.status(401).json({ error: message })
  }

  // Outside the try on purpose. The client signs the learner out on any 401
  // (lib/api.js), so a database hiccup here must surface as a 500 rather than
  // be reported as a bad token.
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user) {
    return res.status(401).json({ error: 'Account no longer exists' })
  }
  req.user = user
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
