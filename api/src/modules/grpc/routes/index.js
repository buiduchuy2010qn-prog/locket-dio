const express = require("express");
const { verifyIdToken } = require("../../../middlewares/Auth/verifyIdToken");
const {
  getMessagesWithUser,
  getListMessages,
  getListMoments,
  getListFriends,
  getListMessagesV2,
  getInfoMoments,
} = require("../controllers/restRpgc");
const { checkAppMeta } = require("../../../middlewares/checkMeta");
const { verifyDioToken } = require("../../../middlewares/Auth");

const rpgcRoutes = express.Router();

rpgcRoutes.post("/getMessageWithUserV2", verifyIdToken, getMessagesWithUser);
rpgcRoutes.post("/getAllMessageV2", verifyIdToken, getListMessages);
rpgcRoutes.post("/getAllMessageV3", verifyIdToken, getListMessagesV2);

rpgcRoutes.post("/getMomentV2", verifyIdToken, getListMoments);
rpgcRoutes.post("/getAllFriendsV2", verifyIdToken, getListFriends);

// rpgcRoutes.post("/getInfoMomentV2", checkAppMeta, verifyIdToken, verifyDioToken, getInfoMoments);
rpgcRoutes.post("/getMomentReactions", checkAppMeta, verifyIdToken, verifyDioToken, getInfoMoments);
// rpgcRoutes.post("/getMomentMetadata", checkAppMeta, verifyIdToken, verifyDioToken, getInfoMoments);

module.exports = { rpgcRoutes };
