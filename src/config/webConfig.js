//config/webConfig.js — Huy Locket

export const CONFIG = {
  api: {
    baseUrl: import.meta.env.VITE_BASE_API_URL,
    authUrl: import.meta.env.VITE_AUTH_API_URL,
    storage: import.meta.env.VITE_STORAGE_API_URL,
    data: import.meta.env.VITE_DATA_API_URL,
    payment: import.meta.env.VITE_PAYMENT_API_URL,
    cdnUrl: import.meta.env.VITE_CDN_URL,
    locketApi: import.meta.env.VITE_LOCKET_API_URL,
    exportApi: import.meta.env.VITE_EXPORTS_API_URL,
    convertApi: import.meta.env.VITE_CONVERTS_API_URL,
    extenApi: import.meta.env.VITE_EXTENS_API_URL,
  },

  keys: {
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    turnstileKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
    // Keep official Dio API key so backend accepts requests
    apiKey:
      import.meta.env.VITE_PUBLIC_API_KEY ||
      "LKD-LOCKETDIO-AB02F55KYM55DD02MM03YY25-LKD",
  },

  app: {
    name: "Huy Locket",
    watermark: "huy-locket",
    author: "Huy",
    shortname: "huylocket",
    fullName: "Huy Locket - Đăng ảnh & Video lên Locket",
    clientVersion: "Beta1.3.6",
    apiVersion: "v2.2.1",
    startYear: 2025,
    // Official Dio API often expects production label
    env: "production",
    camera: {
      limits: {
        maxRecordTime: 10,
        maxImageSizeMB: 10,
        maxVideoSizeMB: 10,
      },
      resolutions: {
        imageSizePx: 1920,
        videoResolutionPx: 1080,
      },
      constraints: {
        // Preview mặc định — Android override qua getCameraPreviewConstraints()
        default: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        // Android/low-end preview
        android: {
          width: { ideal: 960, max: 1280 },
          height: { ideal: 540, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        ultraHD: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
      },
    },
    moments: {
      // Mobile load ít hơn → scroll mượt
      initialVisible: 30,
      maxDisplayLimit: 3000,
      loadMoreLimit: 30,
      duplicateThreshold: 3,
    },
    messages: {
      initialVisible: 50,
      maxDisplayLimit: 5000,
      loadMoreLimit: 50,
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
    // Ủng hộ — STK Huy (MBBank)
    sponsors: {
      bankName: "Ngân hàng MBBank (MB)",
      accountNumber: "0394709137",
      accountName: "BUI DUC HUY",
      bankBin: "970422",
      urlImg:
        "https://img.vietqr.io/image/970422-0394709137-compact2.png?accountName=BUI%20DUC%20HUY",
    },
    bankInfo: {
      bankCode: "MB",
      short_name: "MBBank",
      bankName: "Ngân hàng MBBank (MB)",
      accountNumber: "0394709137",
      accountName: "BUI DUC HUY",
      bankBin: "970422",
      urlImg:
        "https://img.vietqr.io/image/970422-0394709137-compact2.png?accountName=BUI%20DUC%20HUY",
    },
    myInfo: {
      fullName: "Bùi Đức Huy",
      email: "buiduchuy2010qn@gmail.com",
      phone: "",
      github: "https://github.com/buiduchuy2010qn-prog",
      avatarUrl: "",
    },
    docs: {
      personal_authorization:
        "https://docs.google.com/document/d/1c2ttnmPyR3YIYooMj69MlT1XAhCO_xMytHztzi6EaEY/edit?usp=sharing",
    },
    videoTutorials: {
      youtubeChannel: "https://www.youtube.com/@HuyLocket",
      iosAddscreen: {
        title: "Hướng dẫn thêm Huy Locket vào màn hình chính trên iPhone!",
        url: "https://www.youtube.com/embed/iElPAnQ7lNY",
      },
      androidAddscreen: {
        title: "Hướng dẫn thêm Huy Locket vào màn hình chính trên Android!",
        url: "https://www.youtube.com/embed/JtgfTNbKTZY",
      },
    },
  },
  ui: {
    theme: "pinksnow",
    themes: [
      "pinksnow",
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
    themeLabels: {
      pinksnow: "Hồng tuyết ❄",
      valentine: "Valentine 💕",
      winter: "Winter ❄",
      light: "Sáng",
      dark: "Tối",
      cupcake: "Cupcake",
      synthwave: "Synthwave",
      retro: "Retro",
      halloween: "Halloween",
      forest: "Forest",
      dracula: "Dracula",
      night: "Night",
      coffee: "Coffee",
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

  // Bắt buộc cho CACHE_CONFIG (userLocketCache / memberToken).
  // Thiếu block này → crash ngay lúc load bundle → trang hồng trống.
  cache: {
    keys: {
      user: "userData",
      memberToken: "memberToken",
      memberHeader: "memberHeader",
    },
    ttl: {
      user: 24 * 60 * 60 * 1000, // 24h
    },
  },
};
