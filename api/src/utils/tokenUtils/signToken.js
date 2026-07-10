const jwt = require("jsonwebtoken");
const { security } = require("../../config/app.config");

// Render generateValue sets LOCKETDIO_JWT_SECRET; fallback keeps plan session working
const jwtToken =
  security.jwtSecret ||
  process.env.LOCKETDIO_JWT_SECRET ||
  process.env.COOKIE_SECRET ||
  "huy-locket-dev-jwt-secret";

const signToken = (payload, expiresIn = "30d") => {
  return jwt.sign(payload, jwtToken, { expiresIn });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, jwtToken);
  } catch {
    return null;
  }
};

module.exports = {
  signToken,
  verifyToken,
};