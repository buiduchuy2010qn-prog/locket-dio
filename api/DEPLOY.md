# Huy Locket API (backend chính)

Nguồn: Server-Locket-Dio — đã nâng cấp / sửa cho client **Huy Locket**.

Thư mục: `C:\Users\DucHuyy\.grok\bin\huy-locket-server`

---

## Đã sửa / nâng cấp

| Hạng mục | Chi tiết |
|----------|----------|
| **CORS** | Không throw 500; mở localhost, Render, Railway, locket-dio, huy-locket; `CORS_ORIGINS` thêm domain |
| **Env** | Load `.env.development` / `.env.production` + fallback `.env` |
| **Redis** | Optional — server vẫn chạy single-instance nếu Redis down |
| **Weather** | WeatherAPI nếu có key; **fallback Open-Meteo** (không key) |
| **Routes** | `POST /api/weatherV2` + `POST /api/weatherV3` |
| **Health** | `/health` trả meta Huy Locket + memory |
| **Config** | Fix `maxVideoSizeBytes` NaN |
| **Banner** | HUY LOCKET API |

---

## Chạy local

```bash
cd C:\Users\DucHuyy\.grok\bin\huy-locket-server
npm install

# copy env
copy .env.example .env.development
# điền key (Firebase, Supabase, JWT…) — weather có thể để trống

npm start
# http://localhost:5007
```

Kiểm tra:

```bash
curl http://localhost:5007/health
curl http://localhost:5007/
curl -X POST http://localhost:5007/api/weatherV2 -H "Content-Type: application/json" -d "{\"lat\":21.03,\"lon\":105.85}"
```

---

## Nối client Huy Locket (`locket-dio`)

### Cách A — Proxy (khuyến nghị)

Trong `locket-dio/server.mjs`, đổi target:

```js
{ prefix: "/dio-api", target: "https://YOUR-API-HOST" }
// local:
// { prefix: "/dio-api", target: "http://127.0.0.1:5007" }
```

Client giữ `VITE_BASE_API_URL=/dio-api`.

### Cách B — Trỏ thẳng

```env
VITE_BASE_API_URL=http://localhost:5007
# production:
# VITE_BASE_API_URL=https://your-api.onrender.com
```

Thêm domain client vào env API:

```env
CORS_ORIGINS=https://huy-locket-xxx.onrender.com,https://your-custom-domain.com
```

---

## Env quan trọng

| Biến | Bắt buộc? | Ghi chú |
|------|-----------|---------|
| `PORT` | Không | Mặc định 5007 |
| `WEATHER_API_KEY` | Không | Có thì WeatherAPI; không thì Open-Meteo |
| `REDIS_URL` | Không* | *Cần nếu multi-instance socket |
| `SUPABASE_*` | Có (auth/plan) | Login/plan |
| `FIREBASE_*` / google SA | Có (Locket) | Auth Locket / Firestore |
| `LOCKETDIO_JWT_SECRET` | Có | Session |
| `COOKIE_SECRET` | Có | Cookie |
| `CORS_ORIGINS` | Nên | Domain client production |

---

## Docker

```bash
docker compose up -d --build
```

---

## Lưu ý

- **Drive OAuth** vẫn trên frontend `locket-dio/server.mjs` (Neon), không phải API này.
- Login Locket / upload moment cần đủ Firebase + reverse Locket — test từng endpoint.
- Không commit file `.env` / service account.
