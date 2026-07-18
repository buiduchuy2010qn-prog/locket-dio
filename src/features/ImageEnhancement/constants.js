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

/** Hard job deadline from user tap "Bắt đầu" (local + cloud). */
export const ENHANCE_DEADLINE_MS = 60_000;
/** Worker must heartbeat at least this often or we terminate as hung. */
export const ENHANCE_HEARTBEAT_STALE_MS = 10_000;
/** Throttle progress UI updates. */
export const ENHANCE_PROGRESS_THROTTLE_MS = 200;
/** After this many ms, if progress still low → show slow hint (no auto-restart). */
export const ENHANCE_SLOW_HINT_MS = 20_000;
export const ENHANCE_SLOW_HINT_MAX_PERCENT = 18;

/** Client limits */
export const MAX_CLIENT_BYTES = 12 * 1024 * 1024; // 12MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

/** Local ESRGAN — Slim 2x (same-origin static weights) */
export const LOCAL_MODEL_ID = "@upscalerjs/esrgan-slim/2x";
export const LOCAL_MODEL_JSON_PATH = "/ai-models/esrgan-slim-2x/v1/model.json";
export const LOCAL_MODEL_STATIC_PATH = "ai-models/esrgan-slim-2x/v1/model.json";
export const LOCAL_SCALE = 2;

/**
 * Quality profiles — keep Slim 2x only; smaller inputs so weak phones finish ≤60s.
 * maxInputEdge: long edge before 2x; maxOutputEdge = maxInputEdge * 2.
 */
export const LOCAL_QUALITY = {
  default: {
    id: "default",
    label: "Chuẩn",
    maxInputEdge: 576, // ~512–640
    maxOutputEdge: 1152, // ~1024–1280
    patchSize: 48,
    padding: 4,
  },
  superfast: {
    id: "superfast",
    label: "Siêu nhanh",
    maxInputEdge: 448, // ~384–512
    maxOutputEdge: 896, // ~768–1024
    patchSize: 32,
    padding: 4,
  },
};

export const DEFAULT_LOCAL_QUALITY = "default";

/** @deprecated use LOCAL_QUALITY */
export const LOCAL_MAX_OUTPUT_EDGE = LOCAL_QUALITY.default.maxOutputEdge;
export const LOCAL_PATCH_SIZE = LOCAL_QUALITY.default.patchSize;
export const LOCAL_PATCH_PADDING = LOCAL_QUALITY.default.padding;

export const PROVIDER_DISCLOSURE = {
  local: {
    provider: "Miễn phí trên thiết bị",
    model: `${LOCAL_MODEL_ID} · ${LOCAL_MODEL_JSON_PATH}`,
    costHint: "Miễn phí — 0 credit, không gửi ảnh ra khỏi máy",
    latencyHint: "tối đa 60 giây · worker riêng",
    thirdParty: "Chạy trong trình duyệt (UpscalerJS + ESRGAN Slim 2x)",
    retention: "Model static của web; runtime-cache sau lần tải đầu",
    isAi: true,
  },
  cloud: {
    provider: "Cloud nhanh (Replicate)",
    model: "nightmareai/real-esrgan (hoặc REPLICATE_MODEL)",
    costHint: "Tốn credit Replicate",
    latencyHint: "tối đa 60 giây",
    thirdParty: "Ảnh gửi tạm tới Replicate để suy luận",
    retention: "Xóa file tạm server sau job; Replicate theo chính sách riêng",
    isAi: true,
  },
};

export const ENHANCE_UI = {
  title: "AI Làm nét",
  button: "✨ AI Làm nét",
  buttonActive: "· Đang dùng",
  progress: "Đang làm nét",
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
  timedOut:
    "Thiết bị xử lý quá chậm nên AI đã được dừng. Ảnh gốc vẫn an toàn.",
  slowHint: "Thiết bị xử lý chậm. Bạn có thể hủy và thử mức Nhanh hơn.",
  trySuperfast: "Thử chế độ Siêu nhanh",
  close: "Đóng",
  remaining: (sec) => `Đang làm nét · còn tối đa ${sec} giây`,
  creditMessage:
    "AI Cloud hiện không đủ credit. Bạn có thể dùng chế độ miễn phí trên thiết bị.",
  useFreeButton: "Dùng bản miễn phí",
  providerLocal: "Miễn phí trên thiết bị",
  providerCloud: "Cloud nhanh",
  providerLocalHint: "ESRGAN Slim 2x · worker · tối đa 60s",
  providerCloudHint: "Replicate · cần mạng & credit · tối đa 60s",
  qualityDefault: "Chuẩn",
  qualitySuperfast: "Siêu nhanh",
};
