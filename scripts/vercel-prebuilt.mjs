/**
 * Vercel Hobby: remote Vite build keeps failing (~4–5 min).
 * We commit a known-good dist/ and only verify it exists here.
 * Real Vite build: npm run build:vite
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = path.join(root, "dist", "index.html");

if (!fs.existsSync(indexHtml)) {
  console.error("[vercel-prebuilt] missing dist/index.html — run: npm run build:vite");
  process.exit(1);
}

const st = fs.statSync(indexHtml);
console.log(
  `[vercel-prebuilt] ok — using committed dist/index.html (${st.size} bytes)`
);
