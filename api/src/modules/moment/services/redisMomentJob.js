const { momentConfig } = require("../config");
const { redisMoment } = require("../redis");

const MOMENT_KEY = (id) => `moment:job:${id}`;

const { postMomentTTL } = momentConfig.redisCache;

// ======================
// CREATE MOMENT JOB
// ======================
exports.createMomentJob = async (momentId, payload = {}) => {
  const key = MOMENT_KEY(momentId);

  await redisMoment.hSet(key, {
    status: "pending",
    progress: 0,
    thumbnailUrl: "",
    videoUrl: "",
    error: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...payload,
  });

  await redisMoment.expire(key, postMomentTTL);

  return momentId;
};

// ======================
// UPDATE MOMENT JOB
// ======================
exports.updateMomentJob = async (momentId, payload = {}) => {
  const key = MOMENT_KEY(momentId);

  await redisMoment.hSet(key, {
    ...payload,
    updatedAt: Date.now(),
  });

  // optional: refresh TTL nếu muốn job sống lâu hơn khi đang xử lý
  await redisMoment.expire(key, postMomentTTL);

  return true;
};

// ======================
// GET MOMENT JOB
// ======================
exports.getMomentJob = async (momentId) => {
  const key = MOMENT_KEY(momentId);

  const data = await redisMoment.hGetAll(key);

  if (!data || Object.keys(data).length === 0) return null;

  return {
    ...data,
    progress: Number(data.progress || 0),
  };
};