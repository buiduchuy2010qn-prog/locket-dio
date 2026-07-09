import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { toPublic } from '../lib/auth.js'
import { getFriendIds } from './friends.js'
import { BASIC_REACTIONS, GOLD_REACTIONS } from '@locket-dio/shared'

const momentInclude = {
  author: { include: { profile: true, goldSubscription: true, goldCustomization: true } },
  media: true,
  reactions: { include: { user: { select: { id: true, username: true } } } },
  views: { select: { userId: true, seenAt: true } },
}

export function formatMoment(m, viewerId) {
  const reactions = {}
  for (const r of m.reactions || []) {
    if (!reactions[r.emoji]) reactions[r.emoji] = []
    reactions[r.emoji].push(r.userId)
  }
  return {
    id: m.id,
    caption: m.caption,
    visibility: m.visibility,
    createdAt: m.createdAt,
    authorId: m.authorId,
    user: toPublic(m.author),
    media: (m.media || []).map((f) => ({
      id: f.id,
      type: f.type === 'VIDEO' ? 'video' : 'image',
      url: f.url,
      thumbnailUrl: f.thumbnailUrl,
      durationSec: f.durationSec,
      width: f.width,
      height: f.height,
    })),
    // primary media helpers for UI
    type: m.media?.[0]?.type === 'VIDEO' ? 'video' : 'image',
    mediaUrl: m.media?.[0]?.url,
    reactions,
    seenBy: (m.views || []).map((v) => v.userId),
    seenCount: (m.views || []).length,
    isOwner: viewerId === m.authorId,
  }
}

export async function listFeed(userId, { cursor, limit = 20 } = {}) {
  const friendIds = await getFriendIds(userId)
  const authorIds = [...friendIds, userId]

  const moments = await prisma.moment.findMany({
    where: {
      deletedAt: null,
      authorId: { in: authorIds },
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: momentInclude,
    orderBy: { createdAt: 'desc' },
    take: Math.min(50, limit),
  })

  return {
    moments: moments.map((m) => formatMoment(m, userId)),
    nextCursor: moments.length ? moments[moments.length - 1].createdAt.toISOString() : null,
  }
}

export async function createMoment(user, { caption, visibility, mediaRecords }) {
  if (!mediaRecords?.length) throw new AppError('Media required')

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      caption: (caption || '').slice(0, 500),
      visibility: visibility === 'CLOSE_FRIENDS' ? 'CLOSE_FRIENDS' : 'FRIENDS',
      media: {
        create: mediaRecords.map((m) => ({
          ownerId: user.id,
          type: m.type,
          url: m.url,
          publicId: m.publicId,
          thumbnailUrl: m.thumbnailUrl,
          mimeType: m.mimeType,
          sizeBytes: m.sizeBytes,
          width: m.width,
          height: m.height,
          durationSec: m.durationSec,
        })),
      },
    },
    include: momentInclude,
  })

  // Notify friends
  const friendIds = await getFriendIds(user.id)
  if (friendIds.length) {
    await prisma.notification.createMany({
      data: friendIds.map((fid) => ({
        userId: fid,
        actorId: user.id,
        type: 'NEW_MOMENT',
        title: 'New moment',
        body: `${user.profile?.displayName || user.username} shared a moment`,
        data: { momentId: moment.id },
      })),
    })
  }

  // Bump streaks lightly with all friends
  const today = new Date()
  for (const fid of friendIds) {
    await prisma.streak.upsert({
      where: { userId_friendId: { userId: user.id, friendId: fid } },
      create: {
        userId: user.id,
        friendId: fid,
        count: 1,
        lastPostAt: today,
        broken: false,
        history: [1],
      },
      update: {
        count: { increment: 1 },
        lastPostAt: today,
        broken: false,
      },
    })
  }

  return formatMoment(moment, user.id)
}

export async function deleteMoment(user, momentId) {
  const m = await prisma.moment.findUnique({ where: { id: momentId }, include: { media: true } })
  if (!m || m.deletedAt) throw new AppError('Not found', 404)
  if (m.authorId !== user.id && user.role !== 'ADMIN') throw new AppError('Forbidden', 403)
  await prisma.moment.update({ where: { id: momentId }, data: { deletedAt: new Date() } })
  return { ok: true }
}

export async function reactToMoment(user, momentId, emoji) {
  const allowed = [...BASIC_REACTIONS, ...GOLD_REACTIONS]
  if (!allowed.includes(emoji)) {
    throw new AppError('Invalid reaction')
  }

  const m = await prisma.moment.findFirst({ where: { id: momentId, deletedAt: null } })
  if (!m) throw new AppError('Not found', 404)

  await prisma.reaction.upsert({
    where: { momentId_userId: { momentId, userId: user.id } },
    create: { momentId, userId: user.id, emoji },
    update: { emoji },
  })

  if (m.authorId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: m.authorId,
        actorId: user.id,
        type: 'REACTION',
        title: 'New reaction',
        body: `${user.profile?.displayName || user.username} reacted ${emoji}`,
        data: { momentId, emoji },
      },
    })
  }

  const full = await prisma.moment.findUnique({ where: { id: momentId }, include: momentInclude })
  return formatMoment(full, user.id)
}

export async function markSeen(userId, momentId) {
  await prisma.momentView.upsert({
    where: { momentId_userId: { momentId, userId } },
    create: { momentId, userId },
    update: { seenAt: new Date() },
  })
  return { ok: true }
}

export async function getInsights(user, momentId) {
  const m = await prisma.moment.findUnique({
    where: { id: momentId },
    include: {
      views: { include: { user: { include: { profile: true, goldSubscription: true, goldCustomization: true } } } },
      reactions: { include: { user: { include: { profile: true, goldSubscription: true, goldCustomization: true } } } },
    },
  })
  if (!m || m.authorId !== user.id) throw new AppError('Not found', 404)

  return {
    seenBy: m.views.map((v) => ({ user: toPublic(v.user), seenAt: v.seenAt })),
    reactions: m.reactions.map((r) => ({ emoji: r.emoji, user: toPublic(r.user) })),
    summary: {
      views: m.views.length,
      reactionCount: m.reactions.length,
    },
  }
}
