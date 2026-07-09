import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { config } from '../config.js'
import { prisma } from './prisma.js'
import { AppError } from './errors.js'
import { publicUser } from '@locket-dio/shared'

const userInclude = {
  profile: true,
  goldSubscription: true,
  goldCustomization: true,
  locketConnection: true,
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpires })
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret)
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function randomToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSecure ? 'none' : 'lax',
    path: '/',
  })
}

export async function loadUser(userId) {
  return prisma.user.findUnique({ where: { id: userId }, include: userInclude })
}

export function toPublic(user) {
  return publicUser(user)
}

export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null
    const token = bearer || req.cookies?.[config.cookieName]
    if (!token) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED')
    let payload
    try {
      payload = verifyToken(token)
    } catch {
      throw new AppError('Invalid or expired session', 401, 'UNAUTHORIZED')
    }
    const user = await loadUser(payload.sub)
    if (!user || user.isBlocked) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED')
    req.user = user
    req.token = token
    next()
  } catch (e) {
    next(e)
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null
    const token = bearer || req.cookies?.[config.cookieName]
    if (token) {
      try {
        const payload = verifyToken(token)
        const user = await loadUser(payload.sub)
        if (user && !user.isBlocked) req.user = user
      } catch { /* ignore */ }
    }
    next()
  } catch (e) {
    next(e)
  }
}

export function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('Admin only', 403, 'FORBIDDEN'))
  }
  next()
}

export async function audit(userId, action, meta = {}, ip) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, meta, ip: ip || null },
    })
  } catch (e) {
    console.warn('[audit]', e.message)
  }
}
