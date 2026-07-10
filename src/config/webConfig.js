//config/webConfig.js

export const CONFIG = {
  api: {
    baseUrl: import.meta.env.VITE_BASE_API_URL, // API chính
    storage: import.meta.env.VITE_STORAGE_API_URL, // API lưu trữ file
    data: import.meta.env.VITE_DATA_API_URL, // API data local
    payment: import.meta.env.VITE_PAYMENT_API_URL, // API thanh toán
    cdnUrl: import.meta.env.VITE_CDN_URL, // API cdn
    // Official: socket on api.locket-dio.com (chat.* DNS is dead)
    chatServer:
      import.meta.env.VITE_CHAT_SERVER_URL || "api.locket-dio.com",
    locketApi: import.meta.env.VITE_LOCKET_API_URL, // API Locket chính thức
    exportApi: import.meta.env.VITE_EXPORTS_API_URL, // API export data pdf, excel,...
    convertApi: import.meta.env.VITE_CONVERTS_API_URL,
    extenApi: import.meta.env.VITE_EXTENS_API_URL,
    authUrl: import.meta.env.VITE_AUTH_API_URL, // auth service
  },

  keys: {
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY, // Push notification
    turnstileKey: import.meta.env.VITE_TURNSTILE_SITE_KEY, // Cloudflare Turnstile
    // Admin localIds (comma) — hiện hướng dẫn cấu hình shared Drive
    adminLocalIds: import.meta.env.VITE_ADMIN_LOCAL_IDS || "",

    // Must match official client key or storage returns Malformed / denied
    apiKey:
      import.meta.env.VITE_PUBLIC_API_KEY ||
      "LKD-LOCKETDIO-AB02F55KYM55DD02MM03YY25-LKD",
  },

  app: {
    name: "Huy Locket", // Tên app hiển thị
    // Tên web / watermark góc màn camera
    watermark: "huy-locket",
    author: "Huy",
    shortname: "huylocket",
    fullName: "Huy Locket - Đăng ảnh & Video lên Locket", // Tên đầy đủ
    // Align with production client so Dio backend accepts requests
    clientVersion: "Beta1.3.4",
    apiVersion: "v2.2.1", // Version API
    // Official client hardcodes "production" — Dio may reject other env labels
    env: "production",
    camera: {
      limits: {
        maxRecordTime: 60, // giây
        maxImageSizeMB: 200,
        maxVideoSizeMB: 200,
      },
      resolutions: {
        imageSizePx: 1280, // capture/preview balance
        videoResolutionPx: 720,
      },
      constraints: {
        // Lighter preview for mid-range phones
        default: {
          width: { ideal: 960, max: 1280 },
          height: { ideal: 720, max: 960 },
          frameRate: { ideal: 20, max: 24 },
        },
        ultraHD: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
    },
    moments: {
      initialVisible: 18, // Ít item đầu → mượt hơn
      maxDisplayLimit: 2000,
      loadMoreLimit: 24,
      duplicateThreshold: 3,
    },
    messages: {
      initialVisible: 20,
      maxDisplayLimit: 2000,
      loadMoreLimit: 30,
    },
    contact: {
      supportEmail: "buiduchuy2010qn@gmail.com",
      supportNumber: "1800-123-456",
    },
    community: {
      discord: "https://discord.com/invite/47buy9nMGc",
      telegram: "https://t.me/ddevdio",
      messenger: "https://m.me/cm/AbYPtgRiGe2fInEf",
    },
    // Ủng hộ — STK của Huy (MBBank)
    // VietQR BIN MB: 970422 | STK: 0394709137 | CTK: BUI DUC HUY
    sponsors: {
      bankName: "Ngân hàng MBBank (MB)",
      accountNumber: "0394709137",
      accountName: "BUI DUC HUY",
      bankBin: "970422",
      urlImg:
        "https://img.vietqr.io/image/970422-0394709137-compact2.png?accountName=BUI%20DUC%20HUY",
    },
    bankInfo: {
      bankName: "Ngân hàng MBBank (MB)",
      accountNumber: "0394709137",
      accountName: "BUI DUC HUY",
      bankBin: "970422",
      urlImg:
        "https://img.vietqr.io/image/970422-0394709137-compact2.png?accountName=BUI%20DUC%20HUY",
    },
    docs: {
      personal_authorization:
        "https://docs.google.com/document/d/1c2ttnmPyR3YIYooMj69MlT1XAhCO_xMytHztzi6EaEY/edit?usp=sharing",
    },
    videoTutorials: {
      youtubeChannel: "https://www.youtube.com/@LocketDio",
      iosAddscreen: {
        title: "Hướng dẫn thêm Huy Locket vào màn hình chính trên iPhone!",
        url: "https://www.youtube.com/embed/iElPAnQ7lNY",
      }, // Hướng dẫn thêm trang web vào màn hình chính trên iPhone (Safari)
      androidAddscreen: {
        title: "Hướng dẫn thêm Huy Locket vào màn hình chính trên Android!",
        url: "https://www.youtube.com/embed/JtgfTNbKTZY",
      }, // Hướng dẫn thêm trang web vào màn hình chính trên Android (Chrome)
    },
  },
  ui: {
    theme: "pinksnow", // mặc định: hồng + tuyết rơi
    themes: [
      "pinksnow", // 💗❄ Hồng tuyết (Huy Locket)
      "light",
      "dark",
      "cupcake",
      "bumblebee",
      "emerald",
      "corporate",
      "synthwave",
      "retro",
      "valentine",
      "halloween",
      "garden",
      "forest",
      "lofi",
      "pastel",
      "fantasy",
      "wireframe",
      "black",
      "luxury",
      "dracula",
      "cmyk",
      "autumn",
      "business",
      "acid",
      "lemonade",
      "night",
      "coffee",
      "winter",
    ],
    /** Nhãn hiển thị trong Setting Theme */
    themeLabels: {
      pinksnow: "Hồng tuyết ❄",
      valentine: "Valentine 💕",
      winter: "Winter ❄",
    },
    maxToastVisible: 3,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",

    moments: {
      initialVisible: 50,
      maxDisplayLimit: 5000,
      duplicateThreshold: 3,
    },
    chat: { initialVisible: 10 },

    categories: [
      { id: "update", label: "Cập nhật", icon: "Sparkles" },
      { id: "event", label: "Sự kiện", icon: "Gift" },
      { id: "announcement", label: "Thông báo", icon: "Megaphone" },
      { id: "tip", label: "Mẹo sử dụng", icon: "Lightbulb" },
    ],
  },
};
