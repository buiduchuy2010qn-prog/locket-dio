const { v4: uuidv4 } = require("uuid");

function generateUUIDv4() {
  return uuidv4();
}

// Hàm tạo UUID v4 dạng uppercase
function generateUUIDv4Upper() {
  return uuidv4().toUpperCase();
}

module.exports = {
  generateUUIDv4Upper,
  generateUUIDv4,
};