const { friendservices, requestservices } = require("./LocketFriend");
const { authServices, phoneServices } = require("./AuthSecurity");
const {
  dioStats,
  planServices,
  getAppleMusicMeta,
} = require("./DioServices");
const messageServices = require("./LocketChat");
const storageServices = require("./StorageServices")

module.exports = {
  authServices,
  phoneServices,

  friendservices,
  requestservices,

  messageServices,

  storageServices,
  dioStats,
  planServices,
};
