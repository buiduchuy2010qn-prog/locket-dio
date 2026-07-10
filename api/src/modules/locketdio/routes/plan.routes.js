const planRoutes = require("express").Router();

const {
  verifyIdToken,
  verifyPlanAuthOrGuest,
} = require("../../../middlewares/Auth");
const { planController } = require("../controllers");

planRoutes.get("/getInfoFamily", verifyIdToken, planController.getMemberFamily);
planRoutes.get("/cn", verifyIdToken, planController.planControllerV2);
planRoutes.post("/u", verifyIdToken, planController.UpdateplanController);
planRoutes.post("/coupon/validate", verifyPlanAuthOrGuest, planController.validateCouponServer);

module.exports = { planRoutes };
