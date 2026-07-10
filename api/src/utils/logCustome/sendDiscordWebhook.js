const axios = require("axios");
const FormData = require("form-data");

const WEBHOOK_URL = process.env.DISCORD_SECURITY_WEBHOOK;

const sendDiscordWebhook = async ({
  title = "Log",
  color = 0x5865f2,
  fields = {},
  content,
  threadId,
  files = [],
}) => {
  try {
    if (!WEBHOOK_URL) return;

    const url = threadId ? `${WEBHOOK_URL}?thread_id=${threadId}` : WEBHOOK_URL;

    const form = new FormData();

    form.append(
      "payload_json",
      JSON.stringify({
        content,

        embeds: [
          {
            title,
            color,

            fields: Object.entries(fields).map(([name, value]) => ({
              name,
              value: String(value || "null").slice(0, 1000),
              inline: true,
            })),

            timestamp: new Date().toISOString(),
          },
        ],
      }),
    );

    files.forEach((file, index) => {
      form.append(`files[${index}]`, Buffer.from(file.content), {
        filename: file.name,
        contentType: file.contentType || "application/json",
      });
    });

    await axios.post(url, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });
  } catch (err) {
    console.error("Discord webhook error:", err.message);
  }
};

module.exports = {
  sendDiscordWebhook,
};
