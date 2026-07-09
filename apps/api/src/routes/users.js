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
    avatarUrl: z.string().optional().nullable(),
    avatar: z.string().optional().nullable(),
    appIcon: z.string().optional(),
    cameraTheme: z.string().optional(),
    badgeStyle: z.string().optional(),
    badgeVisible: z.boolean().optional(),
    profileFrame: z.string().optional(),
    profileBg: z.string().optional(),
    notifSettings: z.record(z.any()).optional(),
    privacy: z.record(z.any()).optional(),
  })
  const body = schema.parse(req.body)
  const avatarUrl = body.avatarUrl ?? body.avatar

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
      ...(body.privacy?.showActivity != null ? { showActivity: !!body.privacy.showActivity } : {}),
      ...(body.privacy?.friendsOnly != null ? { friendsOnly: !!body.privacy.friendsOnly } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    },
  })

  // Gold-style customization (free for all)
  if (
    body.appIcon != null ||
    body.cameraTheme != null ||
    body.badgeStyle != null ||
    body.badgeVisible != null ||
    body.profileFrame != null ||
    body.profileBg != null
  ) {
    await prisma.goldCustomization.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        appIconId: body.appIcon || 'classic',
        cameraThemeId: body.cameraTheme || 'soft-pink',
        badgeId: body.badgeStyle || 'gold-star',
        badgeVisible: body.badgeVisible !== false,
        profileFrame: body.profileFrame || 'none',
        profileBg: body.profileBg || 'soft',
      },
      update: {
        ...(body.appIcon != null ? { appIconId: body.appIcon } : {}),
        ...(body.cameraTheme != null ? { cameraThemeId: body.cameraTheme } : {}),
        ...(body.badgeStyle != null ? { badgeId: body.badgeStyle } : {}),
        ...(body.badgeVisible != null ? { badgeVisible: body.badgeVisible } : {}),
        ...(body.profileFrame != null ? { profileFrame: body.profileFrame } : {}),
        ...(body.profileBg != null ? { profileBg: body.profileBg } : {}),
      },
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { profile: true, goldSubscription: true, goldCustomization: true, locketConnection: true },
  })
  await audit(req.user.id, 'profile.update', body, req.ip)
  res.json({ user: toPublic(user) })
}))

router.get('/search', authRequired, asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  if (q.length < 1) return res.json({ users: [] })

  const { getFriendIds } = await import('../services/friends.js')
  const friendIds = new Set(await getFriendIds(req.user.id))

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

  res.json({
    users: users.map((u) => ({
      ...toPublic(u),
      isFriend: friendIds.has(u.id),
    })),
  })
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
