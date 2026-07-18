import fs from "fs";
import path from "path";

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rimraf(p);
    else fs.unlinkSync(p);
  }
  try { fs.rmdirSync(dir); } catch {}
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync("dist/index.html")) {
  console.error("[prepare-static] dist/ missing — run npm run build first");
  process.exit(1);
}

// Giữ static gốc (icons/images/...) — chỉ thay artifact build
// models = ESRGAN Slim 2x static weights for on-device AI Làm nét
const STATIC_KEEP = ["fonts", "icons", "images", "pwa-icons", "svg", "models"];
const backup = path.join(".tmp-static-keep");
rimraf(backup);
fs.mkdirSync(backup, { recursive: true });
for (const d of STATIC_KEEP) {
  const src = path.join("public", d);
  if (fs.existsSync(src)) copyDir(src, path.join(backup, d));
}

rimraf("public");
copyDir("dist", "public");

// Khôi phục static nếu dist thiếu (vite đã copy publicDir, thường đã có)
for (const d of STATIC_KEEP) {
  const fromBackup = path.join(backup, d);
  const dest = path.join("public", d);
  if (fs.existsSync(fromBackup) && !fs.existsSync(dest)) {
    copyDir(fromBackup, dest);
  }
}
rimraf(backup);

fs.writeFileSync("public/_redirects", "/*    /index.html   200\n");

// Ensure version.json is never swallowed by SPA rewrite on hosts that use _redirects
// (Netlify: explicit file still wins; keep a copy from dist if present)
if (fs.existsSync("dist/version.json") && !fs.existsSync("public/version.json")) {
  fs.copyFileSync("dist/version.json", "public/version.json");
}

const assetCount = fs.existsSync("public/assets")
  ? fs.readdirSync("public/assets").length
  : 0;
console.log(`[prepare-static] OK: dist -> public (${assetCount} assets)`);

