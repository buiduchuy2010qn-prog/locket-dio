/**
 * Generate circular pink web logo for header (/images/locket-dio.png)
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function logoSvg(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f9a8d4"/>
      <stop offset="45%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#db2777"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="120" fill="url(#g)"/>
  <path fill="#ffffff" transform="translate(128,140) scale(5.4) translate(-12,-12)"
    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
</svg>`;
}

async function writePng(outRel, size) {
  const out = path.join(root, outRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(logoSvg(size))).png().toFile(out);
  console.log("[logo]", outRel, size);
}

const targets = [
  ["public/images/locket-dio.png", 256],
  ["dist/images/locket-dio.png", 256],
  ["vercel-static/images/locket-dio.png", 256],
];

for (const [rel, size] of targets) {
  const dir = path.dirname(path.join(root, rel));
  if (!fs.existsSync(dir) && !rel.startsWith("public/")) {
    console.log("[skip]", rel);
    continue;
  }
  await writePng(rel, size);
}

console.log("[logo] web logo pink OK");
