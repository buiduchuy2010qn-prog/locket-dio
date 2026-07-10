const express = require("express");
const { getInfoWeather, getInfoWeatherV2 } = require("../controllers");

const router = express.Router();

// Client Huy Locket gọi weatherV2 (raw) và weatherV3 (overlay)
router.post("/weatherV2", getInfoWeatherV2);
router.post("/weatherV3", getInfoWeather);

module.exports = router;
