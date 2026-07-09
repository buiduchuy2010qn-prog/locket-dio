import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authRequired, toPublic, audit } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'

const router = Router()

router.patch('/me', authRequired, asyncHandler(async (req, res) => {
  const schema = z.object({
    displayName: z.string().min(1).max(50).optional(),
    bio: z.string().max(300).optional(),
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9._]+$/).optional(),
    darkMode: z.boolean().optional(),
    showActivity: z.boolean().optional(),
    friendsOnly: z.boolean().optional(),
    avatarUrl: z.string().url().optional().nullable(),
  })
  const body = schema.parse(req.body)

  if (body.username) {
    const un = body.username.toLowerCase()
    const taken = await prisma.user.findFirst({
      where: { username: un, NOT: { id: req.user.id } },
    })
    if (taken) throw new AppError('Username taken', 409)
    await prisma.user.update({ where: { id: req.user.id }, data: { username: un } })
  }

  await prisma.profile.update({
    where: { userId: req.user.id },
    data: {
      ...(body.displayName != null ? { displayName: body.displayName } : {}),
      ...(body.bio != null ? { bio: body.bio } : {}),
      ...(body.darkMode != null ? { darkMode: body.darkMode } : {}),
      ...(body.showActivity != null ? { showActivity: body.showActivity } : {}),
      ...(body.friendsOnly != null ? { friendsOnly: body.friendsOnly } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
    },
  })

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { profile: true, goldSubscription: true, goldCustomization: true, locketConnection: true },
  })
  await audit(req.user.id, 'profile.update', body, req.ip)
  res.json({ user: toPublic(user) })
}))

router.get('/search', authRequired, asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  if (q.length < 2) return res.json({ users: [] })

  const users = await prisma.user.findMany({
    where: {
      id: { not: req.user.id },
      isBlocked: false,
      OR: [
        { username: { contains: q } },
        { profile: { displayName: { contains: q, mode: 'insensitive' } } },
      ],
    },
    take: 20,
    include: { profile: true, goldSubscription: true, goldCustomization: true },
  })

  res.json({ users: users.map((u) => toPublic(u)) })
}))

router.get('/:username', authRequired, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username.toLowerCase() },
    include: { profile: true, goldSubscription: true, goldCustomization: true },
  })
  if (!user || user.isBlocked) throw new AppError('Not found', 404)
  res.json({ user: toPublic(user) })
}))

export default router
