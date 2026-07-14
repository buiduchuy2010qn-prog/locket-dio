# HANDOFF — Huy Locket (copy sang Grok acc khác)

> Cập nhật: **2026-07-14**  
> Mục đích: paste file này (hoặc toàn bộ block) vào session Grok mới để tiếp tục dự án.

---

## 0. ⭐ Music — BẢN NGON (user confirmed)

> **2026-07-14 — User: “bản này được rồi ngon lắm rồi nhớ nha”**  
> **Không rewrite / “cải tiến” luồng nhạc nếu không có bug mới rõ ràng.**

| | |
|--|--|
| **Known-good commit** | **`474aa184`** `fix(music): always resolve valid ISRC for Locket app caption` |
| **Branch** | `main` (đã deploy Railway) |
| **Web** | https://huy-locket-production.up.railway.app |
| **API** | https://huy-locket-api-production.up.railway.app |

App Locket hiện pill nhạc khi payload có: **ISRC 12 ký tự** + title + artist + **Spotify hoặc Apple URL** + cover.  
Server resolve ISRC (Deezer / iTunes / MusicBrainz). Client chặn attach nếu thiếu. Feed inject overlay sau post.

Chi tiết file + rules: **`AGENTS.md` → section Music / ISRC**.

---

## 1. Dự án là gì?

| Mục | Giá trị |
|-----|---------|
| **Tên UI** | **Huy Locket** (không hiện brand "Locket Dio" / "Đào Văn Đôi") |
| **Tác giả** | Bùi Đức Huy · STK MBBank `0394709137` · email `buiduchuy2010qn@gmail.com` |
| **Admin Gmail (Drive UI)** | `buiduchuy2010qn@gmail.com` |
| **Repo folder local** | `C:\Users\DucHuyy\.grok\bin\locket-dio` (tên folder cũ) |
| **GitHub** | `https://github.com/buiduchuy2010qn-prog/locket-dio.git` |
| **Branch deploy** | `main` |
| **Commit HEAD (music OK)** | `474aa184` — *fix(music): always resolve valid ISRC…* |

### Production URLs (chính = Railway)

| Service | URL |
|---------|-----|
| **Web** | https://huy-locket-production.up.railway.app |
| **API** | https://huy-locket-api-production.up.railway.app |
| Health web proxy | https://huy-locket-production.up.railway.app/dio-api/health |
| Health API | https://huy-locket-api-production.up.railway.app/health |
| Login | https://huy-locket-production.up.railway.app/login |
| Camera | https://huy-locket-production.up.railway.app/locket |

**Render** (legacy, tắt Auto-Deploy nếu hết minutes): `huy-locket.onrender.com` / `huy-locket-api.onrender.com`

---

## 2. Kiến trúc (rất quan trọng)

```
Browser
  └─ https://huy-locket.onrender.com   (Web Service Docker)
        ├─ static: public/  (Vite build SPA)
        ├─ server.mjs
        │    ├─ /dio-api/*      → LOCKET_API_UPSTREAM  (= huy-locket-api trên Render)
        │    ├─ /dio-auth/*     → https://auth.locket-dio.com   (upstream Dio chính thức)
        │    ├─ /dio-data/*     → https://data.locket-dio.com
        │    ├─ /dio-storage/*  → https://storage.locket-dio.com  (prod client trỏ storage qua /dio-api)
        │    ├─ /dio-media, /dio-cdn, /dio-export, /dio-payment ...
        │    ├─ /dio-r2-put     → proxy PUT R2 (tránh CORS)
        │    └─ /api/drive-*    → Google Drive OAuth + backup (Neon)
        └─ Origin spoof: https://locket-dio.com  (để Dio CORS chấp nhận)

huy-locket-api (folder api/)
  └─ Node Express (clone Server-Locket-Dio / huy-locket-server)
  └─ Login Locket, upload, weather, socket, ...
```

