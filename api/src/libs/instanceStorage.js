const axios = require("axios");
const { services } = require("../config/app.config");

const instanceStorage = axios.create({
  baseURL: services.storageUrl,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

module.exports = { instanceStorage };
