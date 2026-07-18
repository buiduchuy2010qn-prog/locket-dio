/** AI image enhancement — isolated module constants */

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
 * Provider note (shown in UI when not configured / docs).
 * Update when wiring a real paid provider.
 */
export const PROVIDER_DISCLOSURE = {
  provider: "Replicate",
  model: "nightmareai/real-esrgan (or configured REPLICATE_MODEL)",
  costHint: "~$0.002–0.01 / ảnh tùy độ phân giải (ước lượng Replicate)",
  latencyHint: "thường 5–30 giây",
  maxPixels: "tối đa ~12MP (server)",
  thirdParty: "Ảnh được gửi tạm tới Replicate để suy luận",
  retention: "Xóa file tạm trên server sau khi hoàn tất/thất bại; phía provider theo chính sách Replicate",
};
