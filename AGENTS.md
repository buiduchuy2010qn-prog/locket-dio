# Huy Locket — Agent instructions

## Branding

- **App display name:** Huy Locket (never "Locket Dio" / "Đào Văn Đôi" in UI)
- Author: Bùi Đức Huy · STK MBBank 0394709137
- Repo folder may still be `locket-dio`; Docker service: **huy-locket**

## Keep when upgrading

1. **Google Drive backup** (`server.mjs` OAuth + Neon, `utils/googleDrive.js`, admin-only UI)
2. **Weather real data** (Dio API + Open-Meteo fallback)
3. **pinksnow** theme + snow effects
4. Deploy scripts: `npm run build:static`, `server.mjs`, Dockerfile

## Production deploy (mandatory)

Service: **huy-locket** · Docker · Singapore  
Repo: `https://github.com/buiduchuy2010qn-prog/locket-dio.git` · branch **main**

After production changes: commit + `git push origin main`.

## API note

Internal API paths/headers (`LocketDioServices`, `X-LocketDio-Member`) stay for backend compatibility — only user-facing brand is Huy Locket.

### Backend chính (upgrade/fix)

- Path: `C:\Users\DucHuyy\.grok\bin\huy-locket-server` (Server-Locket-Dio)
- Point frontend proxy: `LOCKET_API_UPSTREAM=http://127.0.0.1:5007` on `locket-dio/server.mjs`
- Default still `https://api.locket-dio.com` if env unset

