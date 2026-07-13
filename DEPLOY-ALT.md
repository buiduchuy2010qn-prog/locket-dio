# Đăng web Huy Locket chỗ khác (khi Render hết pipeline minutes)

Render **web** hết phút build → deploy fail.  
**API** `huy-locket-api.onrender.com` thường **vẫn chạy** (chỉ không rebuild được).  
Chỉ cần host lại **web** (`public/` + `server.mjs`).

---

## Khuyến nghị: Fly.io (Singapore, free allowance ~$5/tháng)

### 1. Cài CLI (Windows)

```powershell
winget install FlyCTL.flyctl
# hoặc: powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Đóng mở terminal, kiểm tra: `fly version`

### 2. Đăng nhập + tạo app

```powershell
cd C:\Users\DucHuyy\.grok\bin\locket-dio
fly auth login
fly apps create huy-locket --org personal
```

(Nếu tên `huy-locket` bị chiếm: `fly apps create huy-locket-web`)

### 3. Secret env

```powershell
fly secrets set LOCKET_API_UPSTREAM=https://huy-locket-api.onrender.com
# Optional Drive Neon:
# fly secrets set DATABASE_URL="postgresql://..."
```

### 4. Deploy (cần `public/` đã build trên máy)

```powershell
npm run build:static
fly deploy
```

URL: **https://huy-locket.fly.dev** (hoặc tên app bạn tạo)

### 5. Sửa CORS API (Render Dashboard → huy-locket-api)

Thêm domain web mới vào `CORS_ORIGINS`, ví dụ:

```text
https://huy-locket.onrender.com,https://huy-locket.fly.dev
```

(Nếu API cũng không rebuild được, CORS cũ chỉ cho `huy-locket.onrender.com` — login/API từ domain Fly có thể bị chặn. Khi đó cần đợi Render API rebuild, hoặc deploy API sang Fly luôn.)

---

## Phương án 2: Railway

1. https://railway.app → Login GitHub  
2. **New Project** → **Deploy from GitHub** → `locket-dio`  
3. Settings: **Dockerfile** (root)  
4. Variables:
   - `LOCKET_API_UPSTREAM` = `https://huy-locket-api.onrender.com`
   - `NODE_ENV` = `production`
5. Generate domain → copy URL  
6. Cập nhật `CORS_ORIGINS` trên API như trên  

Railway trial ~$5 (có thể cần thẻ); sau đó Hobby.

---

## Phương án 3: Vẫn local (không public)

```powershell
cd C:\Users\DucHuyy\.grok\bin\locket-dio
npm run build:static
$env:LOCKET_API_UPSTREAM="https://huy-locket-api.onrender.com"
$env:PORT="4200"
node server.mjs
# http://127.0.0.1:4200
```

---

## Checklist sau khi có URL web mới

| Việc | Chi tiết |
|------|----------|
| Mở trang | `https://…/login` |
| Health proxy | `https://…/dio-api/health` → JSON healthy |
| CORS API | Domain web mới trong `CORS_ORIGINS` |
| Spotify redirect | Nếu dùng OAuth Spotify: thêm redirect URI domain mới |
| Drive OAuth | Redirect URI Google Console + env nếu có |

---

## File trong repo

| File | Mục đích |
|------|----------|
| `fly.toml` | Config Fly.io |
| `railway.toml` | Gợi ý Railway |
| `Dockerfile` | Giữ nguyên — ship `public/` + `server.mjs` |

**Nhớ:** mỗi lần đổi React → `npm run build:static` trước `fly deploy` (Docker chỉ copy `public/`).
