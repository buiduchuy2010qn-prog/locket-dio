## 🧩 Locket Dio Backend Server

Backend chính của hệ thống Locket Dio, xây dựng trên **Node.js + Express** với **Socket.IO**, **Redis adapter**, **Firestore**, **Supabase**, xử lý media bằng **FFmpeg** và nhiều tiện ích khác.

---

## ⚙️ Yêu cầu môi trường

- **Node.js**: khuyến nghị >= 18.x
- **npm**: đi kèm Node (hoặc **pnpm/yarn** nếu bạn quen dùng)
- **Redis** (nếu chạy chế độ cluster / dùng adapter): cài local hoặc dùng URL dịch vụ Redis
- Tài khoản / cấu hình dịch vụ:
  - Google Cloud Firestore (service account JSON)
  - Supabase (URL, key)
  - Cloud Storage / R2 / CDN… (tùy cấu hình của dự án)

---

## 📦 Cài đặt & chạy server

Tất cả các lệnh dưới đây chạy trong thư mục `server/`.

- **Cài package**:

```bash
cd server
npm install
```

- **Chạy production (mặc định script hiện tại)**:

```bash
npm start
```

Script này tương đương:

```bash
node app.js
```

- **Chạy kèm nodemon (dev, gợi ý)**:

Trong máy bạn đã cài `nodemon` global:

```bash
npm install -g nodemon
nodemon app.js
```

Hoặc có thể bổ sung script (nếu muốn) trong `package.json`:

```json
"scripts": {
  "start": "node app.js",
  "dev": "nodemon app.js"
}
```

---

## 🔐 Biến môi trường (`.env.*`)

File `app.js` đang load env theo `NODE_ENV`:

```js
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
dotenv.config({ path: envFile });
```

Bạn nên tạo tối thiểu:

- `.env.development` – dùng khi dev local
- `.env.production` – dùng khi build/prod

Ví dụ mẫu (tùy chỉnh lại theo hạ tầng thật của bạn):

```env
PORT=5007

# Redis cho Socket.IO adapter
REDIS_URL=redis://127.0.0.1:6379

# Firestore / Firebase Admin
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
FIREBASE_PROJECT_ID=your_project_id

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT / bảo mật
JWT_SECRET=your_jwt_secret_here

# Cấu hình khác phục vụ services (Spotify, Apple Music, Push, Analytics...)
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
PUSH_VAPID_PUBLIC_KEY=...
PUSH_VAPID_PRIVATE_KEY=...
```

Các env thực tế có thể nằm rải rác trong các file `src/config`, `src/libs`, `src/services/**`. Khi deploy, nhớ mapping đầy đủ các biến này trong môi trường runtime.

---

## 🧱 Cấu trúc thư mục chính

Mô tả tổng quan trong thư mục `server/`:

```text
server/
├── app.js                 # Entry chính: khởi tạo Express, Socket.IO, Redis adapter, middleware, routes
├── Dockerfile             # Docker image cho backend
├── docker-compose.yml     # Chạy stack (Redis, server, v.v.) bằng docker-compose
├── google/                # Định nghĩa protobuf / file liên quan Google APIs
├── install_ffmpeg.sh      # Script cài FFmpeg (support xử lý media)
├── logs/                  # Log file khi chạy server (nếu cấu hình)
├── node_modules/          # Thư viện Node (tự sinh sau npm install)
├── package.json           # Metadata dự án + scripts + dependencies
├── package-lock.json      # Khóa phiên bản dependency
├── SECURITY.md            # Chính sách bảo mật
├── vercel.json            # Cấu hình deploy cho Vercel (nếu dùng)
└── src/                   # Mã nguồn chính của backend
```

Chi tiết hơn trong `src/`:

