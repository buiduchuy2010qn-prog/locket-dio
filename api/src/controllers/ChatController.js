const { messageServices } = require("../services");

const GetAllMessagesControll = async (req, res, next) => {
  try {
    const { idToken, uid } = req.user;
    const { pageToken, limit = 20 } = req.body;
    // 1. Gọi service lấy moments
    const data = await messageServices.getAllMessages(
      idToken,
      uid,
      pageToken,
      limit
    );

    // 2. Trả về client
    return res.status(200).json({
      success: true,
      data: data.messages,
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
module.exports = {
  GetAllMessagesControll,
};
