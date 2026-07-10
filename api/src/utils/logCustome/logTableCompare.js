const { logTable } = require("../logEventUtils");

/**
 * So sánh 2 object và log bảng với định dạng "cũ => mới" nếu có thay đổi
 * @param {string} caller - Tên hàm hoặc module gọi log
 * @param {Object} oldData - Dữ liệu cũ
 * @param {Object} newData - Dữ liệu mới
 * @param {string} [title="Stat Changes"] - Tiêu đề bảng
 */
const logTableCompare = (caller, oldData, newData, title = "Stat Changes") => {
  const keys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);

  const rows = [];

  keys.forEach((key) => {
    const oldVal = oldData?.[key] ?? "(null)";
    const newVal = newData?.[key] ?? "(null)";
    const isChanged = oldVal !== newVal;

    rows.push({
      Field: key,
      Value: isChanged ? `${oldVal} => ${newVal}` : `${newVal}`,
    });
  });

  logTable(caller, rows, title);
};
module.exports = {
  logTableCompare,
};
