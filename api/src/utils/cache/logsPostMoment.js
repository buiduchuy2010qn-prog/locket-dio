const fs = require("fs");
const path = require("path");

const BASE_PATH = path.resolve(process.cwd(), "logs/postMoments");
const TTL_DAYS = 2;

// ===============================
// Utils
// ===============================

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getTodayFileName = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `D-${day}-${month}-${year}.json`;
};

const getTodayFilePath = () => {
  return path.join(BASE_PATH, getTodayFileName());
};

const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("JSON parse error:", err);
    return {};
  }
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ===============================
// Core
// ===============================

const markAsProcessed = async (filePath) => {
  ensureDir(BASE_PATH);

  const jsonPath = getTodayFilePath();
  const data = readJson(jsonPath);

  data[filePath] = Date.now(); // key-value

  writeJson(jsonPath, data);
};

const isAlreadyProcessed = async (filePath) => {
  const jsonPath = getTodayFilePath();

  if (!fs.existsSync(jsonPath)) return false;

  const data = readJson(jsonPath);
  return !!data[filePath];
};

// ===============================
// Cleanup file cũ
// ===============================

const cleanupOldFiles = () => {
  if (!fs.existsSync(BASE_PATH)) return;

  const files = fs.readdirSync(BASE_PATH);
  const now = Date.now();

  files.forEach((file) => {
    const filePath = path.join(BASE_PATH, file);
    const stats = fs.statSync(filePath);

    const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    if (ageInDays > TTL_DAYS) {
      fs.unlinkSync(filePath);
      console.log("Deleted old file:", file);
    }
  });
};

module.exports = {
  markAsProcessed,
  isAlreadyProcessed,
  cleanupOldFiles,
};

// project-root/
//  └── logs/
//       └── postMoments/
//            ├── D-14-02-2026.json
//            ├── D-15-02-2026.json
//            └── D-16-02-2026.json

// {
//   "uploads/user1/post_17395822.jpg": 1739592000000,
//   "uploads/user2/post_17395823.jpg": 1739592015234,
//   "uploads/user5/video_998812.mp4": 1739592054321,
//   "uploads/user7/post_abc123.png": 1739592089999
// }