```text
src/
├── config/                    # Cấu hình chung (app, Firebase, Supabase...)
│   ├── app.config.js          # Cấu hình ứng dụng (một số constants / options)
│   ├── firebaseApiMap.js      # Mapping API Firebase
│   └── supabase.js            # Khởi tạo client Supabase
│
├── libs/                      # Các instance / client dùng chung
│   ├── index.js               # Export tổng hợp các libs
│   ├── instanceAppcheck.js    # Firebase App Check
│   ├── instanceFirebase.js    # Firebase app
│   ├── instanceFirestore.js   # Firestore client
│   ├── instanceGoogleBase.js  # Google base client
│   └── instanceLocket.js      # Client cho API nội bộ Locket
│
├── routes/                    # Định nghĩa REST routes
│   ├── index.js               # Gắn toàn bộ routes vào Express app
│   ├── authRoutes.js          # Auth, login, token...
│   ├── locketRoutes.js        # Locket moments, actions...
│   ├── planRoutes.js          # Plan / subscription / token plans
│   ├── systemRoutes.js        # Route hệ thống (health, system info...)
│   ├── rpgcRoutes.js          # Route cho RPGC module
│   └── collabRoutes.js        # Các route collab đặc biệt (DioxChisadin...)
│
├── controllers/               # Controller cho từng domain
│   ├── index.js               # Export các controller
│   ├── authController.js      # Đăng nhập, xác thực, token...
│   ├── MomentController.js    # Xử lý moment (post, list, action...)
│   ├── ChatController.js      # Xử lý chat / tin nhắn
│   ├── postController.js      # Các thao tác post chung
│   ├── plansController.js     # Gói dịch vụ / plan
│   ├── FriendsController.js   # Bạn bè / friend request
│   ├── pushController.js      # Push config / token
│   ├── pushSendController.js  # Gửi push notifications
│   ├── weatherController.js   # Dịch vụ thời tiết (DioServices)
│   └── spotifyController.js   # Spotify meta + liên quan nhạc
│
├── services/                  # Lớp service (business logic)
│   ├── index.js               # Export tổng
│   ├── AuthSecurity/          # Các dịch vụ liên quan auth, token, bảo mật
│   │   ├── index.js
│   │   ├── AuthServices.js
│   │   ├── AuthWithPhone.js
│   │   └── GetInfoUser.js
│   ├── LocketMoment/          # Nghiệp vụ Moment (ảnh, video, analytics...)
│   │   ├── index.js
│   │   ├── PostImageMoment.js
│   │   ├── PostVideoMomentV2.js
│   │   ├── ActionMoments.js
│   │   └── ...
│   ├── LocketFriend/          # Bạn bè, request
│   │   ├── index.js
│   │   ├── FriendsServices.js
│   │   └── RequestServices.js
│   ├── LocketChat/            # Chat / tin nhắn
│   │   ├── index.js
│   │   └── getAllMessage.js
│   ├── LocketAnalytics/       # Thống kê / log analytics
│   │   ├── index.js
│   │   └── createAnalytics.js
│   └── DioServices/           # Các dịch vụ riêng của Dio (Spotify, Weather, Push...)
│       ├── index.js
│       ├── DioSecurity.js
│       ├── SpotifyDio.js
│       ├── SpotifyDioV2.js
│       ├── GetMetaAppleMusic.js
│       ├── PushServices.js
│       ├── WeatherServices.js
│       └── UpTodateStats.js
│
├── middlewares/               # Middleware Express
│   ├── errorHandler.js        # Xử lý lỗi tập trung
│   ├── log-events.js          # Log events hệ thống
│   ├── logRequestInfo.js      # Log thông tin request
│   ├── rateLimit.js           # Giới hạn request
│   ├── loginLimiter.js        # Giới hạn login
│   └── Auth/                  # Auth middlewares
│       ├── index.js
│       ├── initializeAppCheck.js
│       └── verifyIdToken.js
│
├── socket/                    # Socket.IO logic
│   └── index.js               # Khởi tạo, lắng nghe event chat / realtime
│
├── utils/                     # Hàm, helper, xử lý chung
│   ├── index.js
│   ├── http-error.js          # Tạo error chuẩn HTTP
│   ├── constants.js           # Constant dùng chung
│   ├── verifyCaptcha.js       # Xác thực captcha
│   ├── logEventUtils.js       # Nhóm hàm log (logInfo, logGroupWrapper...)
│   ├── logCustome/            # Log custom cho request / compare
│   │   ├── logTableRequest.js
│   │   └── logTableCompare.js
│   ├── cache/                 # Cache in-memory/logs cho post moment
│   │   ├── memoryCache.js
│   │   └── logsPostMoment.js
│   ├── format/                # Format ngày, folder, kích thước...
│   │   ├── formatDay.js
│   │   ├── formatFileSize.js
│   │   └── formatTodayFolder.js
│   ├── normalize/             # Chuẩn hóa data từ Firestore/API
│   │   ├── normalizeMoment.js
│   │   ├── normalizeMessage.js
│   │   ├── normalizeInfoViews.js
│   │   ├── normalizeInfoReactions.js
│   │   └── normalizeFriendRequest.js
│   ├── process/               # Xử lý buffer media
│   │   ├── processImageBuffer.js
│   │   └── processVideoBuffer.js
│   ├── delete/                # Dọn dẹp file trên storage/CDN
│   │   ├── deleteFileFromStorage.js
│   │   └── cleanMedia.js
│   ├── dowload/               # Tải media từ CDN/Firebase về
│   │   ├── index.js
│   │   ├── downloadMedia.js
│   │   └── dowloadThumbnail.js
│   ├── cookieUtils/           # Helper cho cookie
│   │   └── index.js
│   └── replace/               # Thay thế URL Firebase bằng CDN
│       └── replaceFirebaseWithCDN.js
│
├── rpgc/                      # Module con dùng Firestore + gRPC
│   ├── controllers/           # Controller cho REST & Socket
│   │   ├── restRpgc.js
│   │   └── socketRpgc.js
│   ├── firestore/             # Firestore client + builder
│   │   ├── firestoreClient.js
│   │   └── firestoreRequestBuilder.js
│   ├── models/                # Model cho Firestore / socket
│   │   ├── firebaseModels.js
│   │   └── socketModels.js
│   └── utils/                 # Utils cho RPGC (decode, convert, metadata)
│       ├── CreMetadata.js
│       ├── decode.js
│       ├── firestoreConverts.js
│       └── normalizeData.js
│
└── collabs/
    └── DioxChisadin.js        # File collab / logic đặc biệt
```

