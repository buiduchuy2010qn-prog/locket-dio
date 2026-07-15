const {
  logInfo,
  logError,
  logBanner,
  logWarning,
} = require("../../../utils/logEventUtils");
const { instanceLocketV2 } = require("../../../libs");
const { uploadMomentImage } = require("../../firestore");
const { imagePayloadV2 } = require("../payloads");
const {
  ensureMusicOptionsData,
} = require("../../music/services/ensureMusicPayload");

const postImageToLocketV2 = async ({
  idToken,
  localId,
  mediaData,
  optionsData: rawOptions,
}) => {
  // Lấy các giá trị từ tokenData và optionsData
  let optionsData = rawOptions || {};
  // Music: bắt buộc isrc + (spotify_url | apple_music_url) — app Locket mới hiện
  if (optionsData.type === "music") {
    optionsData = await ensureMusicOptionsData(optionsData);
    const p = optionsData?.payload || {};
    if (!p.isrc) {
      const err = new Error(
        "Thiếu mã ISRC bài hát. Chọn lại bài từ tìm nhạc rồi đăng.",
      );
      err.status = 400;
      throw err;
    }
    if (!p.spotify_url && !p.apple_music_url) {
      const err = new Error(
        "Thiếu link Apple Music / Spotify. Chọn lại bài (ưu tiên có preview) rồi đăng.",
      );
      err.status = 400;
      throw err;
    }
    // iOS MusicKit hard-requires apple_music_url with track id
    if (!p.apple_music_url || !/[?&]i=\d{5,}/.test(String(p.apple_music_url))) {
      const err = new Error(
        "Thiếu Apple Music (?i=trackId) — iPhone sẽ im. Dán link Apple Music hoặc chọn bài khác.",
      );
      err.status = 400;
      throw err;
    }
    logInfo(
      "postImageToLocketV2",
      `Music OK isrc=${p.isrc} title=${p.song_title || p.song_name || ""} spotify=${p.spotify_url ? "yes" : "no"} apple=${(p.apple_music_url || "").slice(0, 90)} cover=${(optionsData.icon?.data || p.image_url || "").slice(0, 50)}`,
    );
  }
  const { type } = optionsData;
  const { fileBuffer } = mediaData;
  try {
    logInfo("postImageToLocketV2", "Start");

    // Upload ảnh lên Firebase và lấy URL
    const imageUrl = await uploadMomentImage(localId, idToken, fileBuffer);
    // Xử lý theo từng loại type
    const postData = (() => {
      logBanner(`Type đang sử dụng: ${type}`);
      switch (type) {
        //Loại mặc định đăng caption với nền mặc định
        case "default":
          return imagePayloadV2.imagePostPayloadDefault({
            imageUrl,
            optionsData,
          });
        //Loại caption decorative bởi Locket
        case "decorative":
          return imagePayloadV2.imagePostPayloadDecorative({
            imageUrl,
            optionsData,
          });
        //Loại caption được custom background + icon bởi Người dùng
        case "custome":
        case "custom":
          return imagePayloadV2.imagePostPayloadCustome({
            imageUrl,
            optionsData,
          });
        //Loại caption chỉ có icon hoặc gif, template
        case "image_icon":
        case "image_gif":
        case "caption_image":
        case "caption_gif":
        case "template":
          return imagePayloadV2.imagePostPayloadIcon({
            imageUrl,
            optionsData,
          });
        case "star_sign":
          return imagePayloadV2.imagePostPayloadStarSign({
            imageUrl,
            optionsData,
          });
        //Loại caption decorative bởi Locket
        case "caption_link":
          return imagePayloadV2.imagePostPayloadLink({
            imageUrl,
            optionsData,
          });
        //Loại caption decorative bởi Locket
        case "time":
          return imagePayloadV2.imagePostPayloadTime({ imageUrl, optionsData });
        case "review":
          return imagePayloadV2.imagePostPayloadReview({
            imageUrl,
            optionsData,
          });
        case "music":
          return imagePayloadV2.imagePostPayloadMusic({
            imageUrl,
            optionsData,
          });
        case "battery":
          return imagePayloadV2.imagePostPayloadBattery({
            imageUrl,
            optionsData,
          });
        case "heart":
          return imagePayloadV2.imagePostPayloadHeart({
            imageUrl,
            optionsData,
          });
        case "streak":
          return imagePayloadV2.imagePostPayloadStreak({
            imageUrl,
            optionsData,
          });
        case "locket_count":
          return imagePayloadV2.imagePostPayloadLocketCount({
            imageUrl,
            optionsData,
          });
        case "location":
          return imagePayloadV2.imagePostPayloadLocation({
            imageUrl,
            optionsData,
          });
        case "weather":
          return imagePayloadV2.imagePostPayloadWeather({
            imageUrl,
            optionsData,
          });
        case "special":
          return imagePayloadV2.imagePostPayloadEffect({
            imageUrl,
            optionsData,
          });
        case "color_palette":
          return imagePayloadV2.imagePostPayloadPalette({
            imageUrl,
            optionsData,
          });
        case "poll":
          return imagePayloadV2.imagePostPayloadPoll({
            imageUrl,
            optionsData,
          });
        default:
          throw new Error(`Không hỗ trợ type: ${type}`);
      }
    })();

    // Gửi request tạo bài post
    const postResponse = await instanceLocketV2.post("postMomentV2", postData, {
      meta: { idToken },
    });

    if (!postResponse.data) {
      throw new Error(`Failed to create post: ${postResponse?.statusText}`);
    }

    const responseData = await postResponse.data; // 👈 Lấy dữ liệu JSON từ phản hồi
    // console.log("📦 Dữ liệu phản hồi:", responseData);
    logInfo("postImageToLocketV2", "End");
    return responseData.result?.data || null;
  } catch (error) {
    logError("postImageToLocketV2", error.message);
    console.error("Status:", error.response?.status);
    console.error("Response:", error.response?.data);
    console.error("Message:", error.message);

    throw new Error(
      error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create post",
    );
  }
};

//Export module
module.exports = {
  postImageToLocketV2,
};
