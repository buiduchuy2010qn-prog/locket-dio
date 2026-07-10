const { logInfo, logError, logSuccess } = require("../../../utils/logEventUtils");
const { RegisterPush, SyncRegisterPush, sendPushNotification, testPushNotification } = require("../services/webpush.service");

const pushController = async (req, res, next) => {
  logInfo("pushController", "📩 Nhận yêu cầu đăng ký thông báo...");
  const { subscription } = req.body;
  const origin = req.headers.origin;

  try {
    const respon = await RegisterPush(subscription, origin);

    logSuccess("pushController", "✅ Đăng ký thành công!");

    res.status(200).json({
      success: true,
      message: "Đăng ký thông báo thành công!",
      data: respon,
    });
  } catch (error) {
    logError("pushController", "❌ Đăng ký thất bại", error.message);
    next(error); // Chuyển lỗi đến middleware xử lý lỗi
  }
};

const setNotificationToken = async (req, res, next) => {
  logInfo("setNotificationToken", "📩 Nhận yêu cầu đăng ký thông báo...");
  const { data } = req.body;
  const { localId } = req.user;
  try {
    await SyncRegisterPush(data, localId);

    logSuccess("setNotificationToken", "✅ Đăng ký thành công!");

    res.status(200).json({
      success: true,
      message: "ok!",
      data: null,
    });
  } catch (error) {
    logError("setNotificationToken", "❌ Đăng ký thất bại", error.message);
    next(error); // Chuyển lỗi đến middleware xử lý lỗi
  }
};

const pushSendController = async (req, res, next) => {
  const {
    title = "🔔 Thông báo mới",
    body = "Bạn có thông báo mới!",
    url = "https://locket-dio.com",
  } = req.body;

  try {
    const result = await sendPushNotification({ title, body, url });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logError("pushSend", "❌ Gửi thất bại", error.message);
    next(error);
  }
};

const testPushController = async (req, res, next) => {
  const {
    endpoint,
    title = "🔔 Thông báo test",
    body = "Đây là thông báo test!",
    url = "https://locket-dio.com",
  } = req.body;

  if (!endpoint) {
    return res.status(400).json({ success: false, message: "Thiếu trường endpoint trong body" });
  }

  try {
    const result = await testPushNotification({ endpoint, title, body, url });
    res.json({
      success: true,
      message: "Test gửi thông báo thành công!",
      ...result,
    });
  } catch (error) {
    logError("testPushSend", "❌ Test gửi thất bại", error.message);
    next(error);
  }
};

module.exports = {
  pushController,
  setNotificationToken,
  pushSendController,
  testPushController
};