---

## 🚀 Luồng khởi động cơ bản

1. Load biến môi trường từ `.env.development` hoặc `.env.production`.
2. Khởi tạo `Express` + cấu hình `CORS`, `cookie-parser`, body parsers.
3. Tạo HTTP server + khởi tạo `Socket.IO` với path `/socket.io/` và CORS rules.
4. Kết nối Redis, gắn `@socket.io/redis-adapter` để hỗ trợ scale nhiều node.
5. Gắn middleware log, rate limit, auth.
6. Mount toàn bộ routes qua `src/routes/index.js`.
7. Gắn `errorHandler` cuối cùng để xử lý lỗi tập trung.
8. Lắng nghe trên `PORT` (mặc định 5007).

---

## 🧪 Gợi ý lệnh hữu ích

- **Kiểm tra version Node & npm**:

```bash
node -v
npm -v
```

- **Cài lại sạch dependencies**:

```bash
rm -rf node_modules package-lock.json
npm install
```

- **Chạy trong môi trường dev với flag NODE_ENV**:

```bash
NODE_ENV=development node app.js
```

- **Chạy production (ví dụ khi deploy)**:

```bash
NODE_ENV=production node app.js
```

---

## 📚 API Reference (tổng quan)

Tất cả các route chính được mount trong `src/routes/index.js`:

- **Prefix `/locket`**:
  - Auth: `authRoutes`
  - Moment / Friend / Message: `locketRoutes`
  - RPGC (messages/moments nâng cao): `rpgcRoutes`
- **Prefix `/api`**:
  - Plan/subscription: `planRoutes`
  - Hệ thống & tiện ích (push, spotify, weather...): `systemRoutes`
  - Collab đặc biệt: `collabRoutes`

Phần dưới đây liệt kê các nhóm API chính (request body chỉ là dạng tham khảo, bạn có thể tùy chỉnh theo client thực tế).

---

### 🔐 Nhóm Auth (`/locket`)

Base URL: `/locket`

- **POST `/locket/loginV2`**
  - Đăng nhập bằng email/password, set cookie `accessToken` và `refreshToken`.
  - Body:
    ```json
    {
      "email": "user@example.com",
      "password": "your_password"
    }
    ```

- **POST `/locket/loginWithPhoneV2`**
  - Đăng nhập bằng số điện thoại + password, có bước gửi mã xác minh nội bộ.
  - Body:
    ```json
    {
      "phone": "+84xxxxxxxxx",
      "password": "your_password"
    }
    ```

- **POST `/locket/loginV3`**
  - Phiên bản login kèm **CAPTCHA**.
  - Body:
    ```json
    {
      "email": "user@example.com",
      "password": "your_password",
      "captchaToken": "token_do_client_gửi_lên"
    }
    ```

