import { Router } from 'express'
import { authRequired, toPublic } from '../lib/auth.js'
import { asyncHandler } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', authRequired, asyncHandler(async (req, res) => {
  const rows = await prisma.notification.findMany({
    where: { userId: req.user.id },
    include: { actor: { include: { profile: true, goldSubscription: true, goldCustomization: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type.toLowerCase(),
      title: n.title,
      body: n.body,
      data: n.data,
      read: !!n.readAt,
      createdAt: n.createdAt,
      actor: n.actor ? toPublic(n.actor) : null,
    })),
    unreadCount: rows.filter((n) => !n.readAt).length,
  })
}))

router.get('/unread-count', authRequired, asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, readAt: null },
  })
  res.json({ count })
}))

router.post('/read', authRequired, asyncHandler(async (req, res) => {
  const id = req.body.id
  if (id === 'all' || !id) {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    })
  } else {
    await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { readAt: new Date() },
    })
  }
  res.json({ ok: true })
}))

export default router
