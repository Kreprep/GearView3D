import jwt from 'jsonwebtoken'
import { prisma } from './prisma.js'
import { canAny } from '../../../frontend/src/data/permissions.js'

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

// Gates a route on a permission (frontend/src/data/permissions.js), after
// requireAuth. `req.user` is the row requireAuth just read, so a role changed
// since the token was signed is judged as it is now, not as the token says.
//
// A refusal is a 403, never a 401: the client signs the user out on any 401
// (lib/api.js), and someone who may not do this is still signed in.
//
// The permissions are kept on the middleware so the route tests can read what
// each route asks for, and fail on a route that asks for nothing.
function permissionGuard(permissions) {
  function guard(req, res, next) {
    if (!canAny(req.user, permissions)) {
      return res.status(403).json({ error: 'You do not have permission to do this' })
    }
    next()
  }
  guard.permissions = permissions
  return guard
}

export function requirePermission(permission) {
  return permissionGuard([permission])
}

// For a route that serves several screens: holding any one of them is enough
// to call it, and the handler decides what each permission gets back.
export function requireAnyPermission(permissions) {
  return permissionGuard(permissions)
}
