import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import contentRoutes from './routes/content.js'
import progressRoutes from './routes/progress.js'
import adminRoutes from './routes/admin.js'

export function createApp() {
  const app = express()

  // In development the Vite dev server proxies /api here, so CORS mostly
  // matters when the frontend is opened against a differently-hosted API.
  app.use(cors())
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
