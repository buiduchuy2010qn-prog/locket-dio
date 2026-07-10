function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payloadBase64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // Node.js không có sẵn atob, dùng Buffer thay thế
    const jsonStr = Buffer.from(payloadBase64, "base64").toString("utf-8");

    const data = JSON.parse(jsonStr);
    // console.log("userId", data?.user_id);

    return data;
  } catch (e) {
    console.error("Failed to decode JWT:", e);
    return null;
  }
}

module.exports = { decodeJwt };
