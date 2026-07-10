# Huy Locket monorepo

| Path | Role |
|------|------|
| `/` (root Dockerfile) | Web SPA + Drive + proxy — service **huy-locket** |
| `/api` | Backend API (from Server-Locket-Dio) |

## Deploy API on Railway (new service)

1. New Service → Deploy from GitHub → same repo `locket-dio`
2. Settings → Root Directory: `api`
3. Builder: Dockerfile (`api/Dockerfile`)
4. Variables:
   - NODE_ENV=production
   - COOKIE_SECRET=(random)
   - LOCKETDIO_JWT_SECRET=(random)
   - CORS_ORIGINS=https://YOUR-WEB-URL
   - Optional: FIREBASE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WEATHER_API_KEY, REDIS_URL
5. After API is live, set on **web** service env:
   - LOCKET_API_UPSTREAM=https://YOUR-API-PUBLIC-URL

Health check path: `/health`
