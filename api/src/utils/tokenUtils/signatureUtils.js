const crypto = require("crypto");
const { security } = require("../../config/app.config");
const { logInfo } = require("../logEventUtils");

const signatureSecret =
  security.signatureSecret ||
  process.env.LOCKETDIO_SIGNATURE_SECRET ||
  process.env.COOKIE_SECRET ||
  "huy-locket-dev-signature-secret";

// Generate signature
const generateSignature = (value, secret = signatureSecret) => {
  return crypto
    .createHmac("sha256", secret)
    .update(String(value))
    .digest("hex");
};

// Verify signature
const verifySignature = (value, signature, secret = signatureSecret) => {
  // logInfo("verifySignature", `Verifying signature for value: ${value}`, { value, signature, signatureSecret });
  const expected = generateSignature(value, secret);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
};

module.exports = {
  generateSignature,
  verifySignature,
};
