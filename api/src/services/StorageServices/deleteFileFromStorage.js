const { instanceStorage } = require("../../libs");

const deleteFileFromStorageR2 = async (filePath) => {
  try {
    const body = {
      key: filePath,
    };

    const res = await instanceStorage.post("/api/delete", body);

    // axios trả về data trực tiếp
    const data = res.data;

    if (data.success) {
      console.log(`✅ Deleted from R2: ${filePath} | Message: ${data.message}`);
      return { success: true, message: data.message };
    } else {
      console.error(
        `❌ Delete failed (R2): ${filePath}`,
        data.error || "Unknown error",
      );
      return { success: false, error: data.error || "Delete failed" };
    }
  } catch (error) {
    console.error(`❌ Failed to delete from R2: ${filePath}`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  deleteFileFromStorageR2,
};
