const jwt = require("jsonwebtoken");
const { security } = require("../../config/app.config");

// Set LOCKETDIO_JWT_SECRET / COOKIE_SECRET on Railway — never hardcode
function resolveJwtSecret() {
  const s =
    security.jwtSecret ||
    process.env.LOCKETDIO_JWT_SECRET ||
    process.env.COOKIE_SECRET ||
    "";
  if (!s) {
    throw new Error(
      "LOCKETDIO_JWT_SECRET (or COOKIE_SECRET) is not configured",
    );
  }
  return s;
}

const signToken = (payload, expiresIn = "30d") => {
  return jwt.sign(payload, resolveJwtSecret(), { expiresIn });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, resolveJwtSecret());
  } catch {
    return null;
  }
};

module.exports = {
  signToken,
  verifyToken,
};