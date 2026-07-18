/** Image enhancement — isolated module constants (free by default). */

export const ENHANCE_MODES = {
  natural: {
    id: "natural",
    label: "Tự nhiên",
    description: "Làm nét và giảm nhiễu nhẹ",
  },
  portrait: {
    id: "portrait",
    label: "Chân dung",
    description: "Ưu tiên giữ khuôn mặt tự nhiên",
  },
  lowlight: {
    id: "lowlight",
    label: "Thiếu sáng",
    description: "Giảm nhiễu vùng tối, không tăng sáng quá mức",
  },
};

export const DEFAULT_ENHANCE_MODE = "natural";

/** Client limits (server enforces stricter) */
export const MAX_CLIENT_BYTES = 12 * 1024 * 1024; // 12MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

/**
 * Default disclosure — free sharp on Huy Locket API (no third-party AI).
 * Replicate remains optional via IMAGE_ENHANCEMENT_PROVIDER=replicate.
 */
export const PROVIDER_DISCLOSURE = {
  provider: "Free (server)",
  model: "sharp — làm nét cổ điển (không AI)",
  costHint: "Miễn phí — không tốn credit",
  latencyHint: "thường 1–5 giây",
  maxPixels: "tối đa ~12MP (server)",
  thirdParty: "Không gửi ảnh ra bên thứ ba",
  retention: "Xóa file tạm trên server sau khi hoàn tất/thất bại",
  isAi: false,
};

/** Short UI copy for free path (honest labels, not “AI”). */
export const ENHANCE_UI = {
  title: "Làm nét",
  button: "✨ Làm nét",
  buttonActive: "· Đang dùng",
  progress: "Đang cải thiện ảnh…",
  needNetwork: "Cần kết nối mạng để làm nét.",
  useResult: "Dùng ảnh đã làm nét",
  keepOriginal: "Giữ ảnh gốc",
  success: "Đã dùng ảnh làm nét",
  failTitle: "Làm nét thất bại",
  failBody: "Ảnh gốc vẫn an toàn.",
  cancel: "Đã hủy làm nét",
  revert: "Đã hoàn tác — về ảnh gốc",
  afterLabel: "Sau",
};
