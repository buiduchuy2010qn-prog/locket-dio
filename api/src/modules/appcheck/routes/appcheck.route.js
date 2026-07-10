const router = require("express").Router();

const { controller } = require("../controllers");
const { verifyCollabToken } = require("../middlewares");

router.get("/getTokenAppCheck", verifyCollabToken, controller.getAppCheckController);
router.post("/registerDeviceToken", controller.registerAppCheckController);

module.exports = router;
