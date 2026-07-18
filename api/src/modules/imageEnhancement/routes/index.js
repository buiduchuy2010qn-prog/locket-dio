const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { verifyIdToken } = require("../../../middlewares/Auth");
const ctrl = require("../controllers/enhancement.controller");
const { MAX_BYTES } = require("../services/validateImage");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

const enhanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.IMAGE_ENHANCE_RATE_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    String(req.user?.uid || req.user?.localId || req.ip || "anon"),
  message: {
    success: false,
    code: "RATE_LIMIT",
    message: "Quá nhiều yêu cầu AI — thử lại sau.",
  },
});

// Auth required on all routes
router.use(verifyIdToken);

router.get("/image-enhancement/status", ctrl.providerStatus);

router.post(
  "/image-enhancement/jobs",
  enhanceLimiter,
  upload.single("image"),
  ctrl.createJob,
);

router.get("/image-enhancement/jobs/:jobId", ctrl.getJob);
router.get("/image-enhancement/jobs/:jobId/result", ctrl.getResult);
router.delete("/image-enhancement/jobs/:jobId", ctrl.cancelJob);

module.exports = router;
