import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { friendLimit } from '../lib/gold.js'
import { toPublic } from '../lib/auth.js'

function pairIds(a, b) {
  return a < b ? [a, b] : [b, a]
}

export async function countFriends(userId) {
  return prisma.friendship.count({
    where: {
      status: 'ACTIVE',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  })
}

export async function areFriends(a, b) {
  const [userAId, userBId] = pairIds(a, b)
  const f = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  })
  return f?.status === 'ACTIVE'
}

export async function getFriendIds(userId) {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  })
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId))
}

export async function listFriends(userId) {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: {
      userA: { include: { profile: true, goldSubscription: true, goldCustomization: true } },
      userB: { include: { profile: true, goldSubscription: true, goldCustomization: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const streaks = await prisma.streak.findMany({ where: { userId } })
  const streakMap = Object.fromEntries(streaks.map((s) => [s.friendId, s]))

  return rows.map((r) => {
    const friend = r.userAId === userId ? r.userB : r.userA
    const st = streakMap[friend.id]
    return {
      friendshipId: r.id,
      isClose: r.isClose,
      since: r.createdAt,
      streak: st?.count || 0,
      user: toPublic(friend),
    }
  })
}

export async function sendFriendRequest(fromUser, toUsername) {
  const to = await prisma.user.findUnique({
    where: { username: toUsername.toLowerCase() },
    include: { profile: true, goldSubscription: true, goldCustomization: true },
  })
  if (!to) throw new AppError('User not found', 404)
  if (to.id === fromUser.id) throw new AppError('Cannot friend yourself')

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: fromUser.id, blockedId: to.id },
        { blockerId: to.id, blockedId: fromUser.id },
      ],
    },
  })
  if (blocked) throw new AppError('Unable to send request', 403)

  if (await areFriends(fromUser.id, to.id)) throw new AppError('Already friends')

  const limit = friendLimit(fromUser)
  if (limit != null) {
    const count = await countFriends(fromUser.id)
    if (count >= limit) {
      throw new AppError(`Free plan limit: ${limit} friends. Upgrade to Gold.`, 403, 'FRIEND_LIMIT')
    }
  }

  const reverse = await prisma.friendRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: to.id, toUserId: fromUser.id } },
  })
  if (reverse?.status === 'PENDING') {
    return acceptFriendRequest(fromUser, reverse.id)
  }

  const existing = await prisma.friendRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: fromUser.id, toUserId: to.id } },
  })
  if (existing?.status === 'PENDING') throw new AppError('Request already sent')

  const req = await prisma.friendRequest.upsert({
    where: { fromUserId_toUserId: { fromUserId: fromUser.id, toUserId: to.id } },
    create: { fromUserId: fromUser.id, toUserId: to.id, status: 'PENDING' },
    update: { status: 'PENDING' },
  })

  await prisma.notification.create({
    data: {
      userId: to.id,
      actorId: fromUser.id,
      type: 'FRIEND_REQUEST',
      title: 'Friend request',
      body: `${fromUser.profile?.displayName || fromUser.username} wants to connect`,
      data: { requestId: req.id },
    },
  })

  return { request: req, message: `Request sent to @${to.username}` }
}

export async function acceptFriendRequest(user, requestId) {
  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } })
  if (!req || req.toUserId !== user.id) throw new AppError('Request not found', 404)
  if (req.status !== 'PENDING') throw new AppError('Request not pending')

  const limit = friendLimit(user)
  if (limit != null) {
    const count = await countFriends(user.id)
    if (count >= limit) {
      throw new AppError(`Free plan limit: ${limit} friends. Upgrade to Gold.`, 403, 'FRIEND_LIMIT')
    }
  }

  const [userAId, userBId] = pairIds(req.fromUserId, req.toUserId)

  await prisma.$transaction([
    prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
    prisma.friendship.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    }),
    prisma.streak.upsert({
      where: { userId_friendId: { userId: req.toUserId, friendId: req.fromUserId } },
      create: { userId: req.toUserId, friendId: req.fromUserId, count: 0, history: [] },
      update: {},
    }),
    prisma.streak.upsert({
      where: { userId_friendId: { userId: req.fromUserId, friendId: req.toUserId } },
      create: { userId: req.fromUserId, friendId: req.toUserId, count: 0, history: [] },
      update: {},
    }),
    prisma.notification.create({
      data: {
        userId: req.fromUserId,
        actorId: user.id,
        type: 'FRIEND_ACCEPTED',
        title: 'Friend request accepted',
        body: `${user.profile?.displayName || user.username} accepted your request`,
      },
    }),
  ])

  return { ok: true }
}

export async function declineFriendRequest(user, requestId) {
  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } })
  if (!req || req.toUserId !== user.id) throw new AppError('Request not found', 404)
  await prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'DECLINED' } })
  return { ok: true }
}

export async function removeFriend(userId, friendId) {
  const [userAId, userBId] = pairIds(userId, friendId)
  await prisma.friendship.deleteMany({ where: { userAId, userBId } })
  await prisma.streak.deleteMany({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  })
  return { ok: true }
}

export async function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) throw new AppError('Invalid')
  await removeFriend(blockerId, blockedId)
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  })
  return { ok: true }
}
