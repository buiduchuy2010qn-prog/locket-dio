/**
 * Temp media store for self-host (no Dio R2 membership).
 * Files live in memory + /tmp with short TTL so postMoment can download them.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TTL_MS = 30 * 60 * 1000; // 30 min
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const store = new Map(); // id -> { buffer, contentType, name, size, exp, path }

const tmpRoot = path.join(os.tmpdir(), "huy-locket-media");
if (!fs.existsSync(tmpRoot)) {
  fs.mkdirSync(tmpRoot, { recursive: true });
}

function cleanup() {
  const now = Date.now();
  for (const [id, item] of store.entries()) {
    if (item.exp < now) {
      store.delete(id);
      try {
        if (item.filePath && fs.existsSync(item.filePath)) {
          fs.unlinkSync(item.filePath);
        }
      } catch {}
    }
  }
}

setInterval(cleanup, 60_000).unref?.();

function createSlot({ contentType, name, size, uid }) {
  cleanup();
  const id = crypto.randomBytes(16).toString("hex");
  const filePath = path.join(tmpRoot, `${id}.bin`);
  const exp = Date.now() + TTL_MS;
  store.set(id, {
    buffer: null,
    contentType: contentType || "application/octet-stream",
    name: name || `upload_${id}`,
    size: Number(size) || 0,
    uid: uid || null,
    exp,
    filePath,
    ready: false,
  });
  return id;
}

function putBuffer(id, buffer, contentType) {
  const item = store.get(id);
  if (!item) return { ok: false, error: "not_found" };
  if (item.exp < Date.now()) {
    store.delete(id);
    return { ok: false, error: "expired" };
  }
  if (buffer.length > MAX_BYTES) {
    return { ok: false, error: "too_large" };
  }
  item.buffer = buffer;
  item.size = buffer.length;
  if (contentType) item.contentType = contentType;
  item.ready = true;
  try {
    fs.writeFileSync(item.filePath, buffer);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  store.set(id, item);
  return { ok: true, item };
}

function get(id) {
  cleanup();
  const item = store.get(id);
  if (!item) return null;
  if (item.exp < Date.now()) {
    store.delete(id);
    return null;
  }
  if (!item.buffer && item.filePath && fs.existsSync(item.filePath)) {
    try {
      item.buffer = fs.readFileSync(item.filePath);
    } catch {
      return null;
    }
  }
  return item;
}

module.exports = {
  createSlot,
  putBuffer,
  get,
  MAX_BYTES,
  TTL_MS,
};
