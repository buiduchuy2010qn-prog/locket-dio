/**
 * Copy ESRGAN Slim 2x weights into versioned same-origin static path:
 *   public/ai-models/esrgan-slim-2x/v1/{model.json, *.bin}
 *
 * Shard filenames are read from model.json weightsManifest (never guessed).
 * Fails the build if any referenced shard is missing or empty.
 */
import fs from "fs";
import path from "path";

const PACKAGE_X2 = path.join(
  "node_modules",
  "@upscalerjs",
  "esrgan-slim",
  "models",
  "x2",
);

/** Stable public URL path (also used by client + SW). */
export const AI_MODEL_PUBLIC_DIR = path.join(
  "public",
  "ai-models",
  "esrgan-slim-2x",
  "v1",
);

const DEST_REL = "ai-models/esrgan-slim-2x/v1";

function fail(msg) {
  console.error(`[sync-ai-models] FAIL: ${msg}`);
  process.exit(1);
}

function readShardsFromModelJson(modelJsonPath) {
  let raw;
  try {
    raw = fs.readFileSync(modelJsonPath, "utf8");
  } catch (e) {
    fail(`Cannot read ${modelJsonPath}: ${e.message}`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON ${modelJsonPath}: ${e.message}`);
  }
  const manifests = json.weightsManifest;
  if (!Array.isArray(manifests) || manifests.length === 0) {
    fail("model.json has no weightsManifest[]");
  }
  const shards = [];
  for (const m of manifests) {
    if (!Array.isArray(m.paths) || m.paths.length === 0) {
      fail("weightsManifest entry missing paths[]");
    }
    for (const p of m.paths) {
      if (typeof p !== "string" || !p.trim()) fail("empty shard path in manifest");
      // paths are relative to model.json directory
      const base = path.basename(p.replace(/\\/g, "/"));
      shards.push(base);
    }
  }
  return [...new Set(shards)];
}

function copyVerified(from, to, label) {
  if (!fs.existsSync(from)) fail(`Missing source ${label}: ${from}`);
  const st = fs.statSync(from);
  if (!st.isFile() || st.size <= 0) fail(`Empty or invalid source ${label}: ${from}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  const out = fs.statSync(to);
  if (out.size !== st.size || out.size <= 0) {
    fail(`Copy size mismatch for ${label}: ${out.size} vs ${st.size}`);
  }
  console.log(`[sync-ai-models] ${label} → ${to} (${out.size} bytes)`);
  return out.size;
}

function main() {
  if (!fs.existsSync(PACKAGE_X2)) {
    fail(
      "Missing package @upscalerjs/esrgan-slim models/x2 — run npm install",
    );
  }

  const srcModel = path.join(PACKAGE_X2, "model.json");
  if (!fs.existsSync(srcModel)) fail(`Missing ${srcModel}`);

  const shards = readShardsFromModelJson(srcModel);
  if (shards.length === 0) fail("No weight shards listed in model.json");

  const destDir = AI_MODEL_PUBLIC_DIR;
  fs.mkdirSync(destDir, { recursive: true });

  copyVerified(srcModel, path.join(destDir, "model.json"), "model.json");

  let total = fs.statSync(path.join(destDir, "model.json")).size;
  for (const shard of shards) {
    const from = path.join(PACKAGE_X2, shard);
    const to = path.join(destDir, shard);
    total += copyVerified(from, to, shard);
  }

  // Post-copy re-verify dest against manifest
  const destModel = path.join(destDir, "model.json");
  const destShards = readShardsFromModelJson(destModel);
  for (const shard of destShards) {
    const p = path.join(destDir, shard);
    if (!fs.existsSync(p) || fs.statSync(p).size <= 0) {
      fail(`Dest missing/empty shard after copy: ${p}`);
    }
  }

  // Clean legacy path if present (avoid dual sources of truth)
  const legacy = path.join("public", "models", "esrgan-slim");
  if (fs.existsSync(legacy)) {
    try {
      fs.rmSync(legacy, { recursive: true, force: true });
      console.log("[sync-ai-models] removed legacy public/models/esrgan-slim");
    } catch (e) {
      console.warn("[sync-ai-models] could not remove legacy:", e.message);
    }
  }

  console.log(
    `[sync-ai-models] OK — ${DEST_REL} (${shards.length} shard(s), ${total} bytes total)`,
  );
  console.log(`[sync-ai-models] shards: ${shards.join(", ")}`);
}

main();
