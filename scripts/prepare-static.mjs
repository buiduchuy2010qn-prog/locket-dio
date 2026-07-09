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

rimraf("public");
copyDir("dist", "public");
fs.writeFileSync("public/_redirects", "/*    /index.html   200\n");
console.log("[prepare-static] OK: dist -> public");
