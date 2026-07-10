// middlewares/validateOverlayType.js

const allowedTypes = new Set([
  "default",
  "decorative",
  "custome",
  "custom",
  "image_icon",
  "image_gif",
  "caption_image",
  "caption_gif",
  "template",
  "star_sign",
  "caption_link",
  "time",
  "review",
  "music",
  "battery",
  "heart",
  "streak",
  "location",
  "weather",
  "special",
  "color_palette",
  "poll",
]);

const validateOverlayType = (req, res, next) => {
  try {
    const type = req.body?.optionsData?.type;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type is null or undefined",
      });
    }

    if (!allowedTypes.has(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid or unsupported overlay type: ${type}`,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  validateOverlayType,
};
