import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
dotenv.config()

function req(name, fallback) {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') {
    if (process.env.NODE_ENV === 'production' && !fallback) {
      console.warn(`[config] Missing env ${name}`)
    }
  }
  return v
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  appName: 'Locket Dio',
  appUrl: req('APP_URL', 'http://localhost:5173'),
  apiUrl: req('API_URL', 'http://localhost:4000'),
  databaseUrl: req('DATABASE_URL', 'postgresql://locket:locket@localhost:5432/locket_dio?schema=public'),
  jwtSecret: req('JWT_SECRET', 'dev-only-change-me-locket-dio-jwt-secret-32chars'),
  jwtExpires: req('JWT_EXPIRES', '7d'),
  cookieName: 'ld_token',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  freeFriendLimit: Number(process.env.FREE_FRIEND_LIMIT || 99999),
  freeVideoMaxSec: Number(process.env.FREE_VIDEO_MAX_SEC || 300),
  goldVideoMaxSec: Number(process.env.GOLD_VIDEO_MAX_SEC || 300),
  freeMaxUploadMb: Number(process.env.FREE_MAX_UPLOAD_MB || 200),
  goldMaxUploadMb: Number(process.env.GOLD_MAX_UPLOAD_MB || 200),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'locket-dio',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceMonthly: process.env.STRIPE_PRICE_MONTHLY || '',
    priceYearly: process.env.STRIPE_PRICE_YEARLY || '',
  },
  locket: {
    // Only set when official OAuth credentials are available
    clientId: process.env.LOCKET_CLIENT_ID || '',
    clientSecret: process.env.LOCKET_CLIENT_SECRET || '',
    authUrl: process.env.LOCKET_AUTH_URL || '',
    tokenUrl: process.env.LOCKET_TOKEN_URL || '',
    enabled: process.env.LOCKET_OAUTH_ENABLED === 'true',
  },
  smtp: {
    // Optional email — logs tokens in dev if unset
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Locket Dio <noreply@locket-dio.local>',
  },
}
