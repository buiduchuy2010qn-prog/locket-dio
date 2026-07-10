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

// utils/planUtils.js
function isUploadAllowed(planData, sizeMb, limitMb = 12) {
  const planId = planData?.plan_id || "free";
  const isFree = planId.toLowerCase() === "free";
  return !(isFree && sizeMb > limitMb);
}

function getResolution({planData, normal = 1440, member = 1920}) {
  const planId = planData?.plan_id || "free";
  const isFree = planId.toLowerCase() === "free";
  return isFree ? normal : member;
}

module.exports = {
  logUserAction,
  isUploadAllowed,
  getResolution
};
