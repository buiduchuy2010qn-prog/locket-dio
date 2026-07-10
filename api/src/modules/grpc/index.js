const socketRpgc = require("./controllers/socketRpgc");
const { SocketNamespaces } = require("./models/socketModels");
const { rpgcRoutes } = require("./routes");

module.exports = {
  socketRpgc,
  rpgcRoutes,
  SocketNamespaces,
};
