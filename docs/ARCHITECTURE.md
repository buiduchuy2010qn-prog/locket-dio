# Locket Dio Architecture

## Overview

Independent full-stack app for private square moments between friends.

```
Browser (React SPA)
    │  JWT cookie / Bearer + credentials
    ▼
Express API (:4000)
    ├── Auth / Users / Friends / Moments
    ├── Messages + Socket.IO
    ├── Notifications / Streaks / Gold settings
    └── Admin
    │
    ├── PostgreSQL (Prisma)
    └── Cloudinary or local disk
```

## Design principles

1. **Original product** — Locket Dio branding only; no official Locket coupling.
2. **Square 1:1** — crop on client; store square media.
3. **Friends-only privacy** — feed/gallery filtered by friendship graph.
4. **Full features free** — “Gold” UI is cosmetic unlock catalog, not a paywall.
5. **Graceful offline** — web falls back to localStorage + IndexedDB if API health fails.

## Data model (high level)

- `User` + `Profile` + `Session`
- `Friendship` / `FriendRequest` / `Block`
- `Moment` + `MediaFile` + `Reaction` + `MomentView`
- `Conversation` + `ConversationMember` + `Message`
- `Notification`, `Streak`
- `GoldSubscription` / `GoldCustomization` (always ACTIVE for new users)
- `Report`, `AuditLog`

## Realtime

Socket.IO server on same HTTP port. Clients join `user:{id}`.  
Emits: `message:new`, (optional) notification pushes.

## Deployment

- **Dev:** Vite proxy `/api` → API; mock fallback if API off.
- **Docker:** web nginx :8080, api :4000, postgres, redis.
- **Static host:** build `public/` + separate API + `VITE_API_URL`.
