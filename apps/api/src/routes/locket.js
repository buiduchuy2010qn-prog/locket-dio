/**
 * Connect Locket — official OAuth only.
 * Never accepts or stores Locket passwords.
 */
import { Router } from 'express'
import { authRequired } from '../lib/auth.js'
import { asyncHandler } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { config } from '../config.js'

const router = Router()

export async function fetchLocketConnectionStatus(userId) {
  const row = await prisma.locketConnection.findUnique({ where: { userId } })
  const officialAvailable = !!(
    config.locket.enabled &&
    config.locket.clientId &&
    config.locket.authUrl
  )
  return {
    status: row?.status || 'disconnected',
    officialAvailable,
    connectedAt: row?.connectedAt || null,
    lastSyncAt: row?.lastSyncAt || null,
    externalUserId: row?.externalUserId || null,
    message: officialAvailable
      ? 'Official Locket OAuth is configured. You can connect safely without sharing your password.'
      : 'Official Locket API/OAuth is not available. Use Locket Dio as an independent private photo app. We will never ask for your Locket password.',
  }
}

export async function connectLocketAccount(userId, { code } = {}) {
  if (!config.locket.enabled || !config.locket.clientId) {
    await prisma.locketConnection.upsert({
      where: { userId },
      create: { userId, status: 'unavailable', meta: { reason: 'no_official_oauth' } },
      update: { status: 'unavailable', meta: { reason: 'no_official_oauth' } },
    })
    return {
      ok: false,
      status: 'unavailable',
      error: 'Official Locket OAuth is not configured. Password-based login is not supported for security and legal reasons.',
    }
  }

  // Placeholder for real OAuth code exchange when credentials are provided
  if (!code) {
    const authUrl = `${config.locket.authUrl}?client_id=${encodeURIComponent(config.locket.clientId)}&redirect_uri=${encodeURIComponent(`${config.apiUrl}/api/locket/callback`)}&response_type=code`
    return { ok: true, status: 'pending', authUrl }
  }

  // Would exchange code for tokens via official tokenUrl only
  return {
    ok: false,
    status: 'unavailable',
    error: 'Token exchange not implemented until official Locket API documentation is provided.',
  }
}

export async function disconnectLocketAccount(userId) {
  await prisma.locketConnection.upsert({
    where: { userId },
    create: { userId, status: 'disconnected' },
    update: {
      status: 'disconnected',
      accessTokenEnc: null,
      refreshTokenEnc: null,
      externalUserId: null,
      connectedAt: null,
    },
  })
  return { ok: true, status: 'disconnected' }
}

export async function syncWithLocketOfficialAPI(userId) {
  const status = await fetchLocketConnectionStatus(userId)
  if (status.status !== 'connected') {
    return { ok: false, error: 'Not connected to Locket via official OAuth' }
  }
  // Official sync only when API exists
  return { ok: false, error: 'Official sync endpoints not configured' }
}

router.get('/status', authRequired, asyncHandler(async (req, res) => {
  res.json(await fetchLocketConnectionStatus(req.user.id))
}))

router.post('/connect', authRequired, asyncHandler(async (req, res) => {
  res.json(await connectLocketAccount(req.user.id, { code: req.body.code }))
}))

router.post('/disconnect', authRequired, asyncHandler(async (req, res) => {
  res.json(await disconnectLocketAccount(req.user.id))
}))

router.post('/sync', authRequired, asyncHandler(async (req, res) => {
  res.json(await syncWithLocketOfficialAPI(req.user.id))
}))

router.get('/callback', asyncHandler(async (req, res) => {
  // OAuth redirect landing — only when official flow is enabled
  res.redirect(`${config.appUrl}/app/connect-locket?code=${encodeURIComponent(req.query.code || '')}`)
}))

export default router
