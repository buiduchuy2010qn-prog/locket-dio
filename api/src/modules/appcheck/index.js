const { initializeAppCheck } = require("./middlewares");
const { appCheckRoutes } = require("./routes");

module.exports = {
  appCheckRoutes,
  initializeAppCheck,
};
