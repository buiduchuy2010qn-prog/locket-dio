# Cách chạy Huy Locket trên Render (login được)

## Vì sao Static Site login fail?

- Site tĩnh **không chạy** Node.
- API `api.locket-dio.com` **chặn CORS** domain `*.onrender.com`.
- Cần **Web Service Docker** chạy `server.mjs` (proxy `/dio-api` → API Dio).

## Làm đúng 1 lần (5–10 phút)

### Bước 1 — Tạo Web Service mới

1. Vào https://dashboard.render.com  
2. **New +** → **Web Service**  
3. Connect GitHub repo: `buiduchuy2010qn-prog/locket-dio`  
4. Branch: `main`

### Bước 2 — Cấu hình

| Mục | Giá trị |
|-----|---------|
| **Name** | `locket-dio-web` (hoặc tên bất kỳ) |
| **Region** | Singapore (gần VN) |
| **Runtime** | **Docker** |
| **Instance type** | Free |
| **Dockerfile path** | `./Dockerfile` |

Không chọn Static Site.

### Bước 3 — Deploy

Bấm **Create Web Service** → đợi build xanh (2–5 phút).

### Bước 4 — Kiểm tra

Mở:

```
https://TÊN-SERVICE.onrender.com/dio-api/
```

**Đúng:** `{"message":"🚀 Server is running!"}`  

**Sai:** trang HTML / 404 → đang nhầm Static Site.

Rồi mở:

```
https://TÊN-SERVICE.onrender.com/login
```

Đăng nhập email + mật khẩu app Locket.

### Bước 5 — Dọn Static cũ

- Vào service **locket-dio** (Static) → Settings → **Delete**  
  (tránh nhầm URL `locket-dio-ly9t.onrender.com`)

Hoặc giữ Static nhưng **chỉ dùng URL Web Service mới**.

## Free tier

- App **ngủ** khi không ai vào ~15 phút.  
- Lần mở đầu có thể **chờ 30–60 giây** (cold start).

## Local (máy bạn)

```bat
START-LOCKET.bat
```

hoặc:

```bat
set PORT=4200
node server.mjs
```

Mở http://127.0.0.1:4200/login