- **GET `/locket/logout`**
  - Xóa cookie phiên (`refreshToken`, `dioSession`), đăng xuất an toàn.

- **POST `/locket/refresh-token`**
  - Refresh lại token dựa trên `refreshToken` (ưu tiên lấy từ cookie, fallback body).
  - Body (tùy chọn, thường không cần nếu dùng cookie):
    ```json
    {
      "refreshToken": "optional_if_not_in_cookie"
    }
    ```

- **GET `/locket/getInfoUser`**
  - Lấy thông tin user từ `idToken`.
  - Header:
    - `Authorization: Bearer <idToken>` (được kiểm tra bởi `verifyIdToken` middleware).

- **POST `/locket/resetPassword`**
  - Gửi email reset password.
  - Body:
    ```json
    {
      "email": "user@example.com"
    }
    ```

- **POST `/locket/changeProfileInfo`**
  - Thay đổi thông tin profile (badge, celebrity, thêm dữ liệu phụ).
  - Body:
    ```json
    {
      "idToken": "firebase_id_token",
      "badge": "string_or_object",
      "celebrity": true,
      "additionalData": { "bio": "..." }
    }
    ```

---

### 📸 Nhóm Locket Moments & Friend & Message (`/locket`)

Base URL: `/locket`

#### Moments

- **POST `/locket/postMomentV2`**
  - Upload và tạo moment mới (ảnh / video).
  - Middleware: `logRequestInfo`, `verifyIdToken`, `verifyplanAuth`.
  - Header:
    - `Authorization: Bearer <idToken>`
  - Body: (dạng tham khảo, phụ thuộc `uploadMediaV2`)
    ```json
    {
      "model": "Version-UploadmediaV3.1",
      "mediaInfo": {
        "url": "https://cdn.example.com/path/to/file.jpg",
        "type": "image"
      },
      "options": {
        "caption": "Nội dung caption",
        "audience": "selected",
        "recipients": ["uid1", "uid2"]
      }
    }
    ```

- **POST `/locket/getInfoMomentV2`**
  - Lấy thông tin chi tiết một moment.
  - Header: `Authorization: Bearer <idToken>`
  - Body:
    ```json
    {
      "idMoment": "moment_id"
    }
    ```

- **GET `/locket/getLatestMomentV2`**
  - Lấy moments mới nhất cho user đang đăng nhập.
  - Header: `Authorization: Bearer <idToken>`

- **POST `/locket/reactMomentV2`**
  - Gửi reaction cho moment (tim, icon, v.v.).
  - Header: `Authorization: Bearer <idToken>`
  - Body:
    ```json
    {
      "reactionInfo": {
        "momentId": "moment_id",
        "emoji": "❤️",
        "type": "like"
      }
    }
    ```

#### Messages (liên quan Moment)

- **POST `/locket/sendMessageV2`**
  - Gửi tin nhắn liên quan đến một moment / chat mini trong moment.
  - Header: `Authorization: Bearer <idToken>`
  - Body:
    ```json
    {
      "MessageInfo": {
        "momentId": "moment_id",
        "to": "target_uid",
        "content": "Tin nhắn ..."
      }
    }
    ```

#### Friends

- **POST `/locket/getAllFriendsV2`**
  - Lấy danh sách bạn bè (proxy qua RPGC `getListFriends`).
  - Header: `Authorization: Bearer <idToken>`

- **POST `/locket/deleteFriendV2`**
  - Xóa bạn.
  - Header: `Authorization: Bearer <idToken>`
  - Body: (tham khảo)
    ```json
    {
      "friendUid": "uid_cần_xóa"
    }
    ```

- **POST `/locket/sendCelebrityRequestV2`**
  - Gửi yêu cầu kết bạn kiểu “celebrity”.

- **POST `/locket/getIncomingFriendRequestsV2`**
- **POST `/locket/getAllRequestsV2`**
- **POST `/locket/getOutgoingFriendRequestsV2`**
- **POST `/locket/deleteIncomingRequestV2`**
- **POST `/locket/deleteOutgoingRequestV2`**
- **POST `/locket/acceptFriendRequestV2`**
  - Các endpoint quản lý **lời mời kết bạn** (vào/ra, xóa, chấp nhận).
  - Tất cả đều yêu cầu `Authorization: Bearer <idToken>`.

