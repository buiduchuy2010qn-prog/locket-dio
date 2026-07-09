import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma.js'
import {
  hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie,
  toPublic, authRequired, randomToken, hashToken, audit, loadUser,
} from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import { config } from '../config.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try later' },
})

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9._]+$/),
  displayName: z.string().min(1).max(50).optional(),
})

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

router.post('/signup', authLimiter, asyncHandler(async (req, res) => {
  const body = signupSchema.parse(req.body)
  const email = body.email.toLowerCase().trim()
  const username = body.username.toLowerCase().trim()

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  })
  if (exists) {
    throw new AppError(exists.email === email ? 'Email already used' : 'Username taken', 409)
  }

  const passwordHash = await hashPassword(body.password)
  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      profile: {
        create: {
          displayName: body.displayName || body.username,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        },
      },
      // Full features free for every Locket Dio account
      goldSubscription: {
        create: {
          status: 'ACTIVE',
          plan: 'YEARLY',
          currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000),
        },
      },
      goldCustomization: { create: {} },
      locketConnection: { create: { status: 'unavailable' } },
    },
    include: { profile: true, goldSubscription: true, goldCustomization: true, locketConnection: true },
  })

  const verifyToken = randomToken()
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(verifyToken),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  })

  if (config.env === 'development') {
    console.log(`[email-verify] ${email} token=${verifyToken}`)
  }

  const jwt = signToken(user.id)
  setAuthCookie(res, jwt)
  await audit(user.id, 'auth.signup', {}, req.ip)

  res.status(201).json({
    user: toPublic(user),
    token: jwt,
    verifyHint: config.env === 'development' ? verifyToken : undefined,
  })
}))

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body)
  const id = body.email.toLowerCase().trim()
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
    include: { profile: true, goldSubscription: true, goldCustomization: true, locketConnection: true },
  })
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new AppError('Invalid email or password', 401)
  }
  if (user.isBlocked) throw new AppError('Account blocked', 403)

  const jwt = signToken(user.id)
  setAuthCookie(res, jwt)
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(jwt),
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  })
  await audit(user.id, 'auth.login', {}, req.ip)
  res.json({ user: toPublic(user), token: jwt })
}))

router.post('/logout', authRequired, asyncHandler(async (req, res) => {
  clearAuthCookie(res)
  await audit(req.user.id, 'auth.logout', {}, req.ip)
  res.json({ ok: true })
}))

router.get('/me', authRequired, asyncHandler(async (req, res) => {
  res.json({ user: toPublic(req.user) })
}))

router.post('/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim()
  if (!email) throw new AppError('Email required')
  const user = await prisma.user.findUnique({ where: { email } })
  // Always same response to avoid enumeration
  const msg = 'If that email exists, a reset link was sent.'
  if (!user) return res.json({ ok: true, message: msg })

  const token = randomToken()
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  })
  if (config.env === 'development') {
    console.log(`[password-reset] ${email} token=${token}`)
  }
  res.json({
    ok: true,
    message: msg,
    ...(config.env === 'development' ? { devToken: token } : {}),
  })
}))

router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const token = String(req.body.token || '')
  const password = String(req.body.password || '')
  if (!token || password.length < 6) throw new AppError('Invalid token or password')

  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError('Invalid or expired token')

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ])
  res.json({ ok: true, message: 'Password updated' })
}))

router.post('/verify-email', asyncHandler(async (req, res) => {
  const token = String(req.body.token || req.query.token || '')
  if (!token) throw new AppError('Token required')
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError('Invalid or expired token')

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ])
  const user = await loadUser(row.userId)
  res.json({ ok: true, user: toPublic(user) })
}))

export default router