### Client env production (`.env.production`)

```env
VITE_BASE_API_URL=/dio-api
VITE_DATA_API_URL=/dio-data
VITE_STORAGE_API_URL=/dio-api
VITE_MEDIA_API_URL=/dio-media
VITE_CDN_URL=/dio-cdn
VITE_CHAT_SERVER_URL=api.locket-dio.com
VITE_LOCKET_API_URL=https://api.locketcamera.com
VITE_EXPORTS_API_URL=/dio-export
VITE_AUTH_API_URL=/dio-auth
VITE_PUBLIC_API_KEY=LKD-LOCKETDIO-AB02F55KYM55DD02MM03YY25-LKD
VITE_ADMIN_EMAILS=buiduchuy2010qn@gmail.com
VITE_SPOTIFY_CLIENT_ID=1f89199367264178a0b8c66d7e74c1d6
```

API key public (Dio client): `LKD-LOCKETDIO-AB02F55KYM55DD02MM03YY25-LKD`  
Firebase key (login Identity Toolkit): set `FIREBASE_API_KEY` trên Railway/Render Variables — **không commit key**

### `render.yaml` (Blueprint)

- **huy-locket**: Docker root `Dockerfile`, env `LOCKET_API_UPSTREAM` = URL service `huy-locket-api`
- **huy-locket-api**: `rootDir: api`, health `/health`, `CORS_ORIGINS=https://huy-locket.onrender.com`
- Secrets sync:false trên Dashboard: `DATABASE_URL` (Neon), Spotify client id/secret

### Secrets / Dashboard (KHÔNG commit — lấy trên Render)

- `DATABASE_URL` — Neon Postgres (Google Drive OAuth bền)
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` (API server)
- `COOKIE_SECRET`, `LOCKETDIO_JWT_SECRET`, `LOCKETDIO_SIGNATURE_SECRET` (generate trên Render)
- Optional: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEATHER_API_KEY`, VAPID, Drive OAuth env

**Lưu ý:** secret thật nằm trên Render Dashboard + máy local `.env` / `.env.local` — không dump password vào chat.

---

## 3. Cấu trúc thư mục chính

```
C:\Users\DucHuyy\.grok\bin\locket-dio\
├── server.mjs              # Web server: static + proxy + Drive
├── Dockerfile              # Web image (public/ + server.mjs)
├── render.yaml             # Blueprint web + api free
├── package.json            # name: huy-locket, build:static, start: node server.mjs
├── public/                 # Build production SPA (deploy cái này)
├── dist/                   # Vite out (copy → public qua prepare-static)
├── src/                    # React client source
│   ├── App.jsx             # wake API + routes
│   ├── config/webConfig.js # branding + CONFIG
│   ├── libs/
│   │   ├── axios.js        # auth API client + toast errors
│   │   ├── createBase.js   # axios factory + cold-start retry
│   │   ├── instanceAuth.js
│   │   └── ...
│   ├── pages/              # UI pages (Login, Locket camera, ...)
│   ├── services/           # LocketDioServices, etc.
│   └── stores/             # zustand auth/friends/...
├── api/                    # Backend deploy (huy-locket-api)
│   ├── app.js
│   ├── Dockerfile
│   └── src/
├── AGENTS.md               # rule agent trong repo
├── HUONG-DAN-RENDER.md
├── DEPLOY.txt / DEPLOY-API.md
└── HANDOFF-GROK.md         # file này
```

### Workspace liên quan (cùng máy)

| Path | Ý nghĩa |
|------|---------|
| `C:\Users\DucHuyy\.grok\bin\locket-dio` | **Chính** — client + server.mjs + api/ |
| `C:\Users\DucHuyy\.grok\bin\huy-locket-server` | Backend dev/local (port 5007), nguồn gốc API |
| `C:\Users\DucHuyy\.grok\bin\ai-pro-store` | Shop khác (Flask), URL ai-pro-store.onrender.com |
| `C:\Users\DucHuyy\.grok\bin\piclet-gold` | Project phụ |
| `C:\Users\DucHuyy\.grok\bin\locket-gold` | Static legacy |
| `C:\Users\DucHuyy\.grok\bin\neo-hub` | Hub static |

