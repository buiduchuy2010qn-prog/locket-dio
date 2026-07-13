# Production = Railway (không Render)

## URL

| | |
|--|--|
| Web | https://huy-locket-production.up.railway.app |
| API | https://huy-locket-api-production.up.railway.app |
| Health proxy | https://huy-locket-production.up.railway.app/dio-api/health |

## Tắt Render auto-deploy (bắt buộc 1 lần)

Render spam lỗi *pipeline minutes* mỗi lần `git push`. Tắt:

1. https://dashboard.render.com → **huy-locket** → Settings  
2. **Auto-Deploy** → **No** (hoặc Suspend service)  
3. Làm tương tự **huy-locket-api**

## Deploy web mới (sau khi sửa code)

```bat
cd C:\Users\DucHuyy\.grok\bin\locket-dio
npm run build:static
git add -A
git commit -m "mô tả"
git push origin main
```

Railway (GitHub connected) **tự rebuild**.  
Đợi Deploy Succeeded → hard refresh trình duyệt.

### Env web (`huy-locket`)

```
LOCKET_API_UPSTREAM=https://huy-locket-api-production.up.railway.app
```

(Code cũng auto-detect `RAILWAY_ENVIRONMENT` nếu quên set.)

### Env API (`huy-locket-api`)

```
CORS_ORIGINS=https://huy-locket-production.up.railway.app
LOCKETDIO_SIGNATURE_SECRET=<cố định>
LOCKETDIO_JWT_SECRET=<cố định>
COOKIE_SECRET=<cố định>
Root Directory = api
```
