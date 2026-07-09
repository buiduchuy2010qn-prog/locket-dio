/**
 * Safe export routes — download / QR for manual Locket posting.
 * Never claims unofficial sync to official Locket.
 */
import { Router } from 'express'
import { authRequired } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logExport, showOfficialAPIUnavailableFallback } from '../services/officialLocketSync.js'
import { config } from '../config.js'

const router = Router()

async function getOwnMoment(userId, momentId) {
  const m = await prisma.moment.findFirst({
    where: { id: momentId, authorId: userId, deletedAt: null },
    include: { media: true },
  })
  if (!m) throw new AppError('Moment not found', 404)
  return m
}

router.get('/download/:momentId', authRequired, asyncHandler(async (req, res) => {
  const m = await getOwnMoment(req.user.id, req.params.momentId)
  const media = m.media?.[0]
  if (!media?.url) throw new AppError('No media', 404)

  await logExport(req.user.id, {
    momentId: m.id,
    action: 'download',
    meta: { url: media.url },
  })

  // Redirect to storage URL (Cloudinary/S3/local)
  res.redirect(media.url)
}))

router.get('/qr/:momentId', authRequired, asyncHandler(async (req, res) => {
  const m = await getOwnMoment(req.user.id, req.params.momentId)
  const media = m.media?.[0]
  if (!media?.url) throw new AppError('No media', 404)

  await logExport(req.user.id, {
    momentId: m.id,
    action: 'qr',
    meta: {},
  })

  const payload = media.url.startsWith('http')
    ? media.url
    : `${config.apiUrl}${media.url.startsWith('/') ? '' : '/'}${media.url}`

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(payload)}`
  res.json({
    ok: true,
    momentId: m.id,
    mediaUrl: payload,
    caption: m.caption,
    qrImageUrl: qrUrl,
    instruction: 'Scan on your phone, download the square media, then open the official Locket app and post manually.',
    fallback: showOfficialAPIUnavailableFallback({
      momentId: m.id,
      mediaUrl: payload,
      caption: m.caption,
    }),
  })
}))

router.get('/caption/:momentId', authRequired, asyncHandler(async (req, res) => {
  const m = await getOwnMoment(req.user.id, req.params.momentId)
  await logExport(req.user.id, { momentId: m.id, action: 'copy_caption', meta: {} })
  res.json({ caption: m.caption || '' })
}))

export default router
