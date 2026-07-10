const { actionMoments } = require("../modules/moment");
const { logInfo, logSuccess } = require("../utils/logEventUtils");

const GetMomentsControll = async (req, res, next) => {
  try {
    const { idToken, uid } = req.user;
    const { pageToken, userUid, limit = 20 } = req.body;
    // 1. Gọi service lấy moments
    const data = await actionMoments.getLocketMoments(
      idToken,
      uid,
      pageToken,
      userUid,
      limit
    );

    // 2. Trả về client
    return res.status(200).json({
      success: true,
      data: data.moments,
      nextPageToken: data.nextPageToken || null,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy moments:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};

const GetInfoMomentsControll = async (req, res, next) => {
  try {
    const { idToken, uid } = req.user;
    const { idMoment } = req.body;
    // 1. Gọi service lấy moments
    const data = await actionMoments.getInfoLocketMoments(idToken, idMoment);

    // 2. Trả về client
    return res.status(200).json({
      success: true,
      data: data,
      nextPageToken: null,
      message: "ok",
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy thông tin moments:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};

const ReactMomentsControll = async (req, res, next) => {
  try {
    const { idToken, uid } = req.user;
    const { reactionInfo } = req.body;

    // 1. Gọi service lấy moments
    const data = await actionMoments.ReactPostLocketMoments(
      idToken,
      uid,
      reactionInfo
    );
    console.log(data);

    // 2. Trả về đúng format result
    const status = data?.result?.status || 500;
    const responseData = Array.isArray(data?.result?.data)
      ? data.result.data
      : [];

    // 3. Nếu status === 200 mới trả về data
    if (status === 200) {
      logSuccess("ReactMomentsControll", "Gửi cảm xúc thành công!");
      return res.status(200).json({
        success: true,
        data: responseData,
        status: 200,
      });
    } else {
      return res.status(status).json({
        success: false,
        message:
          data?.result?.message || "Đã xảy ra lỗi khi xử lý cảm xúc moments",
        status,
      });
    }
  } catch (error) {
    console.error("❌ Lỗi khi gửi cảm xúc moments:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};

const SendMessageControll = async (req, res, next) => {
  try {
    const { idToken, uid } = req.user;
    const { MessageInfo } = req.body;
    // 1. Gọi service lấy moments
    const data = await actionMoments.SendChatLocketMoments(
      idToken,
      uid,
      MessageInfo
    );

    // 2. Trả về client
    return res.status(200).json({
      success: true,
      data: data,
      message: "ok",
    });
  } catch (error) {
    console.error("❌ Lỗi khi gửi tin nhắn:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};

const GetLastestMomentsControll = async (req, res, next) => {
  try {
    const { idToken, uid } = req.user;
    // 1. Gọi service lấy moments
    const data = await actionMoments.GetLastestLocketMoments(idToken, uid);

    // 2. Trả về client
    return res.status(200).json({
      success: true,
      data: data?.result,
      message: null,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy moments:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};
module.exports = {
  GetMomentsControll,
  GetInfoMomentsControll,
  ReactMomentsControll,
  SendMessageControll,
  GetLastestMomentsControll,
};
