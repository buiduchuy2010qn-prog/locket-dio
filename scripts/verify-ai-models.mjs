/**
 * Post-build verify: model.json + all weightsManifest shards exist and size > 0
 * under each deploy root (dist, public, vercel-static).
 *
 * Usage:
 *   node scripts/verify-ai-models.mjs
 *   node scripts/verify-ai-models.mjs dist public vercel-static
 */
import fs from "fs";
import path from "path";

const REL = path.join("ai-models", "esrgan-slim-2x", "v1");
const roots =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ["dist", "public", "vercel-static"].filter((d) => fs.existsSync(d));

function fail(msg) {
  console.error(`[verify-ai-models] FAIL: ${msg}`);
  process.exit(1);
}

function shardsFrom(modelPath) {
  const json = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  const list = [];
  for (const m of json.weightsManifest || []) {
    for (const p of m.paths || []) list.push(path.basename(String(p)));
  }
  return [...new Set(list)];
}

if (roots.length === 0) {
  fail("No roots to verify (pass dist/public/vercel-static)");
}

for (const root of roots) {
  const dir = path.join(root, REL);
  const modelPath = path.join(dir, "model.json");
  if (!fs.existsSync(modelPath)) fail(`Missing ${modelPath}`);
  const mSize = fs.statSync(modelPath).size;
  if (mSize <= 0) fail(`Empty ${modelPath}`);

  const shards = shardsFrom(modelPath);
  if (shards.length === 0) fail(`${modelPath}: no shards in weightsManifest`);

  let total = mSize;
  for (const s of shards) {
    const p = path.join(dir, s);
    if (!fs.existsSync(p)) fail(`Missing shard ${p}`);
    const sz = fs.statSync(p).size;
    if (sz <= 0) fail(`Empty shard ${p}`);
    total += sz;
    console.log(`[verify-ai-models] OK ${root}/${REL}/${s} (${sz} bytes)`);
  }
  console.log(
    `[verify-ai-models] OK ${root}/${REL}/model.json (${mSize} bytes) + ${shards.length} shard(s), total ${total}`,
  );
}

console.log("[verify-ai-models] all roots OK");
