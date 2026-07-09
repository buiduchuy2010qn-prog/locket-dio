# Locket Dio

**Private close-friends photo & video sharing** — full-stack production app.

Original branding and UI. **Not affiliated with Locket.** We never ask for third-party passwords; “Connect Locket” only works via **official OAuth** when credentials are provided.

## Stack

| Layer | Tech |
|-------|------|
| Web | React 19, Vite, Tailwind v4, React Router |
| API | Node.js, Express, Socket.IO, Zod, Helmet, rate-limit |
| DB | PostgreSQL + Prisma |
| Media | Cloudinary (or local disk fallback) + Sharp |
| Payments | Stripe (optional; mock activate if unset) |
| Deploy | Docker Compose, Nginx |

## Monorepo layout

```
apps/web          # React SPA
apps/api          # Express REST + WebSocket
packages/shared   # Shared constants / publicUser helper
prisma/           # Schema + seed
docker/           # Dockerfiles + nginx
docs/
```

## Quick start (local)

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker)

### 2. Environment

```bash
cp .env.example .env
# Edit DATABASE_URL, JWT_SECRET
```

### 3. Database

```bash
# Start Postgres (example)
docker compose up -d db

npm install
npx prisma db push --schema=prisma/schema.prisma
npm run db:seed
```

### 4. Run

```bash
# Terminal A — API :4000
npm run dev:api

# Terminal B — Web :5173
npm run dev:web

# Or both:
npm run dev
```

Open http://localhost:5173

### Demo accounts (after seed)

| Email | Password | Role |
|-------|----------|------|
| you@locket-dio.app | demo123 | Free user |
| mina@locket-dio.app | demo123 | Gold |
| admin@locket-dio.app | demo123 | Admin |

If the API is offline, the web app **auto-falls back** to localStorage mock mode.

## API overview

| Area | Prefix |
|------|--------|
| Auth | `POST /api/auth/signup\|login\|logout`, `GET /api/auth/me` |
| Users | `PATCH /api/users/me`, `GET /api/users/search` |
| Friends | `/api/friends/*` |
| Moments | `/api/moments/*` (multipart upload) |
| Notifications | `/api/notifications/*` |
| Gold | `/api/gold/*` |
| Streaks | `/api/streaks/*` |
| Locket OAuth module | `/api/locket/*` |
| Admin | `/api/admin/*` |
| Health | `GET /health`, `GET /api/status` |

## Connect Locket (safe module)

Implemented endpoints (no password collection):

- `GET /api/locket/status` → `fetchLocketConnectionStatus`
- `POST /api/locket/connect` → `connectLocketAccount` (official OAuth only)
- `POST /api/locket/disconnect`
- `POST /api/locket/sync`

Set in `.env` only when you have **official** docs/credentials:

```
LOCKET_OAUTH_ENABLED=true
LOCKET_CLIENT_ID=...
LOCKET_CLIENT_SECRET=...
LOCKET_AUTH_URL=...
LOCKET_TOKEN_URL=...
```

## Media

- Images compressed with **Sharp**
- **Cloudinary** when `CLOUDINARY_*` set
- Otherwise files stored under `/uploads` and served at `/media/local/...`
- Video duration limits: free 5s / Gold 30s (configurable)
- Camera-roll source requires Gold

## Gold / Stripe

- Without Stripe keys: `POST /api/gold/activate` (mock subscription for staging)
- With Stripe: `POST /api/gold/checkout` returns Checkout URL
- Webhook: configure Stripe → store `ACTIVE` on `GoldSubscription`

## Docker production

```bash
cp .env.example .env
docker compose up -d --build
```

- Web: http://localhost:8080  
- API: http://localhost:4000  

## Render / VPS notes

1. Provision **PostgreSQL**
2. Deploy **API** web service (`apps/api`, start: `npx prisma migrate deploy && node apps/api/src/index.js`)
3. Deploy **static web** (`apps/web` build, env `VITE_API_URL=https://your-api...`)
4. Set secrets: `DATABASE_URL`, `JWT_SECRET`, Cloudinary, Stripe as needed

## Security checklist

- [x] bcrypt password hashing  
- [x] JWT + HTTP-only cookie option  
- [x] Helmet, CORS, rate limits  
- [x] Zod validation on auth  
- [x] Upload size / video duration limits  
- [x] No Locket password fields  
- [x] Audit log hooks  
- [x] Friends-only feed filter  

## License

Private project — original Locket Dio branding.
