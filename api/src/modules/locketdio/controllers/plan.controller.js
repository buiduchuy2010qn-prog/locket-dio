const { planServices } = require("../services");
const {
  logInfo,
  logError,
  logSuccess,
} = require("../../../utils/logEventUtils");
const { tokenUltils } = require("../../../utils");
const { responseSuccess } = require("../../../helpers/http");

const planControllerV2 = async (req, res, next) => {
  const { uid, email, phone, name, picture } = req.user;
  const domain =
    req.headers["x-forwarded-host"] || req.headers.host || req.hostname;

  try {
    let userPlan = await planServices.getUserPlanV3(uid);

    if (!userPlan) {
      logInfo(
        "planController",
        `👤 User chưa có gói. Tự động đăng ký cho UID: ${uid}`,
      );

      await planServices.registerDefaultPlan(uid, email, phone, name, picture);

      userPlan = await planServices.getUserPlanV3(uid);

      logSuccess("planController", "✅ Đăng ký gói mặc định thành công");
    } else {
      logSuccess("planController", "✅ Đã có gói. Trả về thông tin gói");
    }

    const { user, plan, subscription } = userPlan;

    //Tài khoản bị xóa hoặc bị cấm khỏi hệ thống Locket Dio
    if (user.deleted_at) {
      return res.status(403).json({
        success: false,
        data: null,
        message: "This account has been deleted.",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        data: null,
        message: "Tài khoản đã bị cấm khỏi hệ thống Locket Dio.",
      });
    }

    const token = tokenUltils.signToken(
      {
        uid,
        email,
        name,
        customer_code: user.customer_code,
        plan_id: plan.id,
        is_active: subscription.is_active,
        expire_at: subscription.expires_at,
        domain,
        type: "session",
      },
      "7d",
    );

    return res.status(200).json({
      success: true,
      message: "ok",
      data: {
        session: {
          member_token: token,
          token_type: "Member",
          header: "X-LocketDio-Member",
          expires_in: 60 * 60 * 24 * 7,
          issued_at: Math.floor(Date.now() / 1000),
        },
        ...userPlan,
      },
    });
  } catch (error) {
    logError("planController", "❌ Lấy gói thất bại", error.message);
    next(error);
  }
};

const UpdateplanController = async (req, res, next) => {
  const { uid, email, phone, name, picture } = req.user;
  const { username } = req.body;
  try {
    await planServices.updateInfoUserPlan({
      uid: uid,
      email: email,
      name: name,
      picture: picture,
      username: username,
      phone: phone,
    });

    res.status(200).json({
      success: true,
      message: "ok",
    });
  } catch (error) {
    logError("planController", "❌ Lấy gói thất bại", error.message);
    next(error);
  }
};

const validateCouponServer = async (req, res, next) => {
  try {
    const { code, planId, subtotal } = req.body;
    const uid = req.user?.uid || null;

    const data = await planServices.ValidateCoupon({
      code,
      planId,
      user_id: uid,
      subtotal: subtotal || null,
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error("❌ Lỗi validate coupon:", error);
    return res.status(500).json({
      valid: false,
      reason: "SERVER_ERROR",
      message: error.message,
    });
  }
};

const getMemberFamily = async (req, res, next) => {
  try {
    const uid = req.user?.uid || null;

    const result = await planServices.getMemberFamily(uid);

    responseSuccess(res, result);
  } catch (error) {
    console.error("❌ Lỗin get:", error);
    next(error);
  }
};

module.exports = {
  planControllerV2,
  UpdateplanController,
  validateCouponServer,
  getMemberFamily,
};
