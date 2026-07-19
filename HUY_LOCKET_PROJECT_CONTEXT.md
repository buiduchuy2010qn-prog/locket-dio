==============================
1. THÔNG TIN DỰ ÁN
==============================

Tên dự án: Huy Locket

Mục tiêu:
- Đây là web Locket do người dùng tự xây dựng.
- Bài đăng từ web được gửi lên backend/Firebase Locket và xuất hiện trong app Locket chính hãng.
- Web chạy trên máy tính và điện thoại.

Repository:
https://github.com/buiduchuy2010qn-prog/locket-dio.git

Thư mục Windows:
C:\Users\DucHuyy\.grok\bin\locket-dio

Branch chính:
main

Frontend Vercel:
https://duchi.vercel.app
https://duchi.vercel.app/locket

Frontend Railway:
https://huy-locket-production.up.railway.app
https://huy-locket-production.up.railway.app/locket

Railway API:
https://huy-locket-api-production.up.railway.app

Health:
https://huy-locket-api-production.up.railway.app/health

Luôn kiểm tra HEAD hiện tại trước khi làm. Không tự đưa repo về commit cũ.

==============================
2. QUY TẮC BẢO VỆ TUYỆT ĐỐI
==============================

Những tính năng đang hoạt động là vùng khóa. Không được tự sửa, refactor, đổi tên, di chuyển hoặc “tối ưu cho sạch”.

ĐẶC BIỆT KHÔNG ĐƯỢC ĐỤNG:

CAMERA:
- getUserMedia.
- MediaStream và MediaRecorder.
- camera trước/sau/siêu rộng.
- deviceId và facingMode.
- zoom, flash và focus.
- chụp ảnh và quay video.
- Lưu và chụp tiếp.
- vòng đời camera.
- chất lượng, tỉ lệ và orientation.
- vị trí/kích thước UI camera.

NHẠC:
- tìm kiếm và resolve nhạc.
- ISRC.
- Spotify URL.
- Apple Music URL.
- preview nhạc trên web.
- music overlay.
- audio player.
- ensureMusicOptionsData.
- imagePostPayloadMusic.
- videoPostPayloadMusic.
- payload nhạc Android/iOS.

Known-good music baseline:
- Logic commit: 06de1eb6f534ae02b798b98b39a335293f7b5015
- Backup tag: music-ok-840pm

Không reset về baseline này nếu người dùng không yêu cầu rõ ràng.

Nếu một yêu cầu mới có nguy cơ chạm camera hoặc nhạc:

1. Chỉ đọc và phân tích.
2. Tìm cách thêm module/component độc lập.
3. Nếu vẫn bắt buộc phải sửa file được bảo vệ, dừng lại.
4. Báo chính xác file, hàm và lý do.
5. Chờ người dùng cho phép trước khi sửa.

MỌI prompt triển khai về sau phải tự động chèn khối bảo vệ camera và nhạc này. Người dùng không cần nhắc lại.

==============================
3. QUY TẮC GIT
==============================

- Không dùng git reset --hard.
- Không force-push.
- Không clean/xóa thay đổi của người dùng.
- Không checkout đè file.
- Không sửa file ngoài phạm vi.
- Không tự commit/push trước khi build và báo diff.
- Không tuyên bố hoàn thành nếu chưa test production.
- Nếu đã có thay đổi không liên quan trong working tree, phải giữ nguyên.
- Nếu phát hiện commit trước gây lỗi, đề xuất revert riêng commit; không reset lịch sử.
- Không làm lộ token, cookie, API key hoặc keystore.

Trước mỗi thay đổi phải báo:
- File dự định sửa.
- File được bảo vệ có bị ảnh hưởng không.
- Cách test.

Sau thay đổi phải báo:
- File thực tế đã sửa.
- Build/test.
- Regression camera.
- Regression nhạc.
- Chưa commit/push hay đã được người dùng cho phép.

==============================
4. UI VÀ THEME
==============================

Người dùng đã tự chỉnh bố cục UI.

Không được:
- di chuyển UI;
- biến dạng UI;
- thay đổi width/height;
- thay đổi margin/padding/gap;
- thay đổi flex/grid;
- thay đổi position;
- thay đổi border-radius;
- thay đổi transform;
- thiết kế lại giao diện.

