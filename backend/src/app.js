import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './routes/auth.js'
import contentRoutes from './routes/content.js'
import progressRoutes from './routes/progress.js'
import adminRoutes from './routes/admin.js'

export function createApp() {
  const app = express()

  // Deployment (docker-compose.yml) puts Caddy in front of nginx in front of
  // this API - trust its X-Forwarded-For by one hop, so req.ip (which the
  // auth rate limiter keys on) is the real client rather than the proxy.
  app.set('trust proxy', 1)

  app.use(helmet())

  // In production nginx serves the frontend same-origin (see nginx.conf), so
  // no CORS is needed there at all - CORS_ORIGIN stays unset and this reflects
  // no origin. Set it (comma-separated) only when the frontend is hosted
  // somewhere else entirely.
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim())
  app.use(cors({ origin: allowedOrigins ?? false }))

  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (req, res) => {
    res.json({ ok: true })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/content', contentRoutes)
  app.use('/api/progress', progressRoutes)
  app.use('/api/admin', adminRoutes)

  app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` })
  })

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    // Prisma "record not found" on update/delete.
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' })
    }
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
