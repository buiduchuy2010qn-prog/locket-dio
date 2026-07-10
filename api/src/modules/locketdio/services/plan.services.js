const { supabase } = require("../../../config/supabase");

exports.getUserPlanV3 = async (uid) => {
  const { data, error } = await supabase
    .from("v_user_profile_full")
    .select("*")
    .eq("uid", uid)
    .single();

  if (error && error.code === "PGRST116") return null;

  if (error) throw new Error(error.message);

  if (!data) return null;

  return data;
};

exports.getMemberFamily = async (uid) => {
  const { data, error } = await supabase
    .from("v_membership_detail")
    .select("*")
    .eq("owner_uid", uid)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data || null;
};

exports.registerDefaultPlan = async (uid, email, phone, name, picture) => {
  const { error } = await supabase.rpc("upsert_user_plan", {
    p_uid: uid,
    p_email: email ?? null,
    p_phone: phone ?? null,
    p_name: name ?? null,
    p_picture: picture ?? null,
  });

  if (error) throw new Error(error.message);
};

exports.updateInfoUserPlan = async ({
  uid,
  email,
  phone,
  name,
  picture,
  username,
}) => {
  const { error } = await supabase.rpc("upsert_user_plan", {
    p_uid: uid,
    p_email: email ?? null,
    p_phone: phone ?? null,
    p_name: name ?? null,
    p_picture: picture ?? null,
    p_username: username ?? null,
  });

  if (error)
    throw new Error("❌ Cập nhật thông tin user thất bại: " + error.message);

  return true;
};

exports.ValidateCoupon = async ({ code, planId, user_id, subtotal }) => {
  try {
    const { data, error } = await supabase.rpc("check_and_apply_coupon", {
      p_plan_id: planId,
      p_coupon_code: code,
      p_user_id: user_id,
    });
    console.log(data);

    if (error) {
      console.error("❌ Lỗi khi kiểm tra coupon:", error.message);
      return null;
    }

    if (!data) return null;

    return data;
  } catch (err) {
    console.error("❌ Lỗi khi gọi Supabase Function:", err.message);
    throw err;
  }
};
