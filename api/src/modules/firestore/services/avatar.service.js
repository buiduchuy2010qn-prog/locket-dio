const fs = require("fs");
const { logInfo, logError } = require("../../../utils/logEventUtils");
const {
  instanceFirestoreUpload,
  instanceFirestoreInit,
  instanceFirestoreGet,
} = require("../utils/http");
const { buildResumableUploadUrl } = require("../utils/resumableUpload");
const { generateUUIDv4 } = require("../../../utils/generate");

/**
 * Tải ảnh đại diện cá nhân (avatar) của người dùng lên Firebase Storage.
 *
 * @param {string} localId - ID người dùng (uid)
 * @param {string} idToken - Firebase ID token dùng để xác thực
 * @param {File|Buffer} fileBuffer - Dữ liệu tệp ảnh đại diện (có thể là Buffer hoặc đối tượng File có path)
 * @returns {Promise<string>} Trả về URL tải về công khai chứa token xác thực
 */
const uploadUserAvatar = async (localId, idToken, fileBuffer) => {
  try {
    logInfo("uploadUserAvatar", "Start");

    const imageName = "profile_pic.webp";
    const fileSize = fileBuffer.size || fileBuffer.length;

    logInfo("uploadUserAvatar", "Create name Avatar", {
      localId,
      imageName,
      fileSize,
    });

    // Bước 1: Xác định đường dẫn đích trên Firebase Storage
    const objectPath = `users/${localId}/public/${imageName}`;

    // Bước 2: Tạo link upload và URL gốc của tệp tin trên bucket
    const { uploadUrl, objectUrl } = buildResumableUploadUrl({
      bucket: "locket-img",
      objectPath: objectPath,
    });

    const body = {
      name: objectPath,
      contentType: "image/webp",
      bucket: "",
      metadata: null,
      cacheControl: "private, max-age=0",
    };

    // Bước 3: Gửi yêu cầu khởi tạo session upload để lấy Upload URL từ Firebase
    const response = await instanceFirestoreInit.post(uploadUrl, body, {
      meta: {
        idToken,
        fileSize,
        contentType: "image/webp",
      },
    });

    const resumableUploadUrl = response.headers["x-goog-upload-url"];
    if (!resumableUploadUrl) {
      throw new Error("Missing upload URL in Firebase response headers");
    }

    // Bước 4: Chuyển đổi dữ liệu ảnh thành Buffer
    let imageBuffer;
    if (fileBuffer instanceof Buffer) {
      imageBuffer = fileBuffer;
    } else {
      imageBuffer = fs.readFileSync(fileBuffer.path);
    }

    // Bước 5: Upload dữ liệu binary lên Firebase Storage
    try {
      await instanceFirestoreUpload.put(resumableUploadUrl, imageBuffer);
    } catch (err) {
      console.error("Upload error detail:", err);
      throw new Error("Failed to upload avatar data to Firebase Storage");
    }

    // Bước 6: Lấy metadata của ảnh vừa tải lên để nhận downloadToken
    const getRes = await instanceFirestoreGet.get(objectUrl, {
      meta: { idToken },
    });

    if (!getRes?.data?.downloadTokens) {
      throw new Error("Missing download tokens in uploaded file metadata");
    }

    const downloadToken = getRes.data.downloadTokens;

    logInfo("uploadUserAvatar", "End");

    // Bước 7: Trả về liên kết URL hoàn thiện chứa token tải xuống
    const finalUrl = `${objectUrl}?alt=media&token=${downloadToken}`;
    return finalUrl;
  } catch (error) {
    logError("uploadUserAvatar", error.message);
    throw error;
  } finally {
    // Bước 8: Dọn dẹp tệp tin tạm trên đĩa
    if (fileBuffer.path) {
      try {
        fs.unlinkSync(fileBuffer.path);
      } catch (unlinkErr) {
        logError("uploadUserAvatar clean-up error", unlinkErr.message);
      }
    }
  }
};

/**
 * Tải ảnh đại diện nhóm (group avatar) lên Firebase Storage.
 *
 * @param {string} localId - ID của người dùng tạo nhóm (hoặc ID nhóm)
 * @param {string} idToken - Firebase ID token dùng để xác thực
 * @param {File|Buffer} fileBuffer - Dữ liệu tệp ảnh đại diện nhóm (Buffer hoặc đối tượng File có path)
 * @returns {Promise<string>} Trả về URL tải về công khai của ảnh nhóm chứa token xác thực
 */
const uploadGroupAvatar = async (localId, idToken, fileBuffer) => {
  try {
    logInfo("uploadGroupAvatar", "Start");

    const id = generateUUIDv4();
    const imageName = `${localId}-${id}`;
    const fileSize = fileBuffer.size || fileBuffer.length;

    logInfo("uploadGroupAvatar", "Create name Avatar", {
      localId,
      imageName,
      fileSize,
    });

    // Bước 1: Khởi tạo đường dẫn chứa tệp tin ảnh của nhóm
    const objectPath = `users/${localId}/public/group_profile_pics/${imageName}`;

    // Bước 2: Tạo link upload và URL gốc của tệp tin
    const { uploadUrl, objectUrl } = buildResumableUploadUrl({
      bucket: "locket-img",
      objectPath: objectPath,
    });

    const body = {
      name: objectPath,
      contentType: "image/webp",
      bucket: "",
      metadata: null,
      cacheControl: "private, max-age=0",
    };

    // Bước 3: Gửi yêu cầu khởi tạo session upload để lấy Upload URL từ Firebase
    const response = await instanceFirestoreInit.post(uploadUrl, body, {
      meta: {
        idToken,
        fileSize,
        contentType: "image/webp",
      },
    });

    const resumableUploadUrl = response.headers["x-goog-upload-url"];
    if (!resumableUploadUrl) {
      throw new Error("Missing upload URL in Firebase response headers");
    }

    // Bước 4: Chuyển đổi dữ liệu ảnh thành Buffer
    let imageBuffer;
    if (fileBuffer instanceof Buffer) {
      imageBuffer = fileBuffer;
    } else {
      imageBuffer = fs.readFileSync(fileBuffer.path);
    }

    // Bước 5: Upload dữ liệu binary lên Firebase Storage
    try {
      await instanceFirestoreUpload.put(resumableUploadUrl, imageBuffer);
    } catch (err) {
      console.error("Upload error detail:", err);
      throw new Error("Failed to upload group avatar data to Firebase Storage");
    }

    // Bước 6: Lấy metadata của ảnh nhóm vừa tải lên để nhận downloadToken
    const getRes = await instanceFirestoreGet.get(objectUrl, {
      meta: { idToken },
    });

    if (!getRes?.data?.downloadTokens) {
      throw new Error("Missing download tokens in uploaded file metadata");
    }

    const downloadToken = getRes.data.downloadTokens;

    logInfo("uploadGroupAvatar", "End");

    // Bước 7: Trả về liên kết URL hoàn thiện chứa token tải xuống
    const finalUrl = `${objectUrl}?alt=media&token=${downloadToken}`;
    return finalUrl;
  } catch (error) {
    logError("uploadGroupAvatar", error.message);
    throw error;
  } finally {
    // Bước 8: Dọn dẹp tệp tin tạm trên đĩa
    if (fileBuffer.path) {
      try {
        fs.unlinkSync(fileBuffer.path);
      } catch (unlinkErr) {
        logError("uploadGroupAvatar clean-up error", unlinkErr.message);
      }
    }
  }
};

module.exports = {
  uploadUserAvatar,
  uploadGroupAvatar,
};
