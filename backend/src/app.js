import cors from 'cors'
import express from 'express'
import authRoutes from './routes/auth.routes.js'
import contentRoutes from './routes/content.routes.js'
import progressRoutes from './routes/progress.routes.js'
import adminRoutes from './routes/admin.routes.js'

const app = express()

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'GearView3D API' })
})

app.use('/api/auth', authRoutes)
app.use('/api', contentRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/admin', adminRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  })
})

export default app
