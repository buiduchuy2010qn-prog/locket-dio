# Huy Locket — Agent instructions

## Branding

- **App display name:** Huy Locket (never "Locket Dio" / "Đào Văn Đôi" in UI)
- Author: Bùi Đức Huy · STK MBBank 0394709137
- Repo folder may still be `locket-dio`; Docker service: **huy-locket**

## Free for all (mandatory)

- **Huy Locket is 100% free** — open every client feature for every user.
- `src/hooks/useFeature.js` → `FREE_FOR_ALL = true` (do not re-enable plan locks casually).
- `useFeatureVisible` always `true`; generous upload limits; no FeatureGate paywall.
- Pricing page may remain for optional support/sponsors; never block core camera/post/tools.

## Keep when upgrading

1. **Google Drive backup** (`server.mjs` OAuth + Neon, `utils/googleDrive.js`, admin-only UI)
2. **Weather real data** (Dio API + Open-Meteo fallback)
3. **pinksnow** theme + snow effects
4. Deploy scripts: `npm run build:static`, `server.mjs`, Dockerfile
5. **Music caption (KNOWN GOOD — user confirmed 2026-07-14)** — do not “simplify” or rewrite casually

### Music / ISRC — baseline ổn định (đừng phá)

User: *“bản này được rồi ngon lắm”* — giữ hành vi này.

| | |
|--|--|
| **Good commit** | `474aa184` — *fix(music): always resolve valid ISRC for Locket app caption* |
| **Web** | https://huy-locket-production.up.railway.app |
| **API** | https://huy-locket-api-production.up.railway.app |

**App Locket cần:** `isrc` (12 ký tự) + `song_title` + `artist` + (`spotify_url` **và/hoặc** `apple_music_url`) + cover icon.

**Playback platform:**
- **Android** — `spotify_url` (giữ như cũ; badge ưu tiên Spotify khi có)
- **iOS** — cần thêm `apple_music_url` sạch (path + `?i=` track id) cho MusicKit; metadata vẫn hiện từ ISRC nếu thiếu Apple nhưng **không phát được**
- Khi resolve được cả hai: **gửi cả hai** — không XOR drop Apple vì đã có Spotify

**Files (đụng cẩn thận):**
- Client attach: `src/features/CustomeStudio/components/GeneralSections/index.jsx`
- Client resolve: `src/services/ExtensionsServices/MusicServices.js` (`normalizeIsrc`, `resolveMusicForLocket`)
- Server enrich: `api/src/modules/music/services/ensureMusicPayload.js`, `fetchMusicApi/index.js`
- Locket payload: `api/src/modules/moment/payloads/imagePostPayload.js` / `videoPostPayload.js` (`imagePostPayloadMusic`)
- Feed giữ pill: `src/stores/PostStores/useUploadPostStore.js`, `src/stores/MomentStores/index.js`, `MusicOverlay.jsx`

**Rules:**
- Không đăng nhạc nếu thiếu ISRC / platform URL (chặn + toast rõ)
- Server `ensureMusic` bù ISRC (Deezer → iTunes → MusicBrainz) trước post
- Server song.link: map Spotify↔Apple khi thiếu một phía (iOS cần Apple)
- Sau post: inject overlay local vào feed (Locket response hay cắt overlays)
- Merge feed: **không** ghi đè mất music overlay khi API omit
- Đổi music → test: gắn → toast có ISRC → đăng bài **mới** → web pill + app Android play + app iOS play

## Production deploy (mandatory)

**Primary host: Railway** (không dùng Render auto-deploy — hết pipeline minutes)

| Service | URL |
|---------|-----|
| **Web** | https://huy-locket-production.up.railway.app |
| **API** | https://huy-locket-api-production.up.railway.app |

Repo: `https://github.com/buiduchuy2010qn-prog/locket-dio.git` · branch **main**

After production changes: `npm run build:static` → commit `public/` + source → `git push origin main`  
→ Railway auto-deploy (Render: **tắt Auto-Deploy** trên Dashboard để khỏi spam lỗi pipeline minutes).

### Tắt auto-deploy Render (1 lần)

Dashboard Render → service **huy-locket** và **huy-locket-api** → Settings → **Auto-Deploy = No** (ho suspend service).

## API note

Internal API paths/headers (`LocketDioServices`, `X-LocketDio-Member`) stay for backend compatibility — only user-facing brand is Huy Locket.

### Backend chính (upgrade/fix)

- Path: `C:\Users\DucHuyy\.grok\bin\huy-locket-server` (Server-Locket-Dio)
- Point frontend proxy: `LOCKET_API_UPSTREAM=http://127.0.0.1:5007` on `locket-dio/server.mjs`
- Default still `https://api.locket-dio.com` if env unset

