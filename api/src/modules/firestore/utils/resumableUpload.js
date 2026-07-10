/**
 * Xây dựng URL tải lên có thể tiếp tục (resumable upload url) và URL đối tượng trên Firebase Storage.
 *
 * @param {Object} params
 * @param {string} params.bucket - Tên Firebase storage bucket (ví dụ: 'locket-img' hoặc 'locket-video')
 * @param {string} params.objectPath - Đường dẫn đầy đủ của tệp đích trên bucket
 * @returns {{ uploadUrl: string, objectUrl: string }} Trả về đối tượng chứa uploadUrl và objectUrl
 */
const buildResumableUploadUrl = ({ bucket, objectPath }) => {
  const encodedPath = encodeURIComponent(objectPath);
  const objectUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}`;

  return {
    uploadUrl: `${objectUrl}?uploadType=resumable&name=${objectPath}`,
    objectUrl,
  };
};

module.exports = {
  buildResumableUploadUrl,
};
