// Decode Firebase/Locket JWT payload (base64) — no secrets stored here.

const decodeLocketJWT = (token) => {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (err) {
    console.error("❌ Decode token failed:", err);
    return null;
  }
};

module.exports = {
  decodeLocketJWT,
};
