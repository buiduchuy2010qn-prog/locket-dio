import { lazy, Suspense, useState } from "react";
import { Download, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import "./styles.css";
import { CONFIG } from "@/config";
const NotificationPrompt = lazy(() =>
  import("@/components/ui/NotificationPrompt")
);
const FeatureCardMarquee = lazy(() =>
  import("@/components/ui/Marquee/FeatureCardMarquee")
);
const StepsSection = lazy(() => import("./StepsSection"));

const Home = () => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full text-center bg-grid">
      <section className="w-full max-w-screen-2xl mx-auto px-4 pt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 md:gap-y-0 gap-x-12 items-center min-h-[84vh]">
          {/* LEFT */}
          <div className="flex flex-col justify-center gap-4 md:gap-6 text-left md:pr-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight relative h-[55px] md:h-[65px] lg:h-[70px]">
              <span className="absolute word-rotate whitespace-nowrap text-white">
                <span>Trải nghiệm</span>
                <span>Khám phá</span>
                <span>Sáng tạo</span>
                <span>Chia sẻ</span>
              </span>
            </h1>

            <h2 className="text-5xl inline-block no-select md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight -mb-3">
              <span className="no-select font-purrfect text-white">
                Locket Camera
              </span>
            </h2>

            <p className="text-white/90 text-base md:text-lg leading-relaxed">
              Ghi lại khoảnh khắc, thêm caption cực chất và chia sẻ ngay tức thì
              – tất cả chỉ với vài thao tác đơn giản trên <b>Locket Camera</b>.
              Bạn có thể dùng trực tiếp trên trình duyệt hoặc thêm ứng dụng vào
              màn hình chính để tiện lợi hơn.
            </p>

            <p className="text-white/80 text-sm italic">
              “Huy Locket” là dự án cá nhân, hoạt động độc lập. Không liên kết
              với bên thứ ba nào trừ khi có thông báo chính thức từ Dio.
            </p>

            <p className="text-white/90 text-sm font-semibold space-y-1">
              <span className="block">
                ❗ Mọi giao dịch mua bán “quyền sử dụng” hay “truy cập web”
                không do Dio ủy quyền đều là <b>gian lận</b>.
              </span>
              <span className="block">
                • Nếu bạn phải trả phí để truy cập trang web này thì thì đó là
                dấu hiệu của scam (lừa đảo).
              </span>
              <span className="block">
                • Nếu phát hiện ai đó đang kinh doanh website này, vui lòng báo
                cáo với{" "}
                <Link to={"/contact"} className="underline">
                  Quản trị viên
                </Link>
                .
              </span>
              {/* <span className="block">
                • Danh sách cá nhân được uỷ quyền{" "}
                <a
                  href={CONFIG.app.docs.personal_authorization}
                  rel="noopener noreferrer"
                  target="__blank"
                  className="underline"
                >
                  Tìm hiểu thêm
                </a>
                .
              </span> */}
            </p>

            <div className="flex flex-wrap gap-3 mt-2 animate-fade-in delay-400">
              <Link
                to={"/login"}
                className="px-4 py-3 bg-white text-blue-600 font-semibold rounded-full shadow-lg hover:bg-gray-100 transition-all duration-300 hover:scale-105"
              >
                Đăng nhập ngay
              </Link>
              <Link
                to={"/download"}
                className="px-4 py-3 rotate-[1deg] gradient-effect text-white font-semibold rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-105"
              >
                Thêm vào màn hình
              </Link>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center justify-center h-full w-full md:pl-6 no-select -mb-10">
            <div className="relative transform hover:scale-105 transition-transform duration-500">
              <img
                src="https://cdn.locket-dio.com/v1/images/double-phone-view-locketdio.webp"
                alt="Huy Locket WebApp Preview"
                onLoad={() => setLoaded(true)}
                className={`
            md:w-[380px] lg:w-[400px] h-auto object-contain 
            drop-shadow-2xl transition-opacity duration-500 ease-in-out float-up-down
            ${loaded ? "opacity-100" : "opacity-0"}
          `}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-5">
        <div className="mx-auto drop-shadow-lg">
          <div className="text-center py-5">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Tính năng nổi bật
            </h2>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Khám phá những tính năng tuyệt vời giúp bạn tạo ra và chia sẻ
              khoảnh khắc đáng nhớ.
            </p>
          </div>
          <Suspense fallback={null}>
            <FeatureCardMarquee />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={null}>
        <StepsSection />{" "}
      </Suspense>

      {/* Stats Section */}
      <section className="pb-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Thống kê về Locket Camera
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              {
                number: "7K+",
                label: "Người dùng hoạt động",
                color: "from-blue-400 to-cyan-400",
              },
              {
                number: "800K+",
                label: "Ảnh & Video đã tạo",
                color: "from-purple-400 to-pink-400",
              },
              {
                number: "15GB+",
                label: "Dung lượng sử dụng mỗi ngày",
                color: "from-green-400 to-emerald-400",
              },
              {
                number: "4.3/5★",
                label: "Đánh giá trung bình",
                color: "from-yellow-400 to-orange-400",
              },
            ].map((stat, index) => (
              <div key={index} className="text-center group">
                <div
                  className={`text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300`}
                >
                  {stat.number}
                </div>
                <p className="text-white/80 text-sm md:text-base font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-6 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Bắt đầu hành trình sáng tạo
          </h2>
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Cài đặt hoặc thêm Huy Locket vào màn hình chính ngay hôm nay và khám
            phá thế giới photography & videography đầy màu sắc!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={"/download"}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Cài đặt miễn phí
            </Link>
            <a
              href="https://discord.gg/47buy9nMGc"
              target="_blank"
              className="px-8 py-4 bg-white/20 text-white font-bold rounded-2xl border border-white/30 hover:bg-white/30 transition-all duration-300 flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              <UserPlus className="w-5 h-5" />
              Tham gia Discord
            </a>
          </div>

          <div className="mt-8 text-white/60 text-sm">
            Dễ sử dụng • Không quảng cáo • Bảo mật thông tin
          </div>
        </div>
      </section>

      {/* 👉 Component xin thông báo */}
      <NotificationPrompt />
    </div>
  );
};

export default Home;