Chỉ được đổi màu/theme khi người dùng yêu cầu.

Theme Pink Glass sử dụng:

- Background: #fdfbfb → #ebedee
- Pink blob: #ff9a9e
- Purple/pink blob: #fecfef
- Glass: rgba(255,182,193,0.25)
- Border: rgba(255,255,255,0.4)
- Shadow: rgba(255,182,193,0.25)
- Accent: #d81b60
- Text: #4a4a4a
- backdrop-filter khoảng blur(16px)

Không chép bố cục HTML demo vào project. Chỉ lấy bảng màu và chất liệu kính.

Không thêm hình oval, vòng tròn hoặc dải gradient khổng lồ che giao diện.

Hiệu ứng tuyết phải nhẹ, nằm sau UI/camera và không bị chụp vào media.

==============================
5. CAPTION
==============================

Caption hiện đã có. Không tạo lại caption flow.

Mục tiêu bổ sung:
- Các kiểu caption Decorative dạng capsule/chữ nhật bo tròn.
- Caption Nhật có chữ Nhật, romaji và dịch tiếng Việt trong màn hình chọn.
- Khi preview và đăng bài chỉ hiển thị chữ Nhật.
- Không gửi romaji/tiếng Việt vào payload.

Các nhóm mong muốn:
- Tình yêu.
- Nhớ anh/em.
- Cảm ơn.
- Xin lỗi.
- Hằng ngày.
- Anime.

Ví dụ:
- す、すごい〜！！ — s-sugoiii — T-tuyệt quá.
- ば、ばか〜！！ — b-baka — Đ-đồ ngốc.
- お兄ちゃん〜〜 — onii-chan — Anh trai ơi.
- こ、こんにちは〜〜 — k-konnichiwa — X-xin chào.
- 恋って最高 — Yêu đương thật tuyệt.
- 君が恋しい — Nhớ anh/em.
- ありがとう — Cảm ơn.
- ごめんね — Xin lỗi nhé.

Caption chữ và caption nhạc phải dùng overlay ID riêng, không ghi đè nhau.

==============================
6. OFFLINE VÀ BẢN NHÁP
==============================

Web phải là offline-first:

- Lần đầu cần mạng để tải app shell.
- Những lần sau mất mạng vẫn mở được nguyên giao diện.
- Không chỉ hiện offline.html màu đen.
- Offline vẫn chụp, chỉnh và lưu bản nháp.
- Chỉ có mạng mới được đăng.
- Có mạng lại không tự đăng; người dùng tự chọn bài.

Cho phép nhiều bản nháp:

- Mỗi ảnh/video là draftId riêng.
- Không ghi đè draft trước.
- Có “Lưu bản nháp” và “Lưu và chụp tiếp”.
- Không hiện modal chặn “Bạn có bản nháp chưa đăng”.
- Mục Bản nháp hiển thị preview lớn giống Lịch sử.
- Có media, caption, nhạc, thời gian và trạng thái.
- Chạm preview mới mở editor.
- Xóa phải xác nhận.

Bản nháp phải đồng bộ theo tài khoản:

- IndexedDB chỉ là cache/offline outbox.
- Có mạng thì đồng bộ cloud riêng tư.
- Điện thoại và máy tính cùng tài khoản thấy cùng draftId.
- Vercel và Railway cùng lấy draft từ một backend/storage.
- Không lưu base64 trong database.
- Không dùng Firebase/Locket chính hãng tùy ý để lưu draft.
- Không public media URL.
- Không lộ draft giữa hai tài khoản.
- Không được báo đã đồng bộ nếu chưa test cùng draftId trên hai thiết bị.

Đồng bộ bản nháp là mục tiêu đang cần kiểm tra; không mặc định coi là đã hoàn thành.

==============================
7. LỊCH SỬ VÀ ĐĂNG LẠI
==============================

Trong Lịch sử:

- Danh sách vẫn hiển thị bình thường.
- Nút “Đăng lại” chỉ xuất hiện khi mở chi tiết một bài.
- Vị trí: góc dưới bên trái.
- Bấm Đăng lại không đăng ngay.
- Chuyển media vào editor tạo bài mới.
- Người dùng được sửa caption, nhạc và người nhận.
- Tạo draft/moment mới.
- Không sửa hoặc xóa bài cũ.

