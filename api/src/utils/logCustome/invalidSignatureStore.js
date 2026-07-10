const fs = require("fs");
const path = require("path");
const os = require("os");

const tmpBaseDir = path.join(os.tmpdir(), "invalid-signatures.json");

const FILE_PATH = tmpBaseDir;

const ensureFileExists = () => {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({}));
  }
};

const readStore = () => {
  ensureFileExists();

  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  } catch {
    return {};
  }
};

const writeStore = (data) => {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
};

const hasInvalidSignatureLog = (key) => {
  const store = readStore();

  return !!store[key];
};

const markInvalidSignatureLog = (key, extra = {}) => {
  const store = readStore();

  store[key] = {
    createdAt: new Date().toISOString(),
    ...extra,
  };

  writeStore(store);
};

module.exports = {
  hasInvalidSignatureLog,
  markInvalidSignatureLog,
};
