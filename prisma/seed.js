import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { APP_ICONS, CAMERA_THEMES, BADGES } from '../packages/shared/src/index.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Locket Dio…')

  for (const t of CAMERA_THEMES) {
    await prisma.cameraTheme.upsert({
      where: { id: t.id },
      create: { id: t.id, name: t.name, className: t.className, preview: t.preview },
      update: { name: t.name, className: t.className, preview: t.preview },
    })
  }
  for (const i of APP_ICONS) {
    await prisma.appIcon.upsert({
      where: { id: i.id },
      create: { id: i.id, name: i.name, gradient: i.gradient, emoji: i.emoji },
      update: { name: i.name, gradient: i.gradient, emoji: i.emoji },
    })
  }
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { id: b.id },
      create: { id: b.id, name: b.name, icon: b.icon, label: b.label },
      update: { name: b.name, icon: b.icon, label: b.label },
    })
  }

  const pw = await bcrypt.hash('demo123', 12)

  const demo = [
    { email: 'you@locket-dio.app', username: 'you', displayName: 'You', role: 'USER', gold: false },
    { email: 'mina@locket-dio.app', username: 'mina.rose', displayName: 'Mina', role: 'USER', gold: true },
    { email: 'admin@locket-dio.app', username: 'admin', displayName: 'Admin', role: 'ADMIN', gold: true },
  ]

  for (const d of demo) {
    const user = await prisma.user.upsert({
      where: { email: d.email },
      create: {
        email: d.email,
        username: d.username,
        passwordHash: pw,
        role: d.role,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: d.displayName,
            bio: d.gold ? 'Locket Dio Gold member ✨' : 'Hello from Locket Dio',
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.username}`,
          },
        },
        goldSubscription: {
          create: d.gold
            ? {
                status: 'ACTIVE',
                plan: 'MONTHLY',
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
              }
            : { status: 'NONE' },
        },
        goldCustomization: { create: {} },
        locketConnection: { create: { status: 'disconnected' } },
      },
      update: {
        passwordHash: pw,
        role: d.role,
      },
    })
    console.log('  user', user.username)
  }

  // Friend you <-> mina
  const you = await prisma.user.findUnique({ where: { username: 'you' } })
  const mina = await prisma.user.findUnique({ where: { username: 'mina.rose' } })
  if (you && mina) {
    const [a, b] = you.id < mina.id ? [you.id, mina.id] : [mina.id, you.id]
    await prisma.friendship.upsert({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      create: { userAId: a, userBId: b, status: 'ACTIVE', isClose: true },
      update: { status: 'ACTIVE' },
    })
    for (const [u, f] of [[you.id, mina.id], [mina.id, you.id]]) {
      await prisma.streak.upsert({
        where: { userId_friendId: { userId: u, friendId: f } },
        create: { userId: u, friendId: f, count: 5, lastPostAt: new Date(), history: [1, 1, 1, 1, 1] },
        update: { count: 5 },
      })
    }
  }

  console.log('Seed complete. Demo passwords: demo123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
