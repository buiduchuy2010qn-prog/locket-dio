import http from 'http'
import path from 'path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { errorMiddleware } from './lib/errors.js'
import { LOCAL_UPLOAD_DIR } from './services/media.js'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import friendRoutes from './routes/friends.js'
import momentRoutes from './routes/moments.js'
import notificationRoutes from './routes/notifications.js'
import goldRoutes from './routes/gold.js'
import streakRoutes from './routes/streaks.js'
import locketRoutes from './routes/locket.js'
import integrationsLocketRoutes from './routes/integrationsLocket.js'
import exportRoutes from './routes/export.js'
import adminRoutes from './routes/admin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: config.corsOrigin, credentials: true },
})
app.set('io', io)

io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId
  if (userId) socket.join(`user:${userId}`)
  socket.on('disconnect', () => {})
})

app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: config.corsOrigin, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'locket-dio-api',
    name: config.appName,
    env: config.env,
    time: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    app: config.appName,
    version: '1.0.0',
    features: {
      cloudinary: !!(config.cloudinary.cloudName && config.cloudinary.apiKey),
      stripe: !!config.stripe.secretKey,
      locketOauth: config.locket.enabled,
      realtime: true,
    },
  })
})

// Local media fallback
app.use('/media/local', express.static(LOCAL_UPLOAD_DIR))

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/moments', momentRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/gold', goldRoutes)
app.use('/api/streaks', streakRoutes)
app.use('/api/locket', locketRoutes)
app.use('/api/integrations/locket', integrationsLocketRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/admin', adminRoutes)

app.use(errorMiddleware)

server.listen(config.port, () => {
  console.log(`[locket-dio-api] ${config.appName} listening on :${config.port}`)
  console.log(`[locket-dio-api] CORS: ${config.corsOrigin.join(', ')}`)
})

export default app
