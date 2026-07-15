const fs = require("fs");

const {
  logInfo,
  logError,
  logBanner,
  logWarning,
} = require("../../../utils/logEventUtils");
const { videoPayloadV2 } = require("../payloads");
const { instanceLocketV2 } = require("../../../libs");
const {
  uploadMomentVideoThumbnail,
  uploadMomentVideo,
} = require("../../firestore");
const { generateFirestoreId } = require("../../../utils");
const {
  ensureMusicOptionsData,
} = require("../../music/services/ensureMusicPayload");

//#region postVideoToLocket
const postVideoToLocket = async (
  idToken,
  videoUrl,
  thumbnailUrl,
  rawOptions,
) => {
  try {
    let optionsData = rawOptions || {};
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
          "Thiếu link Apple Music / Spotify. Chọn lại bài rồi đăng.",
        );
        err.status = 400;
        throw err;
      }
    }
    const { type } = optionsData;
    // Xử lý theo từng loại type
    const postData = (() => {
      logBanner(`Type đang sử dụng: ${type}`); // Thêm log kiểm tra loại type
      switch (type) {
        //Loại mặc định đăng caption với nền mặc định
        case "default":
          return videoPayloadV2.videoPostPayloadDefault({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        //Loại caption decorative bởi Locket
        case "decorative":
          return videoPayloadV2.videoPostPayloadDecorative({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        //Loại caption được custom bởi Người dùng
        case "custome":
        case "custom":
          return videoPayloadV2.videoPostPayloadCustome({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "image_icon":
        case "image_gif":
        case "caption_image":
        case "caption_gif":
        case "template":
          return videoPayloadV2.videoPostPayloadImageIcon({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "star_sign":
          return videoPayloadV2.videoPostPayloadStarSign({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        //Loại caption decorative bởi Locket
        case "time":
          return videoPayloadV2.videoPostPayloadTime({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "review":
          return videoPayloadV2.videoPostPayloadReview({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "music":
          return videoPayloadV2.videoPostPayloadMusic({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "battery":
          return videoPayloadV2.videoPostPayloadBattery({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "heart":
          return videoPayloadV2.videoPostPayloadHeart({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });

        case "streak":
          return videoPayloadV2.videoPostPayloadStreak({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "locket_count":
          return videoPayloadV2.videoPostPayloadLocketCount({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "location":
          return videoPayloadV2.videoPostPayloadLocation({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "weather":
          return videoPayloadV2.videoPostPayloadWeather({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "special":
          return videoPayloadV2.videoPostPayloadEffect({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "color_palette":
          return videoPayloadV2.videoPostPayloadPalette({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        case "poll":
          return videoPayloadV2.videoPostPayloadPoll({
            videoUrl,
            thumbnailUrl,
            optionsData,
          });
        default:
          throw new Error(`Không hỗ trợ type: ${type}`);
      }
    })();

    // Gửi request tạo bài post
    const response = await instanceLocketV2.post("postMomentV2", postData, {
      meta: { idToken },
    });

    if (!response.data) {
      throw new Error(`Failed to create post: ${response?.statusText}`);
    }

    const responseData = await response.data; // 👈 Lấy dữ liệu JSON từ phản hồi

    logInfo("postVideoToLocket", "End");
    return responseData;
  } catch (error) {
    logError("postVideoToLocket", error.message);
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
//#endregion

const postVideoToLocketV2 = async ({
  idToken,
  localId,
  mediaData,
  optionsData,
}) => {
  try {
    // Kiểm tra xem mediaData có tồn tại và có thuộc tính fileBuffer không
    if (!mediaData || !mediaData.fileBuffer) {
      throw new Error("File buffer is missing from media data");
    }

    const { fileBuffer, thumbnail } = mediaData;

    logInfo("postVideoToLocketV2", "Start");

    // Sinh một mediaId duy nhất để thumbnail và video có cùng tên file (chỉ khác đuôi)
    // Ví dụ: abc123.webp (thumbnail) và abc123.mp4 (video)
    const mediaId = generateFirestoreId();
    logInfo("postVideoToLocketV2", `Shared mediaId: ${mediaId}`);

    // Kiểm tra xem fileBuffer là Buffer hay có thuộc tính path không
    let videoAsBuffer;
    if (Buffer.isBuffer(fileBuffer)) {
      videoAsBuffer = fileBuffer; // Nếu fileBuffer là Buffer, không cần phải đọc từ file
    } else if (fileBuffer && fileBuffer.path) {
      videoAsBuffer = fs.readFileSync(fileBuffer.path); // Nếu có path, đọc từ file
    } else {
      throw new Error("Invalid fileBuffer: path or Buffer is required.");
    }

    // Upload thumbnail trước, sử dụng mediaId chia sẻ → tên file: <mediaId>.webp
    const thumbnailUrl = await uploadMomentVideoThumbnail(
      localId,
      idToken,
      fileBuffer,
      thumbnail,
      mediaId,
    );

    if (!thumbnailUrl) {
      throw new Error("Failed to upload thumbnail");
    }

    // Upload video, sử dụng cùng mediaId → tên file: <mediaId>.mp4
    const videoUrl = await uploadMomentVideo(
      localId,
      idToken,
      videoAsBuffer,
      mediaId,
    );

    if (!videoUrl) {
      throw new Error("Failed to upload video");
    }

    const responseData = await postVideoToLocket(
      idToken,
      videoUrl,
      thumbnailUrl,
      optionsData,
    );

    logInfo("postVideoToLocketV2", "End");

    return responseData.result?.data || null;
  } catch (error) {
    logError("postVideoToLocketV2", error.message);
    throw error;
  } finally {
    // Kiểm tra xem video.path có tồn tại trước khi xóa
    if (mediaData && mediaData.fileBuffer && mediaData.fileBuffer.path) {
      fs.unlinkSync(mediaData.fileBuffer.path);
    }
  }
};

module.exports = {
  postVideoToLocketV2,
};
