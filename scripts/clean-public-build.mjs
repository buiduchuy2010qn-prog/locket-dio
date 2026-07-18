/**
 * Xóa artifact build cũ trong public/ trước khi vite build.
 * Vite copy public → dist; nếu public còn assets/*.js hash cũ → phình gấp đôi mỗi lần build.
 */
import fs from "fs";
import path from "path";

const PUBLIC = "public";

const KEEP_DIRS = new Set([
  "fonts",
  "icons",
  "images",
  "pwa-icons",
  "svg",
  "models", // legacy
  "ai-models", // ESRGAN Slim 2x v1 for on-device AI Làm nét
]);

const REMOVE_ROOT_FILES = new Set([
  "index.html",
  "sw.js",
  "sw.mjs",
  "manifest.webmanifest",
  "_redirects",
]);

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

if (!fs.existsSync(PUBLIC)) {
  console.log("[clean-public-build] no public/ — skip");
  process.exit(0);
}

// Xóa toàn bộ public/assets (chỉ chứa ra từ vite)
rimraf(path.join(PUBLIC, "assets"));

// Xóa file root do vite/prepare-static tạo
for (const name of fs.readdirSync(PUBLIC)) {
  const full = path.join(PUBLIC, name);
  const st = fs.statSync(full);
  if (st.isDirectory()) {
    if (!KEEP_DIRS.has(name)) {
      // giữ thư mục lạ nếu có (vd: locales) — chỉ xóa assets đã xử lý
      continue;
    }
    continue;
  }
  if (REMOVE_ROOT_FILES.has(name)) {
    fs.unlinkSync(full);
  }
}

console.log("[clean-public-build] OK: stripped build artifacts from public/");
