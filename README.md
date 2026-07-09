# Locket Dio

**Private square-moment camera web app** for close friends.

- Original branding, icons, and UI (inspired by close-friends camera apps, **not** the official Locket product).
- Full-stack: React web + Express API + PostgreSQL + Prisma.
- **Official Locket sync only via official OAuth/API.** Never passwords, never private endpoints.

## Stack

| Layer | Tech |
|-------|------|
| Web | React, Vite, Tailwind CSS, React Router |
| API | Node.js, Express, Socket.IO, Zod, Helmet, rate-limit |
| DB | PostgreSQL + Prisma |
| Media | Cloudinary (or local disk) + Sharp |
| Deploy | Docker Compose, Nginx, Render static+API |

> Note: Production code is JavaScript ESM for faster deploy. Structure matches a monorepo ready for gradual TypeScript migration.

## Monorepo

```
locket-dio/
  apps/web/          # Camera UI (mobile immersive + desktop white minimal)
  apps/api/          # REST + WebSocket
  packages/shared/   # Shared constants
  prisma/            # Schema + seed
  docker/
  docs/
  docker-compose.yml
  .env.example
```

## Quick start (local)

### Prerequisites

- Node.js 18+
- PostgreSQL 16 (or Docker)

### Setup

```bash
cp .env.example .env
# Edit DATABASE_URL, JWT_SECRET

docker compose up -d db          # optional
npm install --prefix apps/web
npm install --prefix apps/api
npm install                      # root tools (prisma)

npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run db:seed                  # if seed deps installed
```

### Run

```bash
# API :4000
npm run dev:api

# Web :5173
npm run dev:web
```

Open http://localhost:5173

### Demo users (after seed)

| Email | Password | Notes |
|-------|----------|--------|
| you@locket-dio.app | demo123 | Free |
| mina@locket-dio.app | demo123 | Dio Gold (in-app) |
| admin@locket-dio.app | demo123 | Admin |

If the API is down, the web app **falls back to localStorage mock** so camera UI still works.

## Features

### Camera (1:1)

- Square camera preview PC + mobile  
- Capture / upload / crop pan+zoom  
- Audience: all friends / close friends  
- Mobile: dark/blue immersive Locket-style chrome  
- Desktop: white minimal centered square  

### Social

- Feed, gallery 3-col grid, photo detail  
- Friends, requests, block  
- Reactions, notifications, streaks  
- **Dio Gold** = in-app premium only (**not** official Locket Gold)  

### Official Locket Sync

See [docs/OFFICIAL_LOCKET_SYNC.md](docs/OFFICIAL_LOCKET_SYNC.md).

Default = **export-only** (download / share / QR / manual post).

## API map (high level)

**Auth:** `POST /api/auth/signup|login|logout|forgot-password|reset-password` · `GET /api/auth/me`  

**Moments:** `POST /api/moments` · `GET feed|gallery` · `GET/DELETE :id` · `POST :id/react` · `GET :id/seen-by`  

**Friends:** `GET /api/friends` · `POST request|accept|decline` · `DELETE :id` · `POST :id/block`  

**Notifications / Streaks / Gold:** under `/api/notifications`, `/api/streaks`, `/api/gold`  

**Official Locket:** `/api/integrations/locket/*` and `/api/locket/*`  

**Export:** `GET /api/export/download/:momentId` · `GET /api/export/qr/:momentId`  

**Health:** `GET /health` · `GET /api/status`  

## Environment

Copy `.env.example`. Critical keys:

```
DATABASE_URL=
JWT_SECRET=
CORS_ORIGIN=http://localhost:5173
APP_URL=http://localhost:5173
API_URL=http://localhost:4000
VITE_API_URL=http://localhost:4000

# Optional media
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Official Locket (only if Locket provides partner access)
LOCKET_OAUTH_ENABLED=false
LOCKET_CLIENT_ID=
LOCKET_CLIENT_SECRET=
LOCKET_AUTH_URL=
LOCKET_TOKEN_URL=
LOCKET_UPLOAD_URL=
```

## Docker production

```bash
cp .env.example .env
docker compose up -d --build
```

- Web: http://localhost:8080  
- API: http://localhost:4000  

## Render

Static frontend (existing):

- Build: `cd apps/web && npm install && npm run build && cd ../.. && node scripts/copy-web-dist.mjs`  
- Publish: `public` (or `dist`)  

Full stack: add **PostgreSQL** + **Web Service** for API (`node apps/api/src/index.js` after `prisma db push`).

## Security notes

- No Locket password fields anywhere  
- bcrypt passwords · JWT cookies · Helmet · CORS · rate limits  
- OAuth tokens AES-sealed with app secret when official mode on  
- Audit + SyncLog + ExportLog  

## License

Private project — **Locket Dio** original branding. Not affiliated with Locket.
