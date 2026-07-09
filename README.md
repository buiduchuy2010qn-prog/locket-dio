# Locket Dio

**Independent private photo/video sharing for close friends.**

Locket Dio is an original web product. It is **not** affiliated with the official Locket app.  
No official Locket logo, assets, accounts, passwords, or private APIs.

| | |
|--|--|
| **Name** | Locket Dio (`locket-dio`) |
| **Type** | Full-stack web app |
| **Purpose** | Square 1:1 moments with friends — camera, feed, gallery, chat, streaks |

---

## Stack

| Layer | Tech |
|-------|------|
| Web | React, Vite, Tailwind CSS, React Router |
| API | Node.js, Express, Socket.IO, Zod, Helmet, rate-limit |
| DB | PostgreSQL + Prisma |
| Auth | JWT + HTTP-only cookies (+ Bearer for mobile/SPA) |
| Media | Cloudinary **or** local disk + Sharp |
| Deploy | Docker Compose, Nginx, optional Render |

> Implementation is **JavaScript ESM** for simple deploys. Structure matches a monorepo ready for gradual TypeScript.

---

## Monorepo layout

```
locket-dio/
  apps/
    web/                 # Camera UI (mobile app-like + desktop minimal white)
    api/                 # REST + Socket.IO
  packages/
    shared/              # Constants, publicUser helper
  prisma/                # Schema + seed
  docker/                # Dockerfiles + nginx
  docs/
  docker-compose.yml
  .env.example
  README.md
```

---

## Features

### Identity & auth
- Sign up / login / logout  
- Forgot + reset password  
- Email verification tokens (logged in dev if SMTP unset)  
- Protected routes, session cookie + JWT  

### Camera (1:1)
- Full-screen mobile camera (blue/black gradient)  
- Desktop: white minimal, centered square frame  
- Capture photo + record video  
- Upload from library + pan/zoom crop  
- Audience: all friends / close friends  
- Never stretch media (`object-fit: cover`)  

### Social
- Feed of friends’ moments  
- Gallery / history grid  
- Reactions (full set free)  
- Seen-by / insights  
- Friends: search, request, accept, remove, block  
- Chat/messages (DB + Socket.IO emit)  
- Notifications + badges  
- Streaks + restore  

### “Gold-style” (all free)
No ads · unlimited friends · library upload · longer video · themes · badges · profile frames · premium reactions · insights  

### Admin
- Users / moments / reports / stats / ban / delete  

---

## Quick start (local)

### Prerequisites
- Node.js **18+**
- PostgreSQL **16** (or Docker)

### 1. Env

```bash
cp .env.example .env
# Edit JWT_SECRET and DATABASE_URL if needed
```

### 2. Database

```bash
docker compose up -d db
npm install
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run db:seed
```

### 3. Run API + Web

```bash
# Terminal 1 — API :4000
npm run dev:api

# Terminal 2 — Web :5173 (proxies /api and /health → API)
npm run dev:web
```

Open **http://localhost:5173** → **Sign up** (no demo accounts).

If the API is down, the web UI falls back to **local storage mode** so you can still try the camera offline.

---

## Docker (full stack)

```bash
cp .env.example .env
# set JWT_SECRET
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Web (nginx) | http://localhost:8080 |
| API | http://localhost:4000 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

API container runs `prisma migrate deploy` (or use `db push` in dev).  
Media: Cloudinary if configured, else volume `uploads`.

---

## Environment variables

See **`.env.example`**. Critical:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | Sign sessions (long random) |
| `COOKIE_SECURE` | `true` on HTTPS |
| `CORS_ORIGIN` | Allowed web origins |
| `CLOUDINARY_*` | Optional cloud media |
| `VITE_API_URL` | Public API URL for frontend build |

---

## API overview

```
POST   /api/auth/signup|login|logout|forgot-password|reset-password
GET    /api/auth/me

GET    /api/users/search
PATCH  /api/users/me

GET    /api/moments/feed
GET    /api/moments/gallery
POST   /api/moments
DELETE /api/moments/:id
POST   /api/moments/:id/react
GET    /api/moments/:id/insights

GET    /api/friends
POST   /api/friends/request
POST   /api/friends/requests/:id/accept|decline
DELETE /api/friends/:id

GET    /api/messages/conversations
GET    /api/messages?peerId=
POST   /api/messages

GET    /api/notifications
POST   /api/notifications/read

GET    /api/streaks
POST   /api/streaks/:friendId/restore

GET/PATCH /api/gold/*

GET    /api/admin/*
GET    /health
```

Socket.IO: clients join room `user:{userId}` via `auth.userId`; events e.g. `message:new`.

---

## Media

1. Client crops to **1:1** (canvas).  
2. API accepts multipart file **or** base64 body.  
3. Validates type/size/duration.  
4. Sharp thumbnail when possible.  
5. Upload Cloudinary **or** local `/media/local/...`.  
6. Metadata in `MediaFile` + `Moment`.  

---

## Security notes

- Passwords hashed with **bcrypt**  
- HTTP-only cookies + optional Bearer token  
- Zod validation, rate limits on auth/upload/messages  
- Helmet + CORS allowlist  
- Private moments only for friends / close friends  
- Audit logs for sensitive actions  
- **Never** collect official Locket credentials  

---

## Production deploy (VPS)

1. Clone repo, set `.env` (`NODE_ENV=production`, strong `JWT_SECRET`, `COOKIE_SECURE=true`, real `DATABASE_URL`, `CORS_ORIGIN`, `VITE_API_URL`).  
2. `docker compose up -d --build` **or** run API + nginx + Postgres manually.  
3. Point domain A-records to server; TLS (Caddy/nginx/certbot).  
4. Proxy `/api` and `/socket.io` to API; static web to `apps/web/dist` or nginx container.  

### Render / static host

- Build web: `npm run build` → publish `public/`  
- Deploy API as separate Node service with Postgres  
- Set `VITE_API_URL` at **build time** to the public API URL  

---

## Scripts

```bash
npm run dev:web      # Vite
npm run dev:api      # Express watch
npm run build        # Web → public/ + dist/
npm run db:generate
npm run db:push
npm run db:seed
npm run docker:up
```

---

## Legal / product stance

- **Locket Dio** is an independent product with original branding and code.  
- Inspired by the *concept* of private close-friends moments — not a clone of proprietary assets.  
- No unofficial Locket sync, scraping, or password collection.  

---

## License

Private / your project — adjust as needed.
