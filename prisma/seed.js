/**
 * Seed catalog only (camera themes, icons, badges).
 * No demo user accounts / passwords.
 */
import { PrismaClient } from '@prisma/client'
import { APP_ICONS, CAMERA_THEMES, BADGES } from '../packages/shared/src/index.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding catalog…')

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

  console.log('Seed complete (catalog only — create users via sign up).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
