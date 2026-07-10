const express = require("express");
const router = express.Router();

const { messageControll, friendcontroll, momentcontroll } = require("../controllers");
const { logRequestInfo } = require("../middlewares/logRequestInfo");
const { verifyIdToken, verifyplanAuth, verifyDioToken, onlyMemberCheck } = require("../middlewares/Auth");
const { checkAppMeta } = require("../middlewares/checkMeta");
const { initializeAppCheck } = require("../modules/appcheck");
const { validateOverlayType } = require("../middlewares/validateOverlayType");

//Moment V2
// router.post("/getMomentV2", verifyIdToken, momentcontroll.GetMomentsControll);

router.post("/getInfoMomentV2", checkAppMeta, verifyIdToken, verifyDioToken, momentcontroll.GetInfoMomentsControll);
router.get("/getLatestMomentV2", verifyIdToken, momentcontroll.GetLastestMomentsControll);
router.post("/reactMomentV2", verifyIdToken, momentcontroll.ReactMomentsControll);

//Message V2
// router.post("/getAllMessageV2", verifyIdToken, messageControll.GetAllMessagesControll);
router.post("/sendMessageV2", verifyIdToken, momentcontroll.SendMessageControll);

//Friend V2
router.post("/deleteFriendV2", verifyIdToken, friendcontroll.deleteFriendsController);

// ==================== Friend Requests V2 ====================
router.post("/sendFriendRequestV2", checkAppMeta, verifyIdToken, verifyDioToken, initializeAppCheck, friendcontroll.SendRequestToFriendsController);
router.post("/sendCelebrityRequestV2", checkAppMeta, verifyIdToken, verifyDioToken, initializeAppCheck, friendcontroll.SendRequestToCelebrityController);

router.post("/getIncomingFriendRequestsV2", verifyIdToken, friendcontroll.getFriendsRequestController);

router.post("/getAllRequestsV2", verifyIdToken, friendcontroll.getFriendsRequestControllerV2);

router.post("/getOutgoingFriendRequestsV2", verifyIdToken, friendcontroll.getOutgoingRequestsController);
// Xoá lời mời kết bạn
router.post("/deleteIncomingRequestV2", verifyIdToken, friendcontroll.deleteFriendsRequestController);
router.post("/deleteOutgoingRequestV2", verifyIdToken, friendcontroll.deleteOutgingRequestController);

router.post("/acceptFriendRequestV2", verifyIdToken, friendcontroll.AcceptFriendsController);

// Get Friend
router.post("/getUserByData", verifyIdToken, friendcontroll.getUserController);

module.exports = router;