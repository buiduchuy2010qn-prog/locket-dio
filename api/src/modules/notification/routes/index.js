const express = require("express");
const { verifyIdToken } = require("../../../middlewares/Auth");
const {
  pushController,
  pushSendController,
  setNotificationToken,
  testPushController,
} = require("../controllers/webpush.controller");

const notificationRoutes = express.Router();

// Enpoint liên quan đến hệ thống push notification
notificationRoutes.post("/push/register", pushController);       // Đăng ký nhận push
notificationRoutes.post("/push/send", pushSendController);       // Admin gửi push
notificationRoutes.post("/push/test", testPushController);       // Test push cho 1 user
notificationRoutes.post("/setNotificationToken", verifyIdToken, setNotificationToken);

module.exports = { notificationRoutes };