---

## 4. Lệnh thường dùng

### Local web (proxy)

```bat
cd C:\Users\DucHuyy\.grok\bin\locket-dio
START-LOCKET.bat
:: hoặc
set PORT=4200
node server.mjs
:: http://127.0.0.1:4200
```

### Local API riêng

```bat
cd C:\Users\DucHuyy\.grok\bin\huy-locket-server
:: hoặc locket-dio\api
npm start
:: http://localhost:5007
```

Nối local: set `LOCKET_API_UPSTREAM=http://127.0.0.1:5007` khi chạy `server.mjs`,  
hoặc `START-WITH-LOCAL-API.bat`.

### Build production static (bắt buộc trước deploy nếu đổi src/)

```bat
cd C:\Users\DucHuyy\.grok\bin\locket-dio
npm run build:static
:: = clean public artifacts → vite build → copy dist → public
```

### Deploy

```bat
git add -A
git commit -m "mô tả"
git push origin main
:: Render auto rebuild huy-locket (+ api nếu đổi api/)
```

Docker web chỉ copy `public/` + `server.mjs` — **đổi React mà không `build:static` thì production không đổi UI**.

---

## 5. Vấn đề vừa fix (2026-07-13) — API cold start

### Triệu chứng user thấy

Toast xanh:  
`API đang khởi động (Render free). Đợi 10–20 giây rồi thử lại.`

### Root cause

1. Render **free** sleep API sau ~15 phút không traffic.
2. Web vẫn warm; gọi `/dio-api/*` → proxy tới `huy-locket-api` đang ngủ.
3. Socket **abort ~0.3s** (không đợi 30s cold start) → client 502 → toast.
4. Gọi thẳng `https://huy-locket-api.onrender.com/health` lúc ngủ: ~**32s** rồi 200.

### Fix đã merge (`e8360cf`)

| File | Thay đổi |
|------|----------|
| `server.mjs` | Proxy retry 8 lần (~60s) khi ECONNRESET/socket hang up/502/503; `wakeApiUpstream()` lúc boot + mỗi 12 phút |
| `src/libs/createBase.js` | Retry gateway/network 6 lần (~40s) |
| `src/libs/axios.js` | Bỏ double-retry; toast sau khi retry hết |
| `src/libs/instanceAuth.js` | Dùng `createHttpClient` (có retry) |
| `src/App.jsx` | Poll `/dio-api/health` lúc mở app; keep-alive 10 phút khi tab mở |

### Giới hạn còn lại

- Free tier **vẫn sleep** — lần đầu sau ngủ có thể chờ 20–40s (tự retry).
- Muốn hết cold start: upgrade **Starter** cho `huy-locket-api` (và/hoặc web).

---

## 6. Tính năng / commit gần đây (để biết context)

| Commit | Nội dung |
|--------|----------|
| `e8360cf` | Cold start proxy/API |
| `6a65dba` | revert camera MediaPreview về bản ổn 22:04 |
| `018618a` / `f98f60d` / `36dcbe2` | Zoom pills camera 0.5/1/2/3(/5) |
| `a75efa9` / `b416c31` / `b9c9cb5` | Spotify: search name, oEmbed, live caption OAuth |
| `0e54cf5` | Friends list empty cache re-fetch |
| `64fd051` | Camera perf: tránh double getUserMedia |
| `667d7c7` | Drive: ẩn menu user thường; silent backup |
| `e966fa0` | Logout → public home hard redirect |

### Branding rules (AGENTS.md)

