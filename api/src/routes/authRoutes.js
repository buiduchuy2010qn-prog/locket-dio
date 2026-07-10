const express = require("express");

const {
  logout,
  loginV2,
  refreshIdTokenControll,
  changeProfileInfo,
  loginAndCaptchaV2,
} = require("../controllers");
const loginLimiter = require("../middlewares/loginLimiter");
const { getLimiter, refreshLimiter, loginV2Limiter } = require("../middlewares/rateLimit");
const { logRequestInfo } = require("../middlewares/logRequestInfo");
const { verifyIdToken } = require("../middlewares/Auth");
const { resetPasswordControll, getInfoByToken, loginPhoneController } = require("../controllers/authController");

const router = express.Router();

//Endpoint liên quan đến Auth
router.post("/loginV2", logRequestInfo, loginV2);

router.post("/loginWithPhoneV2", logRequestInfo, loginPhoneController)

router.post("/loginV3", loginAndCaptchaV2);
router.get("/logout", logout);
router.post("/refresh-token", logRequestInfo, refreshIdTokenControll);

router.get("/getInfoUser", verifyIdToken, getInfoByToken);
router.post("/resetPassword", resetPasswordControll);

// Định tuyến cho thay đổi thông tin profile
router.post("/changeProfileInfo", changeProfileInfo);

module.exports = router;
