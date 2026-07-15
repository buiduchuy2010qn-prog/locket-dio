const { supabase, isSupabaseConfigured } = require("../../config/supabase");

const logUserAction = async (req, action, count = 1) => {
  const uid = req.user?.localId;

  if (!uid || !action) {
    console.warn("⚠️ Thiếu uid hoặc action khi ghi log.");
    return;
  }

  // Self-host without Supabase: skip action logs (login still works)
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("user_action_logs").insert({
      uid,
      action,
      count,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ Lỗi khi ghi log hành động:", error.message);
    } else {
      console.log(
        `📌 Đã ghi log hành động: ${action} (${count} lượt) của ${uid}`
      );
    }
  } catch (err) {
    console.warn("[logUserAction] skipped:", err.message);
  }
};

// utils/planUtils.js — free-for-all: always allow (size capped elsewhere)
function isUploadAllowed(planData, sizeMb, limitMb = 50) {
  void planData;
  const size = Number(sizeMb) || 0;
  const limit = Number(limitMb) || 50;
  // Soft technical cap only — not a paywall
  return size <= limit;
}

/**
 * Output square resolution for processImageBuffer.
 * Free-for-all: always use high resolution (1920+).
 * Only downscales when source is larger — never invents detail.
 */
function getResolution({ planData, normal = 1920, member = 1920 }) {
  // Huy Locket free-for-all — do not downgrade free users to soft 1440
  const hi = Math.max(Number(normal) || 1920, Number(member) || 1920, 1920);
  // planData reserved for future caps; keep signature stable
  void planData;
  return hi;
}

module.exports = {
  logUserAction,
  isUploadAllowed,
  getResolution
};
