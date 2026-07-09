import { Router } from 'express'
import Stripe from 'stripe'
import { authRequired, toPublic, loadUser, audit } from '../lib/auth.js'
import { asyncHandler, AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { config } from '../config.js'
import { userIsGold, requireGold } from '../lib/gold.js'
import { APP_ICONS, CAMERA_THEMES, BADGES, PLANS } from '@locket-dio/shared'

const router = Router()
const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null

router.get('/status', authRequired, asyncHandler(async (req, res) => {
  const gold = userIsGold(req.user)
  res.json({
    isGold: gold,
    plan: req.user.goldSubscription?.plan || null,
    status: req.user.goldSubscription?.status || 'NONE',
    currentPeriodEnd: req.user.goldSubscription?.currentPeriodEnd,
    adFree: gold,
    customization: req.user.goldCustomization,
    catalog: { icons: APP_ICONS, cameraThemes: CAMERA_THEMES, badges: BADGES, plans: PLANS },
  })
}))

/** Dev / mock activate when Stripe not configured */
router.post('/activate', authRequired, asyncHandler(async (req, res) => {
  const plan = (req.body.plan || 'MONTHLY').toUpperCase() === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
  const periodMs = plan === 'YEARLY' ? 365 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000

  await prisma.goldSubscription.upsert({
    where: { userId: req.user.id },
    create: {
      userId: req.user.id,
      status: 'ACTIVE',
      plan,
      currentPeriodEnd: new Date(Date.now() + periodMs),
    },
    update: {
      status: 'ACTIVE',
      plan,
      currentPeriodEnd: new Date(Date.now() + periodMs),
      cancelAtPeriodEnd: false,
    },
  })

  await prisma.notification.create({
    data: {
      userId: req.user.id,
      type: 'GOLD_UPDATE',
      title: 'Locket Dio Gold activated',
      body: 'Welcome — premium features unlocked.',
    },
  })
  await audit(req.user.id, 'gold.activate', { plan, mock: !stripe }, req.ip)

  const user = await loadUser(req.user.id)
  res.json({ user: toPublic(user), mock: !stripe })
}))

router.post('/cancel', authRequired, asyncHandler(async (req, res) => {
  if (stripe && req.user.goldSubscription?.stripeSubscriptionId) {
    await stripe.subscriptions.update(req.user.goldSubscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
    await prisma.goldSubscription.update({
      where: { userId: req.user.id },
      data: { cancelAtPeriodEnd: true },
    })
  } else {
    await prisma.goldSubscription.update({
      where: { userId: req.user.id },
      data: { status: 'CANCELLED', plan: null, currentPeriodEnd: null },
    })
  }
  const user = await loadUser(req.user.id)
  res.json({ user: toPublic(user) })
}))

router.post('/checkout', authRequired, asyncHandler(async (req, res) => {
  if (!stripe) {
    // Fallback: return mock checkout URL that frontend can complete via /activate
    return res.json({
      mock: true,
      message: 'Stripe not configured — use POST /api/gold/activate for mock upgrade',
      url: null,
    })
  }
  const plan = (req.body.plan || 'monthly').toLowerCase()
  const price = plan === 'yearly' ? config.stripe.priceYearly : config.stripe.priceMonthly
  if (!price) throw new AppError('Stripe price not configured', 500)

  let customerId = req.user.goldSubscription?.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      metadata: { userId: req.user.id },
    })
    customerId = customer.id
    await prisma.goldSubscription.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${config.appUrl}/app/gold?success=1`,
    cancel_url: `${config.appUrl}/app/gold?canceled=1`,
    metadata: { userId: req.user.id, plan },
  })
  res.json({ url: session.url, sessionId: session.id })
}))

router.patch('/customization', authRequired, asyncHandler(async (req, res) => {
  requireGold(req.user, 'Customization')
  const data = {}
  if (req.body.appIconId) data.appIconId = String(req.body.appIconId)
  if (req.body.cameraThemeId) data.cameraThemeId = String(req.body.cameraThemeId)
  if (req.body.badgeId) data.badgeId = String(req.body.badgeId)
  if (req.body.badgeVisible != null) data.badgeVisible = !!req.body.badgeVisible
  if (req.body.profileFrame) data.profileFrame = String(req.body.profileFrame)
  if (req.body.profileBg) data.profileBg = String(req.body.profileBg)

  await prisma.goldCustomization.upsert({
    where: { userId: req.user.id },
    create: { userId: req.user.id, ...data },
    update: data,
  })
  const user = await loadUser(req.user.id)
  res.json({ user: toPublic(user) })
}))

export default router
