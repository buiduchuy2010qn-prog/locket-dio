/**
 * Official Locket Sync routes — OAuth only, no passwords, no private APIs.
 */
import { Router } from 'express'
import { authRequired } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import { config } from '../config.js'
import {
  checkOfficialLocketAPIAvailability,
  fetchOfficialLocketSyncStatus,
  startOfficialLocketOAuth,
  handleOfficialLocketOAuthCallback,
  disconnectOfficialLocket,
  revokeOfficialLocketToken,
  syncMomentToOfficialLocket,
  showOfficialAPIUnavailableFallback,
  logExport,
} from '../services/officialLocketSync.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

// Required function aliases exposed via API
router.get('/availability', asyncHandler(async (_req, res) => {
  res.json(checkOfficialLocketAPIAvailability())
}))

router.get('/status', authRequired, asyncHandler(async (req, res) => {
  res.json(await fetchOfficialLocketSyncStatus(req.user.id))
}))

/** startOfficialLocketOAuth */
router.post('/oauth/start', authRequired, asyncHandler(async (req, res) => {
  res.json(await startOfficialLocketOAuth(req.user.id))
}))

/** Legacy alias */
router.post('/connect', authRequired, asyncHandler(async (req, res) => {
  if (req.body.code) {
    res.json(await handleOfficialLocketOAuthCallback(req.user.id, {
      code: req.body.code,
      state: req.body.state,
    }))
    return
  }
  res.json(await startOfficialLocketOAuth(req.user.id))
}))

/** handleOfficialLocketOAuthCallback (browser redirect) */
router.get('/callback', asyncHandler(async (req, res) => {
  const code = req.query.code
  const state = req.query.state
  const err = req.query.error
  if (err) {
    return res.redirect(`${config.appUrl}/app/connect-locket?error=${encodeURIComponent(String(err))}`)
  }
  // User must be logged in via cookie; if not, send code to SPA to complete
  if (!req.cookies?.[config.cookieName] && !req.headers.authorization) {
    return res.redirect(
      `${config.appUrl}/app/connect-locket?code=${encodeURIComponent(code || '')}&state=${encodeURIComponent(state || '')}`,
    )
  }
  // SPA will finish with POST /connect including code
  res.redirect(
    `${config.appUrl}/app/connect-locket?code=${encodeURIComponent(code || '')}&state=${encodeURIComponent(state || '')}`,
  )
}))

router.post('/oauth/callback', authRequired, asyncHandler(async (req, res) => {
  res.json(await handleOfficialLocketOAuthCallback(req.user.id, {
    code: req.body.code,
    state: req.body.state,
  }))
}))

router.post('/disconnect', authRequired, asyncHandler(async (req, res) => {
  res.json(await disconnectOfficialLocket(req.user.id))
}))

router.post('/revoke', authRequired, asyncHandler(async (req, res) => {
  res.json(await revokeOfficialLocketToken(req.user.id))
}))

/** syncMomentToOfficialLocket */
router.post('/sync', authRequired, asyncHandler(async (req, res) => {
  const momentId = req.body.momentId
  if (!momentId) throw new AppError('momentId required')
  const moment = await prisma.moment.findFirst({
    where: { id: momentId, authorId: req.user.id, deletedAt: null },
    include: { media: true },
  })
  if (!moment) throw new AppError('Moment not found', 404)
  const mediaUrl = moment.media?.[0]?.url
  const result = await syncMomentToOfficialLocket(req.user.id, momentId, {
    mediaUrl,
    caption: moment.caption,
  })
  res.json(result)
}))

/** Fallback UI payload when API unavailable */
router.get('/fallback', authRequired, asyncHandler(async (req, res) => {
  res.json(showOfficialAPIUnavailableFallback({
    momentId: req.query.momentId,
    caption: req.query.caption,
  }))
}))

/** Log export / manual share actions */
router.post('/export-log', authRequired, asyncHandler(async (req, res) => {
  const action = String(req.body.action || '')
  const allowed = ['download', 'copy_caption', 'share', 'qr', 'manual_instruction']
  if (!allowed.includes(action)) throw new AppError('Invalid export action')
  const log = await logExport(req.user.id, {
    momentId: req.body.momentId,
    action,
    meta: req.body.meta || {},
  })
  res.json({ ok: true, log })
}))

// Aliases for frontend naming
router.get('/sync-status', authRequired, asyncHandler(async (req, res) => {
  res.json(await fetchOfficialLocketSyncStatus(req.user.id))
}))

export default router