==============================
8. LÀM NÉT ẢNH
==============================

Quyết định mới nhất:

- Không dùng AI.
- Không dùng Replicate.
- Không dùng UpscalerJS/ESRGAN.
- Không cần credit/token.
- Tên tính năng: “Làm nét ảnh”.
- Chỉ xử lý sau khi camera đã chụp xong.
- Không được chạm camera.

Dùng thuật toán nhẹ như Unsharp Mask:

output = original + amount × (original - gaussianBlur(original))

Yêu cầu:
- Chạy trong Web Worker.
- Giới hạn kích thước cho máy yếu.
- Mức Nhẹ/Vừa/Mạnh.
- Xem Trước/Sau.
- Luôn giữ ảnh gốc.
- Offline hoàn toàn.
- Mục tiêu 1–5 giây.
- Hard timeout 10 giây.
- Không CSS filter giả.
- Không xử lý ảnh 4K trực tiếp trên main thread.

Nếu code Replicate cũ vẫn còn, phải kiểm tra và gỡ riêng phần AI an toàn. Không reset commit và không chạm camera/nhạc.

==============================
9. HIỆU NĂNG
==============================

Web phải mở nhanh trên máy yếu:

- Lazy-load route/component nặng.
- Không tải nhạc/chat/Rollcalls trước khi cần.
- Media hiện tại tải trước.
- Album chỉ preload item trước/sau.
- Video dùng poster và preload metadata/none.
- Deduplicate request.
- Abort request khi unmount.
- Không animation blur/filter lớn liên tục.
- Không gắn will-change hàng loạt.
- Không làm thay đổi UI để “tối ưu”.

Rollcalls phải tải media tiến triển; không tải toàn bộ album cùng lúc.

==============================
10. CHAT NHÓM
==============================

Người dùng muốn tính năng tạo nhóm chat.

Trước khi làm:
- Kiểm tra API/chat schema hiện tại.
- Không tự bịa endpoint Locket.
- Nếu Locket chính hãng không hỗ trợ qua API hiện có, phải báo rõ web-only.
- Không tự tạo database riêng rồi tuyên bố đồng bộ app chính hãng.

==============================
11. APK ANDROID
==============================

Người dùng muốn APK Android nhưng không được phá camera/nhạc.

Hướng ưu tiên:
- Trusted Web Activity + Bubblewrap.
- Không dùng Capacitor/WebView/native camera trong giai đoạn đầu.
- APK mở:
  https://duchi.vercel.app/locket
- Railway vẫn là API/backend.
- Railway web vẫn hoạt động độc lập.

Yêu cầu:
- PWA/manifest/service worker hoạt động.
- Digital Asset Links.
- assetlinks.json.
- APK được ký.
- Keystore không commit.
- Test camera/nhạc trong APK.
- Không tạo plugin camera/music native.
- Google Play dùng AAB nếu phát hành.

Đây là mục tiêu đang dự kiến, không mặc định coi APK đã hoàn thành.

==============================
12. NGUYÊN TẮC LÀM VIỆC
==============================

Khi nhận yêu cầu mới:

1. Đọc HUY_LOCKET_PROJECT_CONTEXT.md.
2. Kiểm tra git status và HEAD.
3. Xác định phạm vi.
4. Xác định có chạm camera/nhạc không.
5. Nếu có nguy cơ, dừng và báo.
6. Nếu an toàn, đề xuất file cần sửa.
7. Không tự mở rộng phạm vi.
8. Không sửa UI ngoài yêu cầu.
9. Build và test.
10. Báo kết quả trước khi commit/push.

Không được:
- Tuyên bố “đã hoạt động” chỉ vì code build.
- Tuyên bố production thành công nếu chưa test URL thật.
- Tuyên bố đồng bộ nếu chỉ lưu IndexedDB.
- Tuyên bố AI nếu chỉ dùng Canvas filter.
- Tự dùng dịch vụ trả phí.
- Tự tạo tài khoản/token/billing.
- Sửa camera/nhạc vì cho rằng code cần dọn lại.