- UI: **Huy Locket** only  
- Giữ: Google Drive backup (Neon + OAuth), weather (Open-Meteo fallback), theme **pinksnow**, `build:static` + `server.mjs`  
- Internal API names/headers LocketDio **giữ** cho tương thích backend  

### Drive backup

- Shared 1 Drive cho cả site; UI admin-only (`VITE_ADMIN_EMAILS`)
- OAuth + config lưu Neon (`DATABASE_URL`) + file `data/gdrive-config.json`
- Routes: `/api/drive-status`, `drive-config`, `drive-oauth-start`, `drive-oauth-callback`, `drive-backup`

### Camera / upload

- Storage self-host: `VITE_STORAGE_API_URL=/dio-api` (tránh Malformed token storage Dio)
- Image path hay dùng base64 inline (ổn định Render free) — xem `StorageServices.js`

---

## 7. File code “điểm chạm” khi debug

| Việc | File |
|------|------|
| Proxy / cold start | `server.mjs` |
| Toast 502 Render | `src/libs/axios.js` |
| Axios retry | `src/libs/createBase.js` |
| Wake API on load | `src/App.jsx` |
| API base URL | `src/config/webConfig.js`, `.env.production` |
| Auth login/refresh | `src/libs/instanceAuth.js`, stores auth |
| Socket | `src/config/apiConfig.js` → `resolveSocketIoConfig`, path `/dio-api/socket.io` |
| Deploy env map | `render.yaml` |
| Backend health/CORS | `api/app.js`, `api/src/routes/index.js` |
| Branding | `src/config/webConfig.js`, `AGENTS.md` |

---

## 8. Checklist agent mới

1. Làm việc trong `C:\Users\DucHuyy\.grok\bin\locket-dio` (hoặc clone repo GitHub).
2. Đổi UI/src → `npm run build:static` → commit `public/` + source → `git push origin main`.
3. Chỉ đổi proxy/Drive → commit `server.mjs` (không cần full vite build).
4. Chỉ đổi API → sửa `api/` (hoặc sync từ `huy-locket-server`) → push → service `huy-locket-api` rebuild.
5. Không đổi brand UI sang Locket Dio.
6. Free Render: expect cold start; đừng “fix” bằng cách xóa toast mà không retry.
7. Secrets: Render Dashboard / local `.env` — không commit secret mới.
8. Test sau deploy:
   - `GET /` → 200 HTML  
   - `GET /dio-api/health` → JSON healthy  
   - Login → `/locket` camera  

---

## 9. Prompt gợi ý paste vào Grok acc mới

```
Tiếp tục dự án Huy Locket.

Local: C:\Users\DucHuyy\.grok\bin\locket-dio
GitHub: https://github.com/buiduchuy2010qn-prog/locket-dio.git (branch main)
Web: https://huy-locket.onrender.com
API: https://huy-locket-api.onrender.com
Chi tiết full: đọc HANDOFF-GROK.md và AGENTS.md trong repo.

Kiến trúc: server.mjs proxy /dio-api → huy-locket-api (Render free).
Mới fix cold start (commit e8360cf): proxy retry + client retry + wake health.

Quy tắc: brand Huy Locket; build:static trước deploy UI; push main auto Render.
[Mô tả task tiếp theo ở đây]
```

---

## 10. Liên hệ / tài khoản liên quan

| Hệ thống | Ghi chú |
|----------|---------|
| GitHub | `buiduchuy2010qn-prog` / repo `locket-dio` |
| Render | services `huy-locket`, `huy-locket-api` |
| Neon | `DATABASE_URL` cho Drive OAuth |
| Spotify Dev | Client ID public trong `.env.production` |
| MBBank ủng hộ | 0394709137 · BUI DUC HUY |
| Discord/Telegram community | trong `webConfig.js` community block |

---

*File này là snapshot handoff — khi thay đổi lớn (URL, kiến trúc, secret layout), cập nhật lại section tương ứng.*
