const avatarService = require("./avatar.service");
const momentService = require("./moment.service");

module.exports = {
  ...avatarService,
  ...momentService,
};
