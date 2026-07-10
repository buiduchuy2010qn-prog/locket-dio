const appCheckConfig = require("../config");
const axios = require("axios");

const { url, channels } = appCheckConfig.webhook;

const WEBHOOK_URL = url;

const THREAD_ERROR_ID = channels.error;
const THREAD_SUCCESS_ID = channels.success;

const sendAppCheckFailedWebhook = async ({ message = "Unknown error" }) => {
  try {
    if (!WEBHOOK_URL) return;

    await axios.post(`${WEBHOOK_URL}?thread_id=${THREAD_ERROR_ID}`, {
      // 👇 hiện ngoài message preview
      content: `🚨 AppCheck Failed: ${String(message).slice(0, 150)}`,

      embeds: [
        {
          title: "🚨 AppCheck Failed",
          color: 0xed4245,

          description:
            typeof message === "string"
              ? message.slice(0, 4000)
              : JSON.stringify(message, null, 2).slice(0, 4000),

          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("sendAppCheckFailedWebhook error:", err.message);
  }
};

module.exports = {
  sendAppCheckFailedWebhook,
};
