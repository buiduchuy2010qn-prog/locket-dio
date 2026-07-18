const authRoutes = require("./authRoutes");
const locketRoutes = require("./locketRoutes");
const { rpgcRoutes } = require("../modules/grpc");
const { appCheckRoutes } = require("../modules/appcheck");
const { weatherRoutes } = require("../modules/weather");
const { notificationRoutes } = require("../modules/notification");
const { musicRoutes } = require("../modules/music");
const { momentRoutes } = require("../modules/moment");
const { planRoutes } = require("../modules/locketdio");
const { storageRoutes } = require("../modules/storage/routes");
const { imageEnhancementRoutes } = require("../modules/imageEnhancement");
const { healthController } = require("../controllers");

module.exports = (app) => {
  app.get("/", (req, res) => {
    res.json({
      status: "success",
      message: "Huy Locket API is running",
      service: "huy-locket-api",
      docs: "See DEPLOY.md",
    });
  });

  app.get("/health", healthController);

  //Tạo tiền tố cho các route trong file authRoutes.js
  app.use("/locket", authRoutes); //http://localhost:5002/locket/login
  app.use("/locket", locketRoutes);
  app.use("/locket", momentRoutes);
  app.use("/locket", rpgcRoutes);

  app.use("/api", planRoutes);
  app.use("/api", notificationRoutes);
  app.use("/api", appCheckRoutes);
  app.use("/api", weatherRoutes);
  app.use("/api", musicRoutes);
  // Self-host temp media (presignedV3 + media-temp GET). PUT raw mounted in app.js
  app.use("/api", storageRoutes);
  // AI image enhancement (post-capture only; no camera/music coupling)
  app.use("/api", imageEnhancementRoutes);
};
