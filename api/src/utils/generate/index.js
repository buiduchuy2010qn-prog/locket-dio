const { generateFirestoreId } = require("./generateFirestoreId");
const { generateUUIDv4Upper, generateUUIDv4 } = require("./generateUUIDv4Upper");
const { getRandomCaptionId } = require("./getRandomCaptionId");

module.exports = {
  generateFirestoreId,
  getRandomCaptionId,
  generateUUIDv4,
  generateUUIDv4Upper,
};
