import { Router } from 'express'
import { authRequired, toPublic } from '../lib/auth.js'
import { asyncHandler } from '../lib/errors.js'
import {
  listFriends, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  removeFriend, blockUser, countFriends,
} from '../services/friends.js'
import { friendLimit } from '../lib/gold.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', authRequired, asyncHandler(async (req, res) => {
  const friends = await listFriends(req.user.id)
  const count = await countFriends(req.user.id)
  const limit = friendLimit(req.user)
  res.json({ friends, count, limit, unlimited: limit == null })
}))

router.get('/requests', authRequired, asyncHandler(async (req, res) => {
  const rows = await prisma.friendRequest.findMany({
    where: { toUserId: req.user.id, status: 'PENDING' },
    include: {
      fromUser: { include: { profile: true, goldSubscription: true, goldCustomization: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      fromUser: toPublic(r.fromUser),
    })),
  })
}))

router.post('/request', authRequired, asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim()
  const result = await sendFriendRequest(req.user, username)
  res.status(201).json(result)
}))

router.post('/requests/:id/accept', authRequired, asyncHandler(async (req, res) => {
  res.json(await acceptFriendRequest(req.user, req.params.id))
}))

router.post('/requests/:id/decline', authRequired, asyncHandler(async (req, res) => {
  res.json(await declineFriendRequest(req.user, req.params.id))
}))

router.delete('/:friendId', authRequired, asyncHandler(async (req, res) => {
  res.json(await removeFriend(req.user.id, req.params.friendId))
}))

router.post('/:friendId/block', authRequired, asyncHandler(async (req, res) => {
  res.json(await blockUser(req.user.id, req.params.friendId))
}))

export default router
