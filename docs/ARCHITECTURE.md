# Architecture

## Request flow

```
Browser (React) → REST/JSON (+ cookies) → Express API → Prisma → PostgreSQL
                              ↓
                         Socket.IO (notifications)
                              ↓
                    Cloudinary / local uploads
```

## Auth

1. Signup/login issues JWT (`ld_token` cookie + body token for SPA).
2. `authRequired` middleware loads user with profile, gold, customization.
3. Password reset & email verify use hashed one-time tokens.

## Privacy

Feed authors ⊆ `{ me } ∪ friends(me)`. Blocked pairs cannot friend or appear in search results used for requests.

## Gold middleware

`requireGold`, `friendLimit`, `videoMaxSec`, `canUseCameraRoll` gate premium features. Free users still see locked UI previews on the client.