- **POST `/locket/getUserByData`**
  - Tìm user theo dữ liệu (email, uid, v.v. — tùy logic bên `friendcontroll.getUserController`).

---

### 💬 Nhóm RPGC Messages & Moments (`/locket`)

Base URL: `/locket` (nhưng route lấy từ `rpgcRoutes`)

- **POST `/locket/getMessageWithUserV2`**
  - Lấy conversation chi tiết với một user.
  - Header: `Authorization: Bearer <idToken>`

- **POST `/locket/getAllMessageV2`**
  - Lấy danh sách messages (RPGC-based).

- **POST `/locket/getMomentV2`**
  - Lấy danh sách moments (RPGC-based).

Các body cụ thể phụ thuộc hàm `getMessagesWithUser`, `getListMessages`, `getListMoments` trong `rpgc/controllers/restRpgc.js` (nếu cần, có thể thêm docs chi tiết riêng cho RPGC).

---

### 💳 Nhóm Plan / Subscription (`/api`)

Base URL: `/api`

- **GET `/api/me`**
  - Lấy thông tin plan hiện tại của user.
  - Middleware: `verifyIdToken`.

- **GET `/api/po`**
  - Endpoint version V2 (`planControllerV2`) lấy thông tin plan/owner chi tiết hơn.

- **POST `/api/u`**
  - Cập nhật plan của user.
  - Body: tùy logic trong `UpdateplanController` (thường gồm planId, trạng thái, token xác thực thanh toán…).

- **POST `/api/coupon/validate`**
  - Kiểm tra coupon (mã giảm giá).
  - Middleware: `verifyPlanAuthOrGuest` cho phép user đã auth hoặc guest hợp lệ.
  - Body:
    ```json
    {
      "coupon": "YOUR_COUPON_CODE"
    }
    ```

---

### 🛰️ Nhóm System / Utility (`/api`)

Base URL: `/api`

#### Push Notification

- **POST `/api/push/register`**
  - Đăng ký nhận push (lưu token/subscription).
  - Body ví dụ:
    ```json
    {
      "endpoint": "https://fcm.googleapis.com/fcm/send/....",
      "keys": {
        "p256dh": "....",
        "auth": "...."
      },
      "uid": "user_id"
    }
    ```

- **POST `/api/push/send`**
  - Endpoint nội bộ / admin gửi push tới user.

#### Spotify / Music

- **POST `/api/spotify`**
- **POST `/api/spotifyV2`**
  - Lấy thông tin track từ Spotify (v1/v2).
  - Middleware: `getLimiter`, `logRequestInfo`, `verifyIdToken`.
  - Body gợi ý:
    ```json
    {
      "url": "https://open.spotify.com/track/..."
    }
    ```

- **POST `/api/getInfoMusic`**
  - Lấy metadata nhạc (Spotify/Apple Music…) từ `spotifyController.getInfoMusicController`.

#### Weather

- **GET `/api/weather`**
  - Lấy thông tin thời tiết đơn giản.

- **POST `/api/weatherV2`**
  - Phiên bản V2 với body chi tiết (ví dụ truyền tọa độ, city).

---

### 🤝 Nhóm Collab (`/api`)

Base URL: `/api`

- **POST `/api/collab/getCaption`**
  - Lấy caption gợi ý từ collab `DioxChisadin`.
  - Body ví dụ:
    ```json
    {
      "id": "caption_template_or_id",
      "context": {
        "mood": "happy",
        "topic": "friendship"
      }
    }
    ```

---

### 🧷 Ghi chú chung khi gọi API

- Hầu hết các API nhạy cảm đều yêu cầu:
  - Header: `Authorization: Bearer <idToken>`
  - Cookie: `accessToken` / `refreshToken` (được set sau khi login).
- Đối với những API có rate-limit, cần xử lý lỗi HTTP 429 tại client.
- Toàn bộ lỗi được gom qua `errorHandler`, format thường là:
  ```json
  {
    "success": false,
    "message": "Mô tả lỗi",
    "error": "ERROR_CODE_TÙY_TRƯỜNG_HỢP"
  }
  ```

---

Nếu bạn muốn, mình có thể tiếp tục chi tiết hóa docs cho từng nhóm API (auth, moment, chat, friend, analytics, v.v.) dựa trên các file trong `src/controllers` và `src/routes`.

