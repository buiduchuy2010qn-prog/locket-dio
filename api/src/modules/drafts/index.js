const { draftRoutes, draftUploadLimiter } = require("./routes");
const draftsController = require("./drafts.controller");

module.exports = {
  draftRoutes,
  draftUploadLimiter,
  draftsController,
};
