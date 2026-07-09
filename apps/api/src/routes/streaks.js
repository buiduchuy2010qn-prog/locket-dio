import { Router } from 'express'
import { authRequired, toPublic } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requireGold } from '../lib/gold.js'

const router = Router()

router.get('/', authRequired, asyncHandler(async (req, res) => {
  const rows = await prisma.streak.findMany({
    where: { userId: req.user.id },
    include: {
      friend: { include: { profile: true, goldSubscription: true, goldCustomization: true } },
    },
    orderBy: { count: 'desc' },
  })
  res.json({
    streaks: rows.map((s) => ({
      friendId: s.friendId,
      count: s.count,
      lastPostAt: s.lastPostAt,
      broken: s.broken,
      history: s.history || [],
      user: toPublic(s.friend),
    })),
  })
}))

router.post('/:friendId/restore', authRequired, asyncHandler(async (req, res) => {
  requireGold(req.user, 'Streak restore')
  const friendId = req.params.friendId
  const s = await prisma.streak.findUnique({
    where: { userId_friendId: { userId: req.user.id, friendId } },
  })
  if (!s) throw new AppError('Streak not found', 404)

  const updated = await prisma.streak.update({
    where: { id: s.id },
    data: {
      broken: false,
      count: Math.max(1, s.count || 1),
      lastPostAt: new Date(),
      history: [1, 1, 1, 1, 1, 1, 1],
    },
  })
  res.json({ streak: updated })
}))

export default router
