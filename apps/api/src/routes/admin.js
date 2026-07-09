import { Router } from 'express'
import { authRequired, adminRequired, toPublic } from '../lib/auth.js'
import { asyncHandler } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
router.use(authRequired, adminRequired)

router.get('/stats', asyncHandler(async (_req, res) => {
  const [users, moments, goldActive, reports, uploads] = await Promise.all([
    prisma.user.count(),
    prisma.moment.count({ where: { deletedAt: null } }),
    prisma.goldSubscription.count({ where: { status: 'ACTIVE' } }),
    prisma.report.count({ where: { status: 'open' } }),
    prisma.mediaFile.count(),
  ])
  res.json({
    users,
    moments,
    goldActive,
    openReports: reports,
    uploads,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV,
  })
}))

router.get('/users', asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { profile: true, goldSubscription: true, goldCustomization: true },
  })
  res.json({ users: users.map((u) => toPublic(u)) })
}))

router.get('/reports', asyncHandler(async (_req, res) => {
  const reports = await prisma.report.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: { moment: true },
  })
  res.json({ reports })
}))

router.get('/audit', asyncHandler(async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
  })
  res.json({ logs })
}))

router.patch('/users/:id/block', asyncHandler(async (req, res) => {
  const isBlocked = !!req.body.blocked
  await prisma.user.update({ where: { id: req.params.id }, data: { isBlocked } })
  res.json({ ok: true, isBlocked })
}))

export default router
