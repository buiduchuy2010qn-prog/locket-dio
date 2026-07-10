const jwt = require("jsonwebtoken");
const { security } = require("../../config/app.config")

const jwtToken = security.jwtSecret;

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