const { logTable } = require("../logEventUtils");

const logTableRequest = (caller, data, title = "Stat Changes") => {
  const keys = Object.keys(data || {});
  const rows = [];

  keys.forEach((key) => {
    let value = data[key] ?? "(null)";
    if (typeof value !== "string") value = String(value);

    if (key === "User-Agent") {
      const chunkSize = 40;
      const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, "g"));
      chunks.forEach((chunk, index) => {
        rows.push({
          Field: index === 0 ? key : "",
          Value: chunk,
        });
      });
      return; // bỏ qua push phía dưới
    }

    rows.push({
      Field: key,
      Value: value,
    });
  });

  logTable(caller, rows, title);
};

module.exports = {
  logTableRequest,
};
