const CAPTION_IDS = ["ootd", "miss_you", "good_night"];

const getRandomCaptionId = () => {
  const random = Math.floor(Math.random() * CAPTION_IDS.length);
  return CAPTION_IDS[random];
};
module.exports = {
  getRandomCaptionId,
};
