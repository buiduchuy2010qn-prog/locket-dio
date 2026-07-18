/**
 * Copy ESRGAN Slim 2x weights into public/models for same-origin serving.
 * Run before vite build so publicDir includes model.json + shard.bin.
 */
import fs from "fs";
import path from "path";

const srcDir = path.join(
  "node_modules",
  "@upscalerjs",
  "esrgan-slim",
  "models",
  "x2",
);
const destDir = path.join("public", "models", "esrgan-slim", "x2");

const files = ["model.json", "group1-shard1of1.bin"];

if (!fs.existsSync(srcDir)) {
  console.error(
    "[sync-ai-models] Missing package @upscalerjs/esrgan-slim — run npm install",
  );
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
for (const f of files) {
  const from = path.join(srcDir, f);
  const to = path.join(destDir, f);
  if (!fs.existsSync(from)) {
    console.error(`[sync-ai-models] Missing ${from}`);
    process.exit(1);
  }
  fs.copyFileSync(from, to);
  console.log(`[sync-ai-models] ${f} → ${to} (${fs.statSync(to).size} bytes)`);
}
