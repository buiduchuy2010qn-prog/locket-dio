/**
 * Vercel Vite preset may wipe `dist/` before build.
 * Deploy from committed `vercel-static/` (copy of dist).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "vercel-static");
const distDir = path.join(root, "dist");
const indexHtml = path.join(outDir, "index.html");

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(indexHtml)) {
  if (fs.existsSync(path.join(distDir, "index.html"))) {
    console.log("[vercel-prebuilt] vercel-static missing — copying from dist/");
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
    copyDir(distDir, outDir);
  }
}

if (!fs.existsSync(indexHtml)) {
  console.error(
    "[vercel-prebuilt] missing vercel-static/index.html — run: npm run build:vercel-static",
  );
  process.exit(1);
}

fs.writeFileSync(
  path.join(outDir, ".vercel-build-stamp"),
  new Date().toISOString() + "\n",
);

const st = fs.statSync(indexHtml);
console.log(
  `[vercel-prebuilt] ok — output vercel-static/ (${st.size} bytes index.html)`,
);
