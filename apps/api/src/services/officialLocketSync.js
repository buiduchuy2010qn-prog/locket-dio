/**
 * Official Locket Sync module
 * ─────────────────────────────────────────────────────────────
 * ONLY official OAuth / documented partner API.
 * NEVER: private APIs, reverse engineering, password collection,
 * token theft, fake Gold, scraping official app.
 * ─────────────────────────────────────────────────────────────
 */
import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import { config } from '../config.js'

const UNAVAILABLE_MSG =
  'Official Locket sync is unavailable because Locket does not provide a public official API/OAuth integration.'

/** Simple reversible seal for OAuth tokens (use KMS in production) */
function seal(plain) {
  if (!plain) return null
  const key = crypto.createHash('sha256').update(config.jwtSecret + ':locket-oauth').digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function unseal(blob) {
  if (!blob) return null
  try {
    const key = crypto.createHash('sha256').update(config.jwtSecret + ':locket-oauth').digest()
    const buf = Buffer.from(blob, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const data = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function checkOfficialLocketAPIAvailability() {
  const available = !!(
    config.locket.enabled &&
    config.locket.clientId &&
    config.locket.authUrl &&
    config.locket.tokenUrl
  )
  return {
    available,
    mode: available ? 'official_api' : 'export_only',
    message: available
      ? 'Official Locket OAuth is configured. Connect without sharing your Locket password.'
      : UNAVAILABLE_MSG,
    oauthEnabled: available,
  }
}

export async function fetchOfficialLocketSyncStatus(userId) {
  const availability = checkOfficialLocketAPIAvailability()
  const row = await prisma.locketConnection.findUnique({ where: { userId } })
  const recent = await prisma.syncLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  let status = row?.status || 'not_connected'
  if (!availability.available) status = 'unavailable'
  return {
    ...availability,
    status,
    connectedAt: row?.connectedAt || null,
    lastSyncAt: row?.lastSyncAt || null,
    externalUserId: row?.externalUserId || null,
    recentSyncs: recent,
  }
}

export async function startOfficialLocketOAuth(userId) {
  const availability = checkOfficialLocketAPIAvailability()
  if (!availability.available) {
    await prisma.locketConnection.upsert({
      where: { userId },
      create: { userId, status: 'unavailable', meta: { reason: 'no_official_oauth' } },
      update: { status: 'unavailable', meta: { reason: 'no_official_oauth' } },
    })
    return {
      ok: false,
      status: 'unavailable',
      error: UNAVAILABLE_MSG,
      fallback: showOfficialAPIUnavailableFallback(),
    }
  }

  const state = crypto.randomBytes(16).toString('hex')
  await prisma.locketConnection.upsert({
    where: { userId },
    create: { userId, status: 'pending', meta: { oauthState: state } },
    update: { status: 'pending', meta: { oauthState: state } },
  })

  const redirectUri = `${config.apiUrl}/api/locket/callback`
  const params = new URLSearchParams({
    client_id: config.locket.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'post.write profile.read',
  })
  const authUrl = `${config.locket.authUrl}?${params.toString()}`
  return { ok: true, status: 'pending', authUrl, state }
}

/**
 * Exchange OAuth code via official token endpoint only.
 * Requires documented LOCKET_TOKEN_URL + client credentials.
 */
export async function handleOfficialLocketOAuthCallback(userId, { code, state } = {}) {
  const availability = checkOfficialLocketAPIAvailability()
  if (!availability.available) {
    return { ok: false, status: 'unavailable', error: UNAVAILABLE_MSG }
  }
  if (!code) {
    return { ok: false, status: 'failed', error: 'Missing OAuth code' }
  }

  const row = await prisma.locketConnection.findUnique({ where: { userId } })
  if (state && row?.meta?.oauthState && row.meta.oauthState !== state) {
    return { ok: false, status: 'failed', error: 'Invalid OAuth state' }
  }

  // Official token exchange — only when docs/credentials exist
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${config.apiUrl}/api/locket/callback`,
      client_id: config.locket.clientId,
      client_secret: config.locket.clientSecret || '',
    })
    const res = await fetch(config.locket.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[OfficialLocket] token exchange failed', res.status, text.slice(0, 200))
      return {
        ok: false,
        status: 'failed',
        error: 'Official token exchange failed. Check partner API documentation.',
      }
    }
    const data = await res.json()
    await prisma.locketConnection.upsert({
      where: { userId },
      create: {
        userId,
        status: 'connected',
        accessTokenEnc: seal(data.access_token),
        refreshTokenEnc: seal(data.refresh_token),
        externalUserId: data.user_id || data.sub || null,
        scopes: data.scope || null,
        connectedAt: new Date(),
        meta: { tokenType: data.token_type || 'Bearer' },
      },
      update: {
        status: 'connected',
        accessTokenEnc: seal(data.access_token),
        refreshTokenEnc: seal(data.refresh_token),
        externalUserId: data.user_id || data.sub || null,
        scopes: data.scope || null,
        connectedAt: new Date(),
        revokedAt: null,
        meta: { tokenType: data.token_type || 'Bearer' },
      },
    })
    return { ok: true, status: 'connected' }
  } catch (e) {
    console.warn('[OfficialLocket] OAuth callback error', e.message)
    return {
      ok: false,
      status: 'failed',
      error: 'Official OAuth callback could not complete. Partner API may not be configured.',
    }
  }
}

export async function disconnectOfficialLocket(userId) {
  await prisma.locketConnection.upsert({
    where: { userId },
    create: { userId, status: 'disconnected' },
    update: {
      status: 'disconnected',
      accessTokenEnc: null,
      refreshTokenEnc: null,
      externalUserId: null,
      connectedAt: null,
      revokedAt: new Date(),
    },
  })
  return { ok: true, status: 'disconnected' }
}

export async function revokeOfficialLocketToken(userId) {
  // Official revoke endpoint would be called here when documented
  const result = await disconnectOfficialLocket(userId)
  await prisma.auditLog.create({
    data: { userId, action: 'locket.oauth.revoke', meta: { official: true } },
  }).catch(() => {})
  return { ...result, revoked: true }
}

/**
 * Upload square media to official Locket via documented API only.
 * If unavailable → skip with honest status (never fake success).
 */
export async function syncMomentToOfficialLocket(userId, momentId, { mediaUrl, caption } = {}) {
  const availability = checkOfficialLocketAPIAvailability()
  const conn = await prisma.locketConnection.findUnique({ where: { userId } })

  if (!availability.available) {
    const log = await prisma.syncLog.create({
      data: {
        userId,
        momentId,
        connectionId: conn?.id,
        status: 'skipped_unavailable',
        message: UNAVAILABLE_MSG,
      },
    })
    return {
      ok: false,
      status: 'skipped_unavailable',
      message: UNAVAILABLE_MSG,
      fallback: showOfficialAPIUnavailableFallback({ momentId, mediaUrl, caption }),
      syncLogId: log.id,
    }
  }

  if (!conn || conn.status !== 'connected' || !conn.accessTokenEnc) {
    const log = await prisma.syncLog.create({
      data: {
        userId,
        momentId,
        connectionId: conn?.id,
        status: 'not_connected',
        message: 'Connect Official Locket Account first (OAuth only).',
      },
    })
    return {
      ok: false,
      status: 'not_connected',
      message: 'Connect Official Locket Account via OAuth to enable sync.',
      syncLogId: log.id,
    }
  }

  // uploading log
  await prisma.syncLog.create({
    data: {
      userId,
      momentId,
      connectionId: conn.id,
      status: 'uploading',
      message: 'Uploading to official Locket API…',
    },
  })

  const token = unseal(conn.accessTokenEnc)
  if (!token) {
    const log = await prisma.syncLog.create({
      data: {
        userId,
        momentId,
        connectionId: conn.id,
        status: 'failed',
        message: 'Could not decrypt OAuth token',
        errorCode: 'TOKEN_DECRYPT',
      },
    })
    return { ok: false, status: 'failed', syncLogId: log.id }
  }

  // Placeholder for real documented upload endpoint
  // When Locket provides POST /v1/moments or similar, implement here ONLY.
  const uploadUrl = process.env.LOCKET_UPLOAD_URL || ''
  if (!uploadUrl) {
    const log = await prisma.syncLog.create({
      data: {
        userId,
        momentId,
        connectionId: conn.id,
        status: 'failed',
        message: 'LOCKET_UPLOAD_URL not set — waiting for official partner docs',
        errorCode: 'NO_UPLOAD_URL',
      },
    })
    return {
      ok: false,
      status: 'failed',
      message: 'Official upload endpoint not configured. Token is stored securely; no unofficial calls are made.',
      syncLogId: log.id,
    }
  }

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        media_url: mediaUrl,
        caption: caption || '',
        aspect_ratio: '1:1',
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      const log = await prisma.syncLog.create({
        data: {
          userId,
          momentId,
          connectionId: conn.id,
          status: 'failed',
          message: `Official API error ${res.status}`,
          errorCode: `HTTP_${res.status}`,
        },
      })
      console.warn('[OfficialLocket] upload failed', res.status, errText.slice(0, 150))
      return { ok: false, status: 'failed', syncLogId: log.id }
    }
    const data = await res.json().catch(() => ({}))
    await prisma.locketConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    })
    const log = await prisma.syncLog.create({
      data: {
        userId,
        momentId,
        connectionId: conn.id,
        status: 'synced',
        message: 'Synced successfully via official API',
        officialPostId: data.id || data.post_id || null,
      },
    })
    return {
      ok: true,
      status: 'synced',
      message: 'Synced successfully',
      officialPostId: log.officialPostId,
      syncLogId: log.id,
    }
  } catch (e) {
    const log = await prisma.syncLog.create({
      data: {
        userId,
        momentId,
        connectionId: conn.id,
        status: 'failed',
        message: e.message,
        errorCode: 'NETWORK',
      },
    })
    return { ok: false, status: 'failed', syncLogId: log.id, message: e.message }
  }
}

export function showOfficialAPIUnavailableFallback(ctx = {}) {
  return {
    title: 'Official Locket sync unavailable',
    message: UNAVAILABLE_MSG,
    options: [
      { id: 'download', label: 'Download square photo/video' },
      { id: 'copy_caption', label: 'Copy caption' },
      { id: 'share', label: 'Share (browser share sheet)' },
      { id: 'qr', label: 'Send to phone by QR code' },
      { id: 'manual', label: 'Open Locket app and post this manually' },
    ],
    instruction:
      'Open the official Locket app on your phone and post this media manually. locket-dio never claims unofficial posts were synced.',
    context: {
      momentId: ctx.momentId || null,
      hasMedia: !!ctx.mediaUrl,
      hasCaption: !!ctx.caption,
    },
  }
}

export async function logExport(userId, { momentId, action, meta }) {
  return prisma.exportLog.create({
    data: {
      userId,
      momentId: momentId || null,
      action,
      meta: meta || {},
    },
  })
}

// Aliases matching required function names
export const checkOfficialLocketAPIAvailability_ = checkOfficialLocketAPIAvailability
export {
  checkOfficialLocketAPIAvailability as checkOfficialLocketApiAvailability,
}
