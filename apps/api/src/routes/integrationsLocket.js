/**
 * Spec aliases: /api/integrations/locket/*
 * Delegates to official Locket sync service (OAuth only).
 */
import { Router } from 'express'
import { authRequired } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import {
  checkOfficialLocketAPIAvailability,
  fetchOfficialLocketSyncStatus,
  startOfficialLocketOAuth,
  handleOfficialLocketOAuthCallback,
  disconnectOfficialLocket,
  revokeOfficialLocketToken,
  syncMomentToOfficialLocket,
} from '../services/officialLocketSync.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/status', authRequired, asyncHandler(async (req, res) => {
  res.json(await fetchOfficialLocketSyncStatus(req.user.id))
}))

router.post('/check', asyncHandler(async (_req, res) => {
  res.json(checkOfficialLocketAPIAvailability())
}))

router.post('/connect', authRequired, asyncHandler(async (req, res) => {
  if (req.body?.code) {
    res.json(await handleOfficialLocketOAuthCallback(req.user.id, {
      code: req.body.code,
      state: req.body.state,
    }))
    return
  }
  res.json(await startOfficialLocketOAuth(req.user.id))
}))

router.post('/callback', authRequired, asyncHandler(async (req, res) => {
  res.json(await handleOfficialLocketOAuthCallback(req.user.id, {
    code: req.body.code || req.query.code,
    state: req.body.state || req.query.state,
  }))
}))

router.post('/disconnect', authRequired, asyncHandler(async (req, res) => {
  const r = await disconnectOfficialLocket(req.user.id)
  await revokeOfficialLocketToken(req.user.id).catch(() => {})
  res.json(r)
}))

router.post('/sync/:momentId', authRequired, asyncHandler(async (req, res) => {
  const momentId = req.params.momentId
  const moment = await prisma.moment.findFirst({
    where: { id: momentId, authorId: req.user.id, deletedAt: null },
    include: { media: true },
  })
  if (!moment) throw new AppError('Moment not found', 404)
  res.json(await syncMomentToOfficialLocket(req.user.id, momentId, {
    mediaUrl: moment.media?.[0]?.url,
    caption: moment.caption,
  }))
}))

export default router
