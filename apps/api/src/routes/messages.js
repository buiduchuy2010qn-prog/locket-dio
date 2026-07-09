import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { authRequired } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { toPublic } from '../lib/auth.js'
import { areFriends } from '../services/friends.js'
import { sanitizeText } from '@locket-dio/shared'

const router = Router()

const msgLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Message rate limit' },
})

async function findOrCreateDm(userId, peerId) {
  // Find existing 2-person conversation
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: peerId } } },
      ],
    },
    include: { members: true },
  })
  if (existing && existing.members.length === 2) return existing

  return prisma.conversation.create({
    data: {
      members: {
        create: [{ userId }, { userId: peerId }],
      },
    },
    include: { members: true },
  })
}

/** GET /api/messages/conversations */
router.get(
  '/conversations',
  authRequired,
  asyncHandler(async (req, res) => {
    const me = req.user.id
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: me },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: { include: { profile: true, goldSubscription: true, goldCustomization: true } },
              },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    })

    const conversations = memberships.map((m) => {
      const peer = m.conversation.members.find((x) => x.userId !== me)?.user
      const last = m.conversation.messages[0]
      return {
        id: m.conversation.id,
        peerId: peer?.id,
        user: toPublic(peer),
        lastMessage: last?.body || '',
        lastAt: last?.createdAt || m.conversation.updatedAt,
        conversationId: m.conversation.id,
      }
    }).filter((c) => c.user)

    res.json({ conversations })
  }),
)

/** GET /api/messages?peerId=  OR /api/messages/:conversationId */
router.get(
  '/',
  authRequired,
  asyncHandler(async (req, res) => {
    const me = req.user.id
    const peerId = req.query.peerId
    let conversationId = req.query.conversationId

    if (peerId) {
      const conv = await findOrCreateDm(me, String(peerId))
      conversationId = conv.id
    }
    if (!conversationId) throw new AppError('peerId or conversationId required', 400)

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: String(conversationId), userId: me } },
    })
    if (!member) throw new AppError('Not a member', 403)

    const messages = await prisma.message.findMany({
      where: { conversationId: String(conversationId) },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })

    res.json({
      conversationId,
      messages: messages.map((m) => ({
        id: m.id,
        fromId: m.senderId,
        toId: null,
        body: m.body,
        momentId: m.momentId,
        createdAt: m.createdAt,
      })),
    })
  }),
)

router.get(
  '/:conversationId',
  authRequired,
  asyncHandler(async (req, res) => {
    const me = req.user.id
    const conversationId = req.params.conversationId
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
    })
    if (!member) throw new AppError('Not a member', 403)

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
    res.json({
      conversationId,
      messages: messages.map((m) => ({
        id: m.id,
        fromId: m.senderId,
        body: m.body,
        momentId: m.momentId,
        createdAt: m.createdAt,
      })),
    })
  }),
)

/** POST /api/messages  body: { peerId, body } or { conversationId, body } */
router.post(
  '/',
  authRequired,
  msgLimit,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      peerId: z.string().optional(),
      conversationId: z.string().optional(),
      body: z.string().min(1).max(2000),
      momentId: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const body = sanitizeText(data.body, 2000)
    if (!body) throw new AppError('Empty message', 400)

    const me = req.user.id
    let conversationId = data.conversationId

    if (!conversationId && data.peerId) {
      if (data.peerId === me) throw new AppError('Invalid peer', 400)
      const friends = await areFriends(me, data.peerId)
      if (!friends) throw new AppError('Can only message friends', 403)
      const conv = await findOrCreateDm(me, data.peerId)
      conversationId = conv.id
    }
    if (!conversationId) throw new AppError('peerId or conversationId required', 400)

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
    })
    if (!member) throw new AppError('Not a member', 403)

    const msg = await prisma.message.create({
      data: {
        conversationId,
        senderId: me,
        body,
        momentId: data.momentId || null,
      },
    })
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    // Notify peers via Socket.IO
    const members = await prisma.conversationMember.findMany({ where: { conversationId } })
    const io = req.app.get('io')
    const payload = {
      id: msg.id,
      conversationId,
      fromId: me,
      body: msg.body,
      momentId: msg.momentId,
      createdAt: msg.createdAt,
    }
    for (const m of members) {
      if (m.userId !== me) {
        io?.to(`user:${m.userId}`).emit('message:new', payload)
        await prisma.notification.create({
          data: {
            userId: m.userId,
            actorId: me,
            type: 'SYSTEM',
            title: 'Tin nhắn mới',
            body: body.slice(0, 80),
            data: { conversationId, messageId: msg.id },
          },
        }).catch(() => {})
      }
    }

    res.status(201).json({ message: payload, conversationId })
  }),
)

export default router
