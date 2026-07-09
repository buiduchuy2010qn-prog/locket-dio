# Official Locket Sync

## Policy

Locket Dio may sync to the **official Locket app only** via:

- Official public API
- Official OAuth
- Official SDK
- Written partner agreement from Locket

### Forbidden

- Private / reverse-engineered endpoints  
- Asking for or storing Locket passwords  
- Token theft, session hijacking  
- Fake Gold / bypassing Locket Gold  
- Scraping or automating the official app  

## Modes

### Official API Available

Set env:

```
LOCKET_OAUTH_ENABLED=true
LOCKET_CLIENT_ID=...
LOCKET_CLIENT_SECRET=...
LOCKET_AUTH_URL=...
LOCKET_TOKEN_URL=...
LOCKET_UPLOAD_URL=...   # documented partner upload URL
```

Flow: OAuth connect → encrypted token storage → optional sync on post.

### Official API Unavailable (default)

- Automatic sync disabled  
- Honest status: `skipped_unavailable`  
- Export: download, copy caption, Web Share, QR, manual instructions  

## API

| Method | Path |
|--------|------|
| GET | `/api/integrations/locket/status` |
| POST | `/api/integrations/locket/check` |
| POST | `/api/integrations/locket/connect` |
| POST | `/api/integrations/locket/callback` |
| POST | `/api/integrations/locket/disconnect` |
| POST | `/api/integrations/locket/sync/:momentId` |
| GET | `/api/export/download/:momentId` |
| GET | `/api/export/qr/:momentId` |

Also available under `/api/locket/*` aliases.

## Functions

- `checkOfficialLocketAPIAvailability()`
- `startOfficialLocketOAuth()`
- `handleOfficialLocketOAuthCallback()`
- `disconnectOfficialLocket()`
- `revokeOfficialLocketToken()`
- `syncMomentToOfficialLocket()`
- `fetchOfficialLocketSyncStatus()`
- `showOfficialAPIUnavailableFallback()`
