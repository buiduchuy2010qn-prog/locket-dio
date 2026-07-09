import { Router } from 'express'
import multer from 'multer'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import rateLimit from 'express-rate-limit'
import { authRequired } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import {
  listFeed, createMoment, deleteMoment, reactToMoment, markSeen, getInsights,
} from '../services/moments.js'
import { uploadImageBuffer, uploadVideoFile, validateUploadSize } from '../services/media.js'
import { maxUploadBytes, videoMaxSec, canUseCameraRoll, requireGold } from '../lib/gold.js'
import { prisma } from '../lib/prisma.js'
import { formatMoment } from '../services/moments.js'

const router = Router()
const upload = multer({
  dest: path.join(os.tmpdir(), 'locket-dio'),
  limits: { fileSize: 50 * 1024 * 1024 },
})

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Upload rate limit' },
})

router.get('/feed', authRequired, asyncHandler(async (req, res) => {
  const data = await listFeed(req.user.id, {
    cursor: req.query.cursor,
    limit: Number(req.query.limit || 20),
  })
  res.json(data)
}))

router.get('/gallery', authRequired, asyncHandler(async (req, res) => {
  const filter = req.query.filter || 'all'
  const { moments } = await listFeed(req.user.id, { limit: 100 })
  let list = moments
  if (filter === 'mine') list = moments.filter((m) => m.authorId === req.user.id)
  if (filter === 'friends') list = moments.filter((m) => m.authorId !== req.user.id)
  res.json({ moments: list })
}))

router.post(
  '/',
  authRequired,
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const source = String(req.body.source || 'camera') // camera | roll
    if (source === 'roll' && !canUseCameraRoll(req.user)) {
      throw new AppError('Camera roll upload requires Gold', 403, 'GOLD_REQUIRED')
    }

    const maxBytes = maxUploadBytes(req.user)
    const durationSec = req.body.durationSec ? Number(req.body.durationSec) : null
    const syncOfficial = req.body.syncOfficial === 'true' || req.body.syncOfficial === true

    let mediaMeta
    // Path A: multipart file
    if (req.file) {
      validateUploadSize(req.file.size, maxBytes)
      const isVideo = (req.file.mimetype || '').startsWith('video/')
      if (isVideo) {
        const maxSec = videoMaxSec(req.user)
        if (durationSec && durationSec > maxSec) {
          throw new AppError(`Video max ${maxSec}s`, 400, 'VIDEO_TOO_LONG')
        }
      }
      try {
        if (isVideo) {
          mediaMeta = await uploadVideoFile(req.file.path, {
            folder: 'moments',
            filename: `v_${req.user.id}_${Date.now()}`,
            durationSec,
          })
        } else {
          const buf = await fs.readFile(req.file.path)
          mediaMeta = await uploadImageBuffer(buf, {
            folder: 'moments',
            filename: `i_${req.user.id}_${Date.now()}`,
          })
        }
      } finally {
        try { await fs.unlink(req.file.path) } catch { /* */ }
      }
    } else if (req.body.mediaBase64 || req.body.mediaUrl) {
      // Path B: already-cropped square data URL / remote URL from client
      const raw = req.body.mediaBase64 || req.body.mediaUrl
      if (String(raw).startsWith('data:image')) {
        const b64 = String(raw).split(',')[1]
        const buf = Buffer.from(b64, 'base64')
        validateUploadSize(buf.length, maxBytes)
        mediaMeta = await uploadImageBuffer(buf, {
          folder: 'moments',
          filename: `i_${req.user.id}_${Date.now()}`,
        })
      } else if (String(raw).startsWith('http')) {
        mediaMeta = {
          type: req.body.type === 'video' ? 'VIDEO' : 'IMAGE',
          url: raw,
          publicId: null,
          thumbnailUrl: raw,
          mimeType: req.body.type === 'video' ? 'video/mp4' : 'image/jpeg',
          sizeBytes: 0,
        }
      } else {
        throw new AppError('File or mediaBase64 required')
      }
    } else {
      throw new AppError('File required')
    }

    const moment = await createMoment(req.user, {
      caption: req.body.caption,
      visibility: req.body.visibility,
      mediaRecords: [mediaMeta],
    })

    // Optional official Locket sync (documented API only)
    let officialSync = null
    if (syncOfficial) {
      const { syncMomentToOfficialLocket } = await import('../services/officialLocketSync.js')
      officialSync = await syncMomentToOfficialLocket(req.user.id, moment.id, {
        mediaUrl: mediaMeta.url,
        caption: req.body.caption,
      })
    }

    const io = req.app.get('io')
    if (io) io.to(`user:${req.user.id}`).emit('moment:created', { momentId: moment.id })

    res.status(201).json({ moment, officialSync })
  }),
)

router.delete('/:id', authRequired, asyncHandler(async (req, res) => {
  res.json(await deleteMoment(req.user, req.params.id))
}))

router.post('/:id/react', authRequired, asyncHandler(async (req, res) => {
  const emoji = String(req.body.emoji || '')
  const moment = await reactToMoment(req.user, req.params.id, emoji)
  res.json({ moment })
}))

router.post('/:id/seen', authRequired, asyncHandler(async (req, res) => {
  res.json(await markSeen(req.user.id, req.params.id))
}))

router.get('/:id/insights', authRequired, asyncHandler(async (req, res) => {
  res.json(await getInsights(req.user, req.params.id))
}))

router.get('/:id', authRequired, asyncHandler(async (req, res) => {
  const m = await prisma.moment.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: {
      author: { include: { profile: true, goldSubscription: true, goldCustomization: true } },
      media: true,
      reactions: { include: { user: { select: { id: true, username: true } } } },
      views: { select: { userId: true, seenAt: true } },
    },
  })
  if (!m) throw new AppError('Not found', 404)
  res.json({ moment: formatMoment(m, req.user.id) })
}))

export default router
