const { normalizeFriendRequets } = require("./normalizeFriendRequest");
const { normalizeReactions } = require("./normalizeInfoReactions");
const { normalizeViews } = require("./normalizeInfoViews");
const { normalizeMessage } = require("./normalizeMessage");
const { normalizeMoment } = require("./normalizeMoment");

module.exports = {
  normalizeFriendRequets,
  normalizeReactions,
  normalizeViews,
  normalizeMoment,
  normalizeMessage,
};
