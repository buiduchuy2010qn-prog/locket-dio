/** Image enhancement — on-device ESRGAN (default) + optional Replicate cloud. */

export const ENHANCE_MODES = {
  natural: {
    id: "natural",
    label: "Tự nhiên",
    description: "ESRGAN Slim 2x — làm nét tổng quát",
  },
  portrait: {
    id: "portrait",
    label: "Chân dung",
    description: "Cùng model Slim 2x (ưu tiên chi tiết vừa phải)",
  },
  lowlight: {
    id: "lowlight",
    label: "Thiếu sáng",
    description: "Cùng model Slim 2x — không tăng sáng quá mức",
  },
};

export const DEFAULT_ENHANCE_MODE = "natural";

/** Provider ids for modal picker */
export const ENHANCE_PROVIDER = {
  LOCAL: "local",
  CLOUD: "cloud",
};

export const DEFAULT_ENHANCE_PROVIDER = ENHANCE_PROVIDER.LOCAL;

/** Client limits */
export const MAX_CLIENT_BYTES = 12 * 1024 * 1024; // 12MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

/** Local ESRGAN — Slim 2x for weak phones (same-origin static weights) */
export const LOCAL_MODEL_ID = "@upscalerjs/esrgan-slim/2x";
/**
 * Versioned same-origin path (works on Vercel + Railway without hard-coded host).
 * public/ai-models/esrgan-slim-2x/v1/ → /ai-models/esrgan-slim-2x/v1/
 */
export const LOCAL_MODEL_JSON_PATH = "/ai-models/esrgan-slim-2x/v1/model.json";
/** @deprecated use LOCAL_MODEL_JSON_PATH */
export const LOCAL_MODEL_STATIC_PATH = "ai-models/esrgan-slim-2x/v1/model.json";
export const LOCAL_SCALE = 2;
/** Max long edge of *output* after 2x (input capped to half). */
export const LOCAL_MAX_OUTPUT_EDGE = 2048;
export const LOCAL_PATCH_SIZE = 64;
export const LOCAL_PATCH_PADDING = 5;

export const PROVIDER_DISCLOSURE = {
  local: {
    provider: "Miễn phí trên thiết bị",
    model: `${LOCAL_MODEL_ID} · ${LOCAL_MODEL_JSON_PATH}`,
    costHint: "Miễn phí — 0 credit, không gửi ảnh ra khỏi máy",
    latencyHint: "phụ thuộc máy (thường 5–60 giây)",
    thirdParty: "Chạy trong trình duyệt (UpscalerJS + ESRGAN Slim 2x)",
    retention: "Model static của web; runtime-cache sau lần tải đầu",
    isAi: true,
  },
  cloud: {
    provider: "Cloud nhanh (Replicate)",
    model: "nightmareai/real-esrgan (hoặc REPLICATE_MODEL)",
    costHint: "Tốn credit Replicate",
    latencyHint: "thường 5–30 giây",
    thirdParty: "Ảnh gửi tạm tới Replicate để suy luận",
    retention: "Xóa file tạm server sau job; Replicate theo chính sách riêng",
    isAi: true,
  },
};

export const ENHANCE_UI = {
  title: "AI Làm nét",
  button: "✨ AI Làm nét",
  buttonActive: "· Đang dùng",
  progress: "Đang cải thiện ảnh…",
  loadingModel: "Đang tải AI miễn phí…",
  needNetwork: "Cần kết nối mạng để dùng Cloud.",
  needNetworkOnce: "Cần mạng một lần để tải AI miễn phí (model trên web)",
  useResult: "Dùng ảnh này",
  keepOriginal: "Giữ ảnh gốc",
  success: "Đã dùng ảnh AI",
  failTitle: "AI làm nét thất bại",
  failBody: "Ảnh gốc vẫn an toàn.",
  cancel: "Đã hủy AI Làm nét",
  revert: "Đã hoàn tác — về ảnh gốc",
  afterLabel: "Sau",
  oom: "Thiết bị không đủ tài nguyên để làm nét ảnh này",
  creditMessage:
    "AI Cloud hiện không đủ credit. Bạn có thể dùng chế độ miễn phí trên thiết bị.",
  useFreeButton: "Dùng bản miễn phí",
  providerLocal: "Miễn phí trên thiết bị",
  providerCloud: "Cloud nhanh",
  providerLocalHint: "ESRGAN Slim 2x · không gửi ảnh đi",
  providerCloudHint: "Replicate · cần mạng & credit",
};
