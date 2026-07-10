const { logout, loginV2, refreshIdTokenControll, changeProfileInfo, loginAndCaptchaV2 } = require("./authController");
const friendcontroll = require("./FriendsController");
const messageControll = require("./ChatController");
const momentcontroll = require("./MomentController");
const { healthController } = require("./systemController");

module.exports = {
    loginV2,
    logout,
    refreshIdTokenControll,
    changeProfileInfo,
    friendcontroll,
    loginAndCaptchaV2,
    messageControll,
    momentcontroll,
    healthController
};
