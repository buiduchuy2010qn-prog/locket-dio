const jwt = require("jsonwebtoken");
const { security } = require("../../config/app.config");

// Set LOCKETDIO_JWT_SECRET / COOKIE_SECRET on Railway — never hardcode
const jwtToken =
  security.jwtSecret ||
  process.env.LOCKETDIO_JWT_SECRET ||
  process.env.COOKIE_SECRET ||
  "";

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